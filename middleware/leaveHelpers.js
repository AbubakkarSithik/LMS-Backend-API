import supabase from "../config/supabase.js";

export async function buildApprovalWorkflow(employeeId, leaveRequestId) {
  try {
    let managerId = null;
    let hrId = null;

    const { data: empMgr } = await supabase
      .from("employee_manager")
      .select("manager_id")
      .eq("employee_id", employeeId)
      .single();

    if (empMgr?.manager_id) {
      managerId = empMgr.manager_id;

      const { data: mgrHr } = await supabase
        .from("manager_hr")
        .select("hr_id")
        .eq("manager_id", managerId)
        .single();

      if (mgrHr?.hr_id) {
        hrId = mgrHr.hr_id;
      }
    }else{
        const { data: mgrHR } = await supabase
        .from("manager_hr")
        .select("hr_id")
        .eq("manager_id", employeeId)
        .single();

        if (mgrHR?.hr_id) {
          hrId = mgrHR.hr_id;
        }
    }

    const workflowEntries = [];
    if (managerId) {
      workflowEntries.push({
        leave_request_id: leaveRequestId,
        approver_id: managerId,
        level: 1,
      });
    }
    if (hrId) {
      workflowEntries.push({
        leave_request_id: leaveRequestId,
        approver_id: hrId,
        level: 2,
      });
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
