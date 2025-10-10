import express from "express";
import supabase from "../config/supabase.js";
import { verifyAuth } from "../middleware/verifyAuth.js";
import { buildApprovalWorkflow, logLeaveAction } from "../middleware/leaveHelpers.js";
import { verifyAdminForOrg, verifyHRForOrg } from "../middleware/verifyAdmin.js";

const router = express.Router();

router.post("/request", verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { leave_type_id, start_date, end_date, reason } = req.body;

    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data: user, error: userErr } = await supabase
      .from("app_user")
      .select("organization_id, role_id")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role_id === 1001) {
      return res.status(403).json({ error: "Admin cannot request leave" });
    }

    const { data: leaveReq, error: leaveErr } = await supabase
      .from("leave_request")
      .insert([
        {
          employee_id: userId,
          leave_type_id,
          start_date,
          end_date,
          reason,
        },
      ])
      .select()
      .single();

    if (leaveErr) {
      console.error("leave_request insert error:", leaveErr);
      return res.status(500).json({ error: leaveErr.message });
    }

    const workflow = await buildApprovalWorkflow(userId, leaveReq.leave_request_id);

    await logLeaveAction(
      leaveReq.leave_request_id,
      "Created",
      null,
      "Pending",
      userId,
      reason || null
    );

    return res.status(201).json({
      message: "Leave request created successfully",
      leave_request_id: leaveReq.leave_request_id,
      workflow,
    });
  } catch (err) {
    console.error("POST /leave/request error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/approve/:id", verifyAuth, async (req, res) => {
  try {
    const leaveRequestId = parseInt(req.params.id);
    const approverId = req.user.id;
    const { remarks } = req.body;

    //Find the current approver's workflow row (Pending)
    const { data: currentLevel, error: currentErr } = await supabase
      .from("leave_approval_workflow")
      .select("*")
      .eq("leave_request_id", leaveRequestId)
      .eq("approver_id", approverId)
      .eq("status", "Pending")
      .single();

    if (currentErr || !currentLevel)
      return res.status(404).json({ error: "No pending workflow found for approver" });

    // Approve current level
    const { error: updateErr } = await supabase
      .from("leave_approval_workflow")
      .update({
        status: "Approved",
        approved_at: new Date().toISOString(),
        remarks,
      })
      .eq("workflow_id", currentLevel.workflow_id);

    if (updateErr) throw updateErr;

    // Activate next level (if exists)
    const { data: nextLevel } = await supabase
      .from("leave_approval_workflow")
      .select("*")
      .eq("leave_request_id", leaveRequestId)
      .eq("level", currentLevel.level + 1)
      .single();

    if (nextLevel) {
      // If there’s another approver, activate them
      await supabase
        .from("leave_approval_workflow")
        .update({ status: "Pending" })
        .eq("workflow_id", nextLevel.workflow_id);
    }

    //Check if all levels approved
    const { data: pendingLevels } = await supabase
      .from("leave_approval_workflow")
      .select("status")
      .eq("leave_request_id", leaveRequestId)
      .in("status", ["Pending", "Not Started"]);

    let leaveStatus = "Approved";
    if (nextLevel) leaveStatus = "Under Review";
    else if (pendingLevels?.length > 0) leaveStatus = "Under Review";

    // Update main leave_request status
    const { data: leaveReq, error: leaveUpdateErr } = await supabase
      .from("leave_request")
      .update({
        status: leaveStatus,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
      })
      .eq("leave_request_id", leaveRequestId)
      .select()
      .single();

    if (leaveUpdateErr) throw leaveUpdateErr;

    // If final approval, update leave_balance
    if (leaveStatus === "Approved") {
      const days =
        (new Date(leaveReq.end_date) - new Date(leaveReq.start_date)) /
          (1000 * 60 * 60 * 24) +
        1;

      const { data: balance } = await supabase
        .from("leave_balance")
        .select("total_used")
        .eq("employee_id", leaveReq.employee_id)
        .eq("leave_type_id", leaveReq.leave_type_id)
        .single();

      const newUsed = (balance?.total_used || 0) + days;
      await supabase
        .from("leave_balance")
        .update({ total_used: newUsed })
        .eq("employee_id", leaveReq.employee_id)
        .eq("leave_type_id", leaveReq.leave_type_id);
    }

    // Log approval
    await logLeaveAction(
      leaveRequestId,
      "Approved",
      "Pending",
      leaveStatus,
      approverId,
      remarks
    );

    res.json({ message: "Leave approved successfully", leaveStatus });
  } catch (err) {
    console.error("PATCH /leave/approve error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/leave/reject/:id
router.patch("/reject/:id", verifyAuth, async (req, res) => {
  try {
    const leaveRequestId = parseInt(req.params.id);
    const approverId = req.user.id;
    const { remarks } = req.body;

    // Find the pending workflow for current approver
    const { data: currentLevel, error: wfErr } = await supabase
      .from("leave_approval_workflow")
      .select("*")
      .eq("leave_request_id", leaveRequestId)
      .eq("approver_id", approverId)
      .eq("status", "Pending")
      .single();

    if (wfErr || !currentLevel)
      return res.status(404).json({ error: "No pending workflow found for approver" });

    // Reject current workflow row
    const { error: rejectErr } = await supabase
      .from("leave_approval_workflow")
      .update({
        status: "Rejected",
        approved_at: new Date().toISOString(),
        remarks,
      })
      .eq("workflow_id", currentLevel.workflow_id);

    if (rejectErr) throw rejectErr;

    // Cancel all next levels
    await supabase
      .from("leave_approval_workflow")
      .update({ status: "Cancelled" })
      .eq("leave_request_id", leaveRequestId)
      .gt("level", currentLevel.level);

    //Update main leave_request
    const { data: updatedLeave, error: leaveUpdateErr } = await supabase
      .from("leave_request")
      .update({
        status: "Rejected",
        approved_by: approverId,
        approved_at: new Date().toISOString(),
      })
      .eq("leave_request_id", leaveRequestId)
      .select()
      .single();

    if (leaveUpdateErr) throw leaveUpdateErr;

    //Log rejection
    await logLeaveAction(
      leaveRequestId,
      "Rejected",
      "Pending",
      "Rejected",
      approverId,
      remarks
    );

    res.json({ message: "Leave rejected successfully" });
  } catch (err) {
    console.error("PATCH /leave/reject error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/leave/:id/auditlog
router.get("/:id/auditlog", verifyAuth, async (req, res) => {
  try {
    const leaveRequestId = parseInt(req.params.id);

    const { data, error } = await supabase
      .from("leave_request_auditlog")
      .select(`*,
          app_user:performed_by(id,
            first_name,
            last_name)
            `)
      .eq("leave_request_id", leaveRequestId)
      .order("performed_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("GET /leave/:id/auditlog error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/leave/requests
router.get("/requests", verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: user, error: userErr } = await supabase
      .from("app_user")
      .select("organization_id, role_id")
      .eq("id", userId)
      .single();

    if (userErr || !user)
      return res.status(404).json({ error: "User not found" });

    const orgId = user.organization_id;
    const isAdmin = !!(await verifyAdminForOrg(userId, orgId));

    let leaveQuery = supabase
      .from("leave_request")
      .select(`
        leave_request_id,
        start_date,
        end_date,
        reason,
        status,
        applied_at,
        approved_at,
        approved_by,
        employee_id,
        app_user:employee_id (
          id,
          first_name,
          last_name,
          email
        ),
        leave_type:leave_type_id (
          leave_type_id,
          name
        )
      `)
      .order("applied_at", { ascending: false });

    // Admin → All org leaves
    if (isAdmin || user.role_id === 1001) {
      const { data: orgUsers, error: orgErr } = await supabase
        .from("app_user")
        .select("id")
        .eq("organization_id", orgId);
      if (orgErr) throw orgErr;

      const userIds = orgUsers?.map((u) => u.id) || [];
      if (userIds.length > 0)
        leaveQuery = leaveQuery.in("employee_id", userIds);
    }

    // For Approvers (HR or Manager)
    else {
      const { data: wfData, error: wfErr } = await supabase
        .from("leave_approval_workflow")
        .select("leave_request_id, level")
        .eq("approver_id", userId)
        .eq("status", "Pending");

      if (wfErr) throw wfErr;
      if (!wfData?.length) return res.json([]);

      // Filter only leaves whose previous levels are fully approved
      const readyForApproval = [];

      for (const wf of wfData) {
        const { data: lowerLevels } = await supabase
          .from("leave_approval_workflow")
          .select("status")
          .eq("leave_request_id", wf.leave_request_id)
          .lt("level", wf.level);

        const allApproved =
          !lowerLevels?.length ||
          lowerLevels.every((lvl) => lvl.status === "Approved");

        if (allApproved) readyForApproval.push(wf.leave_request_id);
      }

      if (readyForApproval.length > 0)
        leaveQuery = leaveQuery.in("leave_request_id", readyForApproval);
      else return res.json([]);
    }

    const { data: leaves, error: leaveErr } = await leaveQuery;
    if (leaveErr) return res.status(500).json({ error: leaveErr.message });

    res.json(leaves);
  } catch (err) {
    console.error("GET /leave/requests error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/history", verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user info
    const { data: user, error: userErr } = await supabase
      .from("app_user")
      .select("organization_id, role_id")
      .eq("id", userId)
      .single();

    if (userErr || !user)
      return res.status(404).json({ error: "User not found" });

    const orgId = user.organization_id;
    const isAdmin = !!(await verifyAdminForOrg(userId, orgId));

    // Base query
    let leaveQuery = supabase
      .from("leave_request")
      .select(
        `
        leave_request_id,
        start_date,
        end_date,
        reason,
        status,
        applied_at,
        approved_at,
        approved_by,
        employee_id,
        app_user:employee_id (
          id,
          first_name,
          last_name,
          email
        ),
        leave_type:leave_type_id (
          leave_type_id,
          name
        )
        `
      )
      .order("applied_at", { ascending: false });

    if (isAdmin || user.role_id === 1001) {
      const { data: orgUsers, error: orgErr } = await supabase
        .from("app_user")
        .select("id")
        .eq("organization_id", orgId);

      if (orgErr) throw orgErr;
      const userIds = orgUsers?.map((u) => u.id) || [];
      if (userIds.length > 0) leaveQuery = leaveQuery.in("employee_id", userIds);
    } else {
      leaveQuery = leaveQuery.eq("employee_id", userId);
    }

    const { data: leaves, error: leaveErr } = await leaveQuery;
    if (leaveErr) return res.status(500).json({ error: leaveErr.message });

    res.json(leaves);
  } catch (err) {
    console.error("GET /leave/history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
