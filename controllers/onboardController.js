import supabase from "../config/supabase.js";

// Onboard a new user and create an organization
export const onboardUser = async (req, res) => {
  try {
    const { org_name, subdomain, first_name, last_name, username } = req.body;
    const userId = req.user.id;   
    const userEmail = req.user.email;

    const { data: existingUser } = await supabase
      .from("app_user")
      .select("*")
      .eq("id", userId)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User already onboarded" });
    }

    const { data: org, error: orgError } = await supabase
      .from("organization")
      .insert([{ name: org_name, subdomain }])
      .select()
      .single();

    if (orgError) {
      return res.status(400).json({ error: orgError.message });
    }

    const { data: roleData, error: roleError } = await supabase
      .from("role")
      .select("role_id")
      .eq("role_name", "Admin")
      .single();

    if (roleError) {
      return res.status(400).json({ error: roleError.message });
    }

    const { data: appUser, error: appUserError } = await supabase
      .from("app_user")
      .insert([{
        id: userId,
        organization_id: org.organization_id,
        role_id: roleData.role_id,
        first_name,
        last_name,
        username,
        email: userEmail,
      }])
      .select()
      .single();

    if (appUserError) {
      return res.status(400).json({ error: appUserError.message });
    }

    res.json({ message: "Organization and Admin user created", org, appUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};