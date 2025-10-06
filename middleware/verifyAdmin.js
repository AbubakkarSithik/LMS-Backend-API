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
export async function checkAdminAndGetOrgId(requestingUserId, targetUserId, res) {
  const { data: targetUser, error } = await supabase
    .from("app_user")
    .select("organization_id")
    .eq("id", targetUserId)
    .single();

  if (error || !targetUser?.organization_id) {
    console.error("Target user not found or missing organization:", error);
    res.status(404).json({ error: "Target user or organization not found." });
    return null;
  }

  const orgId = targetUser.organization_id;
  const isAdmin = await verifyAdminForOrg(requestingUserId, orgId);

  if (!isAdmin) {
    res.status(403).json({ error: "Forbidden: Only Admins can modify relationships." });
    return null;
  }
  return orgId;
}