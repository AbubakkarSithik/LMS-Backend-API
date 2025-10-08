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

export default router;
