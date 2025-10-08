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

    // 1. Find the workflow row for this approver and leave request
    const { data: workflowRows, error: wfErr } = await supabase
      .from("leave_approval_workflow")
      .select("*")
      .eq("leave_request_id", leaveRequestId)
      .eq("approver_id", approverId)
      .eq("status", "Pending")
      .single();

    if (wfErr || !workflowRows) {
      return res.status(404).json({ error: "No pending workflow found for approver" });
    }

    // 2. Update the workflow row to "Approved"
    const { error: updateErr } = await supabase
      .from("leave_approval_workflow")
      .update({ status: "Approved", approved_at: new Date(), remarks })
      .eq("workflow_id", workflowRows.workflow_id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    // 3. Check if any next level is pending
    const { data: pendingRows } = await supabase
      .from("leave_approval_workflow")
      .select("*")
      .eq("leave_request_id", leaveRequestId)
      .eq("status", "Pending");

    let leaveStatus = "Approved";
    if (pendingRows && pendingRows.length > 0) leaveStatus = "Under Review";

    // 4. Update main leave_request status
    const { data: leaveReq } = await supabase
      .from("leave_request")
      .update({ status: leaveStatus, approved_by: approverId, approved_at: new Date() })
      .eq("leave_request_id", leaveRequestId)
      .select()
      .single();

    // 5. Update leave_balance if fully approved
    if (leaveStatus === "Approved") {
        const days =
            (new Date(leaveReq.end_date) - new Date(leaveReq.start_date)) /
            (1000 * 60 * 60 * 24) +
            1;

        // Fetch current balance
        const { data: balance, error: balErr } = await supabase
            .from("leave_balance")
            .select("total_used")
            .eq("employee_id", leaveReq.employee_id)
            .eq("leave_type_id", leaveReq.leave_type_id)
            .single();

        if (balErr) throw balErr;
        const newUsed = (balance?.total_used || 0) + days;
        const { error: updErr } = await supabase
            .from("leave_balance")
            .update({ total_used: newUsed })
            .eq("employee_id", leaveReq.employee_id)
            .eq("leave_type_id", leaveReq.leave_type_id);

        if (updErr) throw updErr;
        }

    // 6. Log action
    await logLeaveAction(leaveRequestId, "Approved", "Pending", leaveStatus, approverId, remarks);

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

    // Find the pending workflow row
    const { data: workflowRow, error: wfErr } = await supabase
      .from("leave_approval_workflow")
      .select("*")
      .eq("leave_request_id", leaveRequestId)
      .eq("approver_id", approverId)
      .eq("status", "Pending")
      .single();

    if (wfErr || !workflowRow) {
      return res.status(404).json({ error: "No pending workflow found for approver" });
    }

    // Update workflow status to Rejected
    const { error: updateErr } = await supabase
      .from("leave_approval_workflow")
      .update({ status: "Rejected", approved_at: new Date(), remarks })
      .eq("workflow_id", workflowRow.workflow_id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    // Update main leave_request status to Rejected
    await supabase
      .from("leave_request")
      .update({ status: "Rejected", approved_by: approverId, approved_at: new Date() })
      .eq("leave_request_id", leaveRequestId);

    // Log action
    await logLeaveAction(leaveRequestId, "Rejected", "Pending", "Rejected", approverId, remarks);

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
      .select("*")
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
    const isHR = !!(await verifyHRForOrg(userId, orgId));
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
        app_user:employee_id (
          id,
          first_name,
          last_name,
          email
        ),
        leave_type:leave_type_id (
          leave_type_id,
          name
        )   `
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
    }

    else if (isHR || user.role_id === 1002) {
      const { data: orgUsers, error: orgErr } = await supabase
        .from("app_user")
        .select("id")
        .eq("organization_id", orgId);

      if (orgErr) throw orgErr;

      const userIds = orgUsers?.map((u) => u.id) || [];
      if (userIds.length > 0) leaveQuery = leaveQuery.in("employee_id", userIds);
    }

    else if (user.role_id === 1003) {
      const { data: subordinates, error: subErr } = await supabase
        .from("employee_manager")
        .select("employee_id")
        .eq("manager_id", userId);

      if (subErr) throw subErr;

      const empIds = subordinates?.map((s) => s.employee_id) || [];
      empIds.push(userId);

      if (empIds.length > 0) leaveQuery = leaveQuery.in("employee_id", empIds);
      else leaveQuery = leaveQuery.eq("employee_id", userId);
    }

    else if (user.role_id === 1004) {
      leaveQuery = leaveQuery.eq("employee_id", userId);
    }

    const { data: leaves, error: leaveErr } = await leaveQuery;
    if (leaveErr) return res.status(500).json({ error: leaveErr.message });

    res.json(leaves);
  } catch (err) {
    console.error("GET /leave/requests error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
