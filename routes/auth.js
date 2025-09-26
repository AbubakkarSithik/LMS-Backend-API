import express from "express";
import supabase from "../config/supabase.js";
import dotenv from "dotenv";
import { getURL } from "../middleware/verifyAdmin.js";
dotenv.config();

const router = express.Router();

// Helper: set session cookies
function setAuthCookies(res, session) {
  res.cookie("sb_access_token", session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  });

  res.cookie("sb_refresh_token", session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
}

// Signup
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getURL()}onboard-redirect`,
    },
  });

  if (error) return res.status(400).json({ error: error.message });

  if (data.session) {
    setAuthCookies(res, data.session);
  }

  res.json({ user: data.user });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });

  setAuthCookies(res, data.session);

  res.json({ user: data.user });
});

// Restore session from refresh token
router.get("/restore", async (req, res) => {
  const refreshToken = req.cookies.sb_refresh_token;
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return res.status(401).json({ error: error?.message || "Session expired" });
  }

  setAuthCookies(res, data.session);
  res.json({ user: data.user });
});

// Logout
router.post("/logout", async (req, res) => {
  res.clearCookie("sb_access_token");
  res.clearCookie("sb_refresh_token");
  res.json({ message: "Logged out successfully" });
});

export default router;