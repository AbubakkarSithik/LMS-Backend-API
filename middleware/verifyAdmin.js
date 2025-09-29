import supabase from "../config/supabase.js";

export async function verifyAdminForOrg(userId, organizationId) {
  const { data, error } = await supabase
    .from("app_user")
    .select("role_id")
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .single();

  if (error) {
    console.error("verifyAdminForOrg error:", error);
    return false;
  }
  if (!data) return false;

  const { data: roleRow } = await supabase
    .from("role")
    .select("role_name")
    .eq("role_id", data.role_id)
    .single();

  if (!roleRow) return false;
  return roleRow.role_name === "Admin";
}