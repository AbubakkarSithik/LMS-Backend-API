import express from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";
import supabase from "../config/supabase.js"; 
import { verifyAdminForOrg } from "../middleware/verifyAdmin.js";

const router = express.Router();

/**
 * GET /app_user/me → get own profile
 */
router.get("/me", verifyAuth, async (req, res) => {
  const { id } = req.user;

  const { data, error } = await supabase
    .from("app_user")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/**
 * PUT /app_user/me → update own profile
 */
router.put("/me", verifyAuth, async (req, res) => {
  const { id } = req.user;
  const { username, first_name, last_name } = req.body;

  const { data, error } = await supabase
    .from("app_user")
    .update({ username, first_name, last_name })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/**
GET /app_user/:id 
 */
router.get("/:id", verifyAuth, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("app_user")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/**
 * ADMIN ONLY: GET /app_user/by-org/:organization_id
 * Returns all app_users belonging to an organization
 */
router.get("/org/:organization_id", verifyAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { organization_id } = req.params;
    const isAdmin = await verifyAdminForOrg(userId, organization_id);
    console.log("verifyAdminForOrg:", isAdmin);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
    const { data, error } = await supabase
      .from("app_user")
      .select("*")
      .eq("organization_id", Number(organization_id))
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    console.log("users by org:", data);
    res.json(data);
  } catch (err) {
    console.error("Error fetching users by org:", err);
    res.status(500).json({ error: "Server error" });
  }
});


/**
 * ADMIN ONLY: PUT /app_user/:id
 */
router.put("/:userId", verifyAuth, async (req, res) => {
  const { id } = req.user;
  const { userId } = req.params;
  const { role_id, organization_id, username, first_name, last_name } = req.body;
  const isAdmin = await verifyAdminForOrg(id, organization_id);
  console.log("verifyAdminForOrg:", isAdmin);
  if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

  const { data, error } = await supabase
    .from("app_user")
    .update({ role_id, username, first_name, last_name })
    .eq("id", userId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/**
 * ADMIN ONLY: DELETE /app_user/:id
 */
router.delete("/:id", verifyAuth, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("app_user").delete().eq("id", id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "User deleted successfully" });
});

export default router;
