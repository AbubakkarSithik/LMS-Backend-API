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

  // fetch role name
  const { data: roleRow } = await supabase
    .from("role")
    .select("role_name")
    .eq("role_id", data.role_id)
    .single();

  if (!roleRow) return false;
  return roleRow.role_name === "Admin";
}

export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ??       // Your custom domain in production
    process?.env?.NEXT_PUBLIC_VERCEL_URL ??     // Automatically set by Vercel
    "http://localhost:5173/";                   // Fallback for local dev

  // Ensure it starts with http(s)
  url = url.startsWith("http") ? url : `https://${url}`;
  // Ensure trailing slash
  url = url.endsWith("/") ? url : `${url}/`;

  return url;
};