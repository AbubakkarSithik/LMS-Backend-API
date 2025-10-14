import supabase from "../config/supabase.js";

// Fetch all roles
export const getAllRoles = async () => {
  const { data, error } = await supabase
    .from("role")
    .select("*")
    .order("role_id");
  if (error) throw new Error(error.message);
  return data;
};

// Insert pending invite
export const insertPendingInvite = async (email, organization_id, role_id, inviterId) => {
  const { data, error } = await supabase
    .from("pending_invite")
    .insert([{
      email,
      organization_id,
      role_id,
      username: null,
      first_name: null,
      last_name: null,
      invited_by: inviterId,
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// Send actual email invite using Supabase Admin API
export const sendInviteEmail = async (email, redirectTo, inviteData) => {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: inviteData,
  });
  if (error) throw new Error(error.message);
  return data;
};

// Update invite result
export const updateInviteResult = async (invite_id, result) => {
  const { error } = await supabase
    .from("pending_invite")
    .update({ invite_result: result })
    .eq("invite_id", invite_id);

  if (error) throw new Error(error.message);
};
