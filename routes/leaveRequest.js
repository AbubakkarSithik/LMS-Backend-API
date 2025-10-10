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

    // 1. Find the pending workflow row for this approver
    const { data: workflowRow, error: wfErr } = await supabase
      .from("leave_approval_workflow")
      .select("*")
      .eq("leave_request_id", leaveRequestId)
      .eq("approver_id", approverId)
      .eq("status", "Pending")
      .single();

    if (wfErr) {
      console.error("Error fetching workflow row:", wfErr);
      return res.status(500).json({ error: wfErr.message });
    }
    if (!workflowRow) {
      return res.status(404).json({ error: "No pending workflow found for approver" });
    }

    // 2. Update the workflow row status = "Rejected"
    const { data: updatedWf, error: updateErr } = await supabase
      .from("leave_approval_workflow")
      .update({
        status: "Rejected",
        approved_at: new Date().toISOString(),
        remarks: remarks || null,
      })
      .eq("workflow_id", workflowRow.workflow_id)
      .select(); 

    if (updateErr) {
      console.error("Error updating workflow row:", updateErr);
      return res.status(500).json({ error: updateErr.message });
    }
    if (!updatedWf || updatedWf.length === 0) {
      console.warn("No rows updated in leave_approval_workflow for reject");
    }

    // 3. Update the main leave_request status to "Rejected"
    const { data: updatedLeave, error: leaveUpdateErr } = await supabase
      .from("leave_request")
      .update({
        status: "Rejected",
        approved_by: approverId,
        approved_at: new Date().toISOString(),
      })
      .eq("leave_request_id", leaveRequestId)
      .select(); 

    if (leaveUpdateErr) {
      console.error("Error updating leave_request for reject:", leaveUpdateErr);
      return res.status(500).json({ error: leaveUpdateErr.message });
    }
    if (!updatedLeave || updatedLeave.length === 0) {
      console.warn("No rows updated in leave_request for reject");
    }

    // 4. Log action
    await logLeaveAction(
      leaveRequestId,
      "Rejected",
      "Pending",    
      "Rejected",
      approverId,
      remarks || null
    );

    return res.json({
      message: "Leave rejected successfully",
      workflow: updatedWf[0],
      leave_request: updatedLeave[0],
    });
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
    }

    else if (isHR || user.role_id === 1002) {
      const { data: pendingWorkflows, error: wfErr } = await supabase
        .from("leave_approval_workflow")
        .select("leave_request_id")
        .eq("approver_id", userId)
        .eq("status", "Pending");

      if (wfErr) throw wfErr;

      const pendingLeaveIds = pendingWorkflows?.map((w) => w.leave_request_id) || [];
      if (pendingLeaveIds.length > 0)
        leaveQuery = leaveQuery.in("leave_request_id", pendingLeaveIds);
      else
        return res.json([]);
    }

    else if (user.role_id === 1003) {
      const { data: pendingWorkflows, error: wfErr } = await supabase
        .from("leave_approval_workflow")
        .select("leave_request_id")
        .eq("approver_id", userId)
        .eq("status", "Pending");

      if (wfErr) throw wfErr;

      const pendingLeaveIds = pendingWorkflows?.map((w) => w.leave_request_id) || [];
      if (pendingLeaveIds.length > 0)
        leaveQuery = leaveQuery.in("leave_request_id", pendingLeaveIds);
      else
        return res.json([]);
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


router.get("/history", verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Fetch user info
    const { data: user, error: userErr } = await supabase
      .from("app_user")
      .select("organization_id, role_id")
      .eq("id", userId)
      .single();

    if (userErr || !user)
      return res.status(404).json({ error: "User not found" });

    const orgId = user.organization_id;
    const isAdmin = !!(await verifyAdminForOrg(userId, orgId));

    // 2️⃣ Base query
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
