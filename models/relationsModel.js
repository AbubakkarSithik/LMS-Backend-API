import supabase from "../config/supabase.js";

// EMPLOYEE-MANAGER MODEL OPS
export const upsertEmployeeManager = async (employee_id, manager_id) => {
  return await supabase
    .from("employee_manager")
    .upsert({ employee_id, manager_id }, { onConflict: "employee_id" })
    .select()
    .single();
};

export const deleteEmployeeManager = async (employee_id) => {
  return await supabase
    .from("employee_manager")
    .delete()
    .eq("employee_id", employee_id);
};

// HR-ADMIN MODEL OPS
export const upsertHrAdmin = async (hr_id, admin_id) => {
  return await supabase
    .from("hr_admin")
    .upsert({ hr_id, admin_id }, { onConflict: "hr_id" })
    .select()
    .single();
};

export const deleteHrAdmin = async (hr_id) => {
  return await supabase.from("hr_admin").delete().eq("hr_id", hr_id);
};

// MANAGER-HR MODEL OPS
export const upsertManagerHr = async (manager_id, hr_id) => {
  return await supabase
    .from("manager_hr")
    .upsert({ manager_id, hr_id }, { onConflict: "manager_id" })
    .select()
    .single();
};

export const deleteManagerHr = async (manager_id) => {
  return await supabase.from("manager_hr").delete().eq("manager_id", manager_id);
};

// FETCH ALL RELATIONS
export const fetchUsers = async () => {
  return await supabase
    .from("app_user")
    .select("id, first_name, last_name, organization_id");
};

export const fetchRelations = async () => {
  const [empMgr, mgrHr] = await Promise.all([
    supabase.from("employee_manager").select("*"),
    supabase.from("manager_hr").select("*"),
  ]);
  return { empMgr, mgrHr };
};
