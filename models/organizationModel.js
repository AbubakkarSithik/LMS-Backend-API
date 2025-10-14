import supabase from "../config/supabase.js";

// Fetch organization by user ID
export const getOrganizationByUserId = async (userId) => {
  const { data: userRow, error: userErr } = await supabase
    .from("app_user")
    .select("organization_id")
    .eq("id", userId)
    .single();
  if (userErr || !userRow) throw new Error("Organization not found for user");

  const { data: org, error: orgErr } = await supabase
    .from("organization")
    .select("*")
    .eq("organization_id", userRow.organization_id)
    .single();
  if (orgErr) throw new Error(orgErr.message);

  return org;
};

// Fetch organization_id for user
export const getOrgIdForUser = async (userId) => {
  const { data: userRow, error } = await supabase
    .from("app_user")
    .select("organization_id")
    .eq("id", userId)
    .single();

  if (error || !userRow) throw new Error("Organization not found");
  return userRow.organization_id;
};

/* ---------------- LEAVE TYPES ---------------- */

export const getLeaveTypesByOrg = async (orgId) => {
  const { data, error } = await supabase
    .from("leave_type")
    .select("*")
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return data;
};

export const insertLeaveType = async (orgId, name, description, max_days_per_year) => {
  const { data, error } = await supabase
    .from("leave_type")
    .insert([{ organization_id: orgId, name, description, max_days_per_year }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const updateLeaveType = async (id, updates) => {
  const { data, error } = await supabase
    .from("leave_type")
    .update(updates)
    .eq("leave_type_id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteLeaveType = async (id) => {
  const { error } = await supabase
    .from("leave_type")
    .delete()
    .eq("leave_type_id", id);
  if (error) throw new Error(error.message);
};

/* ---------------- HOLIDAYS ---------------- */

export const getHolidaysByOrg = async (orgId) => {
  const { data, error } = await supabase
    .from("holiday")
    .select("*")
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return data;
};

export const insertHoliday = async (orgId, holiday_date, name, is_recurring) => {
  const { data, error } = await supabase
    .from("holiday")
    .insert([{ organization_id: orgId, holiday_date, name, is_recurring }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const updateHoliday = async (id, updates) => {
  const { data, error } = await supabase
    .from("holiday")
    .update(updates)
    .eq("holiday_id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteHoliday = async (id) => {
  const { error } = await supabase
    .from("holiday")
    .delete()
    .eq("holiday_id", id);
  if (error) throw new Error(error.message);
};
