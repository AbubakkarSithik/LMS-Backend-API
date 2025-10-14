import {
  getUserById,
  getLeaveBalance,
  updateLeaveBalance,
  createLeaveRequest,
  updateLeaveRequest,
  getCurrentWorkflow,
  updateWorkflowStatus,
  getNextWorkflowLevel,
  getPendingWorkflows,
  cancelHigherWorkflows,
  getAuditLog,
  getOrgUsers,
  getPendingApprovals,
  getLowerLevelStatuses,
} from "../models/leaveRequestModel.js";

import { buildApprovalWorkflow, logLeaveAction } from "../middleware/leaveHelpers.js";
import { verifyAdminForOrg } from "../middleware/verifyAdmin.js";
import supabase from "../config/supabase.js";

// POST /leave/request
export const createLeave = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { leave_type_id, start_date, end_date, reason } = req.body;

    if (!leave_type_id || !start_date || !end_date)
      return res.status(400).json({ error: "Missing required fields" });

    const { data: user, error: userErr } = await getUserById(userId);
    if (userErr || !user) return res.status(404).json({ error: "User not found" });
    if (user.role_id === 1001)
      return res.status(403).json({ error: "Admin cannot request leave" });

    const days =
      (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24) + 1;

    const { data: balance } = await getLeaveBalance(userId, leave_type_id);
    const newUsed = (balance?.total_used || 0) + days;
    await updateLeaveBalance(userId, leave_type_id, newUsed);

    const { data: leaveReq, error: leaveErr } = await createLeaveRequest({
      employee_id: userId,
      leave_type_id,
      start_date,
      end_date,
      reason,
      status: "Pending",
    });

    if (leaveErr) throw leaveErr;

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
    console.error("createLeave error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// PATCH /leave/approve/:id
export const approveLeave = async (req, res) => {
  try {
    const leaveRequestId = parseInt(req.params.id);
    const approverId = req.user.id;
    const { remarks } = req.body;

    const { data: currentLevel } = await getCurrentWorkflow(leaveRequestId, approverId);
    if (!currentLevel)
      return res.status(404).json({ error: "No pending workflow found for approver" });

    await updateWorkflowStatus(currentLevel.workflow_id, {
      status: "Approved",
      approved_at: new Date().toISOString(),
      remarks,
    });

    const { data: nextLevel } = await getNextWorkflowLevel(
      leaveRequestId,
      currentLevel.level + 1
    );

    if (nextLevel)
      await updateWorkflowStatus(nextLevel.workflow_id, { status: "Pending" });

    const { data: pendingLevels } = await getPendingWorkflows(leaveRequestId);

    let leaveStatus = "Approved";
    if (nextLevel || (pendingLevels?.length ?? 0) > 0) leaveStatus = "Under Review";

    await updateLeaveRequest(leaveRequestId, {
      status: leaveStatus,
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    });

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
    console.error("approveLeave error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// PATCH /leave/reject/:id
export const rejectLeave = async (req, res) => {
  try {
    const leaveRequestId = parseInt(req.params.id);
    const approverId = req.user.id;
    const { remarks } = req.body;

    const { data: currentLevel } = await getCurrentWorkflow(leaveRequestId, approverId);
    if (!currentLevel)
      return res.status(404).json({ error: "No pending workflow found for approver" });

    await updateWorkflowStatus(currentLevel.workflow_id, {
      status: "Rejected",
      approved_at: new Date().toISOString(),
      remarks,
    });

    await cancelHigherWorkflows(leaveRequestId, currentLevel.level);

    // revert balance
    const { data: leaveReq } = await supabase
      .from("leave_request")
      .select("employee_id, leave_type_id, start_date, end_date")
      .eq("leave_request_id", leaveRequestId)
      .single();

    if (leaveReq) {
      const days =
        (new Date(leaveReq.end_date) - new Date(leaveReq.start_date)) /
          (1000 * 60 * 60 * 24) +
        1;
      const { data: balance } = await getLeaveBalance(
        leaveReq.employee_id,
        leaveReq.leave_type_id
      );
      const newUsed = Math.max(0, (balance?.total_used || 0) - days);
      await updateLeaveBalance(leaveReq.employee_id, leaveReq.leave_type_id, newUsed);
    }

    await updateLeaveRequest(leaveRequestId, {
      status: "Rejected",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    });

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
    console.error("rejectLeave error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET /leave/:id/auditlog
export const getLeaveAuditLog = async (req, res) => {
  try {
    const leaveRequestId = parseInt(req.params.id);
    const { data, error } = await getAuditLog(leaveRequestId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error("getLeaveAuditLog error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

//  GET /leave/requests
export const getLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: user } = await getUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const orgId = user.organization_id;
    const isAdmin = !!(await verifyAdminForOrg(userId, orgId));

    let leaveQuery = supabase
      .from("leave_request")
      .select(
        `leave_request_id,start_date,end_date,reason,status,applied_at,approved_at,approved_by,employee_id,
         app_user:employee_id(id,first_name,last_name,email),
         leave_type:leave_type_id(leave_type_id,name)`
      )
      .order("applied_at", { ascending: false });

    if (isAdmin || user.role_id === 1001) {
      const { data: orgUsers } = await getOrgUsers(orgId);
      const userIds = orgUsers?.map((u) => u.id) || [];
      if (userIds.length > 0) leaveQuery = leaveQuery.in("employee_id", userIds);
    } else {
      const { data: wfData } = await getPendingApprovals(userId);
      if (!wfData?.length) return res.json([]);

      const ready = [];
      for (const wf of wfData) {
        const { data: lowerLevels } = await getLowerLevelStatuses(
          wf.leave_request_id,
          wf.level
        );
        const allApproved =
          !lowerLevels?.length ||
          lowerLevels.every((lvl) => lvl.status === "Approved");
        if (allApproved) ready.push(wf.leave_request_id);
      }

      if (ready.length > 0) leaveQuery = leaveQuery.in("leave_request_id", ready);
      else return res.json([]);
    }

    const { data: leaves, error: leaveErr } = await leaveQuery;
    if (leaveErr) return res.status(500).json({ error: leaveErr.message });
    res.json(leaves);
  } catch (err) {
    console.error("getLeaveRequests error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET /leave/history
export const getLeaveHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: user } = await getUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const orgId = user.organization_id;
    const isAdmin = !!(await verifyAdminForOrg(userId, orgId));

    let leaveQuery = supabase
      .from("leave_request")
      .select(
        `leave_request_id,start_date,end_date,reason,status,applied_at,approved_at,approved_by,employee_id,
         app_user:employee_id(id,first_name,last_name,email),
         leave_type:leave_type_id(leave_type_id,name)`
      )
      .order("applied_at", { ascending: false });

    if (isAdmin || user.role_id === 1001) {
      const { data: orgUsers } = await getOrgUsers(orgId);
      const userIds = orgUsers?.map((u) => u.id) || [];
      if (userIds.length > 0) leaveQuery = leaveQuery.in("employee_id", userIds);
    } else {
      leaveQuery = leaveQuery.eq("employee_id", userId);
    }

    const { data: leaves, error: leaveErr } = await leaveQuery;
    if (leaveErr) return res.status(500).json({ error: leaveErr.message });
    res.json(leaves);
  } catch (err) {
    console.error("getLeaveHistory error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
