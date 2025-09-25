import express from "express";
import supabase from "../config/supabase.js";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

// Only authenticated user can onboard
router.post("/", verifyAuth, async (req, res) => {
  try {
    const { org_name, subdomain, first_name, last_name, username } = req.body;
    const userId = req.user.sub; // Supabase Auth UUID

    // 1) Check if user already has an app_user (to prevent double onboarding)
    const { data: existingUser } = await supabase
      .from("app_user")
      .select("*")
      .eq("id", userId)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User already onboarded" });
    }

    // 2) Create organization
    const { data: org, error: orgError } = await supabase
      .from("organization")
      .insert([{ name: org_name, subdomain }])
      .select()
      .single();

    if (orgError) return res.status(400).json({ error: orgError.message });

    // 3) Get Admin role_id
    const { data: roleData, error: roleError } = await supabase
      .from("role")
      .select("role_id")
      .eq("role_name", "Admin")
      .single();

    if (roleError) return res.status(400).json({ error: roleError.message });

    // 4) Create app_user as Admin
    const { data: appUser, error: appUserError } = await supabase
      .from("app_user")
      .insert([{
        id: userId,
        organization_id: org.organization_id,
        role_id: roleData.role_id,
        first_name,
        last_name,
        username,
        email: req.user.email
      }])
      .select()
      .single();

    if (appUserError) return res.status(400).json({ error: appUserError.message });

    res.json({ message: "Organization and Admin user created", org, appUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;