import supabase from "../config/supabase.js";

// Fetch user info
export async function getUserById(userId) {
  return supabase.from("app_user").select("organization_id, role_id").eq("id", userId).single();
}

// Get leave balance
export async function getLeaveBalance(userId, leaveTypeId) {
  return supabase
    .from("leave_balance")
    .select("total_used")
    .eq("employee_id", userId)
    .eq("leave_type_id", leaveTypeId)
    .single();
}

// Update leave balance
export async function updateLeaveBalance(userId, leaveTypeId, totalUsed) {
  return supabase
    .from("leave_balance")
    .update({ total_used: totalUsed })
    .eq("employee_id", userId)
    .eq("leave_type_id", leaveTypeId);
}

// Create leave request
export async function createLeaveRequest(payload) {
  return supabase.from("leave_request").insert([payload]).select().single();
}

// Update leave request status
export async function updateLeaveRequest(leaveRequestId, fields) {
  return supabase.from("leave_request").update(fields).eq("leave_request_id", leaveRequestId);
}

// Workflow queries
export async function getCurrentWorkflow(leaveRequestId, approverId) {
  return supabase
    .from("leave_approval_workflow")
    .select("*")
    .eq("leave_request_id", leaveRequestId)
    .eq("approver_id", approverId)
    .eq("status", "Pending")
    .single();
}

export async function updateWorkflowStatus(workflowId, fields) {
  return supabase.from("leave_approval_workflow").update(fields).eq("workflow_id", workflowId);
}

export async function getNextWorkflowLevel(leaveRequestId, nextLevel) {
  return supabase
    .from("leave_approval_workflow")
    .select("*")
    .eq("leave_request_id", leaveRequestId)
    .eq("level", nextLevel)
    .single();
}

export async function cancelHigherWorkflows(leaveRequestId, level) {
  return supabase
    .from("leave_approval_workflow")
    .update({ status: "Cancelled" })
    .eq("leave_request_id", leaveRequestId)
    .gt("level", level);
}

export async function getPendingWorkflows(leaveRequestId) {
  return supabase
    .from("leave_approval_workflow")
    .select("status")
    .eq("leave_request_id", leaveRequestId)
    .in("status", ["Pending", "Not Started"]);
}

// Audit log
export async function getAuditLog(leaveRequestId) {
  return supabase
    .from("leave_request_auditlog")
    .select(
      `*,
        app_user:performed_by(id, first_name, last_name)`
    )
    .eq("leave_request_id", leaveRequestId)
    .order("performed_at", { ascending: true });
}

// Leave listing
export async function getOrgUsers(orgId) {
  return supabase.from("app_user").select("id").eq("organization_id", orgId);
}

export async function getPendingApprovals(userId) {
  return supabase
    .from("leave_approval_workflow")
    .select("leave_request_id, level")
    .eq("approver_id", userId)
    .eq("status", "Pending");
}

export async function getLowerLevelStatuses(leaveRequestId, level) {
  return supabase
    .from("leave_approval_workflow")
    .select("status")
    .eq("leave_request_id", leaveRequestId)
    .lt("level", level);
}
