import supabase from "../config/supabase.js";

export async function buildApprovalWorkflow(employeeId, leaveRequestId) {
  try {
    let level = 1;
    const workflowEntries = [];
    let currentEmployee = employeeId;

    while (true) {
      // Step 1: Try to find a manager
      const { data: mgrRel } = await supabase
        .from("employee_manager")
        .select("manager_id")
        .eq("employee_id", currentEmployee)
        .single();

      if (!mgrRel?.manager_id) break; // no manager, stop
      const managerId = mgrRel.manager_id;

      // Add manager as approver
      workflowEntries.push({
        leave_request_id: leaveRequestId,
        approver_id: managerId,
        level,
      });

      // Step 2: Check if that manager has an HR mapped
      const { data: hrRel } = await supabase
        .from("manager_hr")
        .select("hr_id")
        .eq("manager_id", managerId)
        .single();

      if (hrRel?.hr_id) {
        level++;
        workflowEntries.push({
          leave_request_id: leaveRequestId,
          approver_id: hrRel.hr_id,
          level,
        });
      }

      // Step 3: For next iteration (in case manager has another manager)
      currentEmployee = managerId;
      level++;
    }

    if (workflowEntries.length > 0) {
      const { error: wfErr } = await supabase
        .from("leave_approval_workflow")
        .insert(workflowEntries);
      if (wfErr) console.error("Workflow insert error:", wfErr);
    }

    return workflowEntries;
  } catch (err) {
    console.error("buildApprovalWorkflow error:", err);
    return [];
  }
}

export async function logLeaveAction(
  leaveRequestId,
  action,
  oldStatus,
  newStatus,
  performedBy,
  remarks = null
) {
  try {
    const { error } = await supabase.from("leave_request_auditlog").insert([
      {
        leave_request_id: leaveRequestId,
        action,
        old_status: oldStatus,
        new_status: newStatus,
        performed_by: performedBy,
        remarks,
      },
    ]);
    if (error) console.error("logLeaveAction error:", error);
  } catch (err) {
    console.error("logLeaveAction exception:", err);
  }
}
