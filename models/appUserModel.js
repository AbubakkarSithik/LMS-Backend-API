import supabase from "../config/supabase.js";

export const getUserById = async (id) => {
  return await supabase.from("app_user").select("*").eq("id", id).single();
};

export const getUsersByOrganization = async (organization_id) => {
  return await supabase
    .from("app_user")
    .select("*")
    .eq("organization_id", Number(organization_id))
    .order("created_at", { ascending: false });
};

export const updateUserById = async (id, payload) => {
  return await supabase
    .from("app_user")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
};

export const deleteUserById = async (id) => {
  return await supabase.from("app_user").delete().eq("id", id);
};
