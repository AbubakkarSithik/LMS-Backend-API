import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// create supabase client per route (or pass it from index.js)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Signup
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  res.json({ user: data.user, session: data.session });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  res.json({ user: data.user, session: data.session });
});

// Logout
router.post("/logout", async (req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "Logged out successfully" });
});

export default router;