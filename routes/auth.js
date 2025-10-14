import express from "express";
import {
  handleSignup,
  handleLogin,
  handleSetSession,
  handleSetPassword,
  handleRestoreSession,
  handleLogout,
} from "../controllers/authController.js";

const router = express.Router();

// AUTH ROUTES
router.post("/signup", handleSignup);
router.post("/login", handleLogin);
router.post("/set-session", handleSetSession);
router.post("/set-password", handleSetPassword);
router.get("/restore", handleRestoreSession);
router.post("/logout", handleLogout);

export default router;
