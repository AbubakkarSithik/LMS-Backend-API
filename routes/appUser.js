import express from "express";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "../middleware/auth.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Protect all routes in this file
router.use(verifyAuth);

// Create profile
router.post("/", async (req, res) => {
  const { id, name, department, role } = req.body;

  const { data, error } = await supabase
    .from("app_user")
    .insert([{ id, name, department, role }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Get all profiles
router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("app_user").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Get single profile
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("app_user").select("*").eq("id", id).single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Update profile
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, department, role } = req.body;

  const { data, error } = await supabase
    .from("app_user")
    .update({ name, department, role })
    .eq("id", id)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Delete profile
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("app_user").delete().eq("id", id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Profile deleted" });
});

export default router;