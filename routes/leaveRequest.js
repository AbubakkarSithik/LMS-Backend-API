import express from "express";
import supabase from "../config/supabase.js";
import { verifyAuth } from "../middleware/verifyAuth.js";
import { buildApprovalWorkflow, logLeaveAction } from "../middleware/leaveHelpers.js";

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
        (new Date(leaveReq.end_date) - new Date(leaveReq.start_date)) / (1000 * 60 * 60 * 24) + 1;

      await supabase
        .from("leave_balance")
        .update({ total_used: supabase.raw("total_used + ?", [days]) })
        .eq("employee_id", leaveReq.employee_id)
        .eq("leave_type_id", leaveReq.leave_type_id);
    }

    // 6. Log action
    await logLeaveAction(leaveRequestId, "Approved", "Pending", leaveStatus, approverId, remarks);

    res.json({ message: "Leave approved successfully", leaveStatus });
  } catch (err) {
    console.error("PATCH /leave/approve error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
