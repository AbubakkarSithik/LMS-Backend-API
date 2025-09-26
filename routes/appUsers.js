import express from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";
import supabase from "../config/supabase.js"; 

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
 * ADMIN ONLY: GET /app_user/:id
 */
router.get("/:id", verifyAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

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
 * ADMIN ONLY: PUT /app_user/:id
 */
router.put("/:id", verifyAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.params;
  const { role_id, organization_id, username, first_name, last_name } = req.body;

  const { data, error } = await supabase
    .from("app_user")
    .update({ role_id, organization_id, username, first_name, last_name })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/**
 * ADMIN ONLY: DELETE /app_user/:id
 */
router.delete("/:id", verifyAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.params;

  const { error } = await supabase.from("app_user").delete().eq("id", id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "User deleted successfully" });
});

export default router;
