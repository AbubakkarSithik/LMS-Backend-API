import {
  signUpUser,
  loginUser,
  getUserByAccessToken,
  updateUserPassword,
  refreshSession,
} from "../models/authModel.js";
import dotenv from "dotenv";
dotenv.config();

function setAuthCookies(res, session) {
  res.cookie("sb_access_token", session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 1000 * 60 * 60 * 24,
  });

  res.cookie("sb_refresh_token", session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

// --- SIGNUP CONTROLLER ---
export const handleSignup = async (req, res) => {
  const { email, password, redirectTo } = req.body;
  try {
    const { data, error } = await signUpUser(email, password, redirectTo);
    if (error) return res.status(400).json({ error: error.message });

    if (data.session) setAuthCookies(res, data.session);
    res.json({ user: data.user });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// --- LOGIN CONTROLLER ---
export const handleLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await loginUser(email, password);
    if (error) return res.status(400).json({ error: error.message });

    setAuthCookies(res, data.session);
    res.json({ user: data.user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// --- SET SESSION CONTROLLER ---
export const handleSetSession = async (req, res) => {
  const { access_token, refresh_token } = req.body;
  if (!access_token || !refresh_token)
    return res.status(400).json({ error: "Missing tokens" });

  try {
    const { data: userData, error } = await getUserByAccessToken(access_token);
    if (error || !userData?.user)
      return res
        .status(401)
        .json({ error: error?.message || "Invalid access token" });

    const session = {
      access_token,
      refresh_token,
      token_type: "bearer",
      expires_in: 60 * 60,
      user: userData.user,
    };

    setAuthCookies(res, session);
    res.json({ user: userData.user, session });
  } catch (err) {
    console.error("Set-session error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// --- SET PASSWORD CONTROLLER ---
export const handleSetPassword = async (req, res) => {
  const { new_password } = req.body;
  const sb_access_token = req.cookies.sb_access_token;
  const sb_refresh_token = req.cookies.sb_refresh_token;

  if (!sb_access_token || !sb_refresh_token || !new_password)
    return res
      .status(400)
      .json({ error: "Missing access_token, refresh_token or new_password" });

  try {
    const { data: updateData, error: updateError } = await updateUserPassword(
      new_password
    );
    if (updateError)
      return res.status(400).json({ error: updateError.message });

    const { data: sessionData, error: refreshError } = await refreshSession(
      sb_refresh_token
    );
    if (refreshError || !sessionData.session)
      return res
        .status(401)
        .json({ error: refreshError?.message || "Failed to refresh session" });

    setAuthCookies(res, sessionData.session);

    res.json({
      message: "Password updated and user logged in successfully",
      user: sessionData.user,
      session: sessionData.session,
    });
  } catch (err) {
    console.error("Set-password error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// --- RESTORE SESSION CONTROLLER ---
export const handleRestoreSession = async (req, res) => {
  const refreshToken = req.cookies.sb_refresh_token;
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  try {
    const { data, error } = await refreshSession(refreshToken);
    if (error || !data.session)
      return res
        .status(401)
        .json({ error: error?.message || "Session expired" });

    setAuthCookies(res, data.session);
    res.json({ session: data.session, user: data.user });
  } catch (err) {
    console.error("Restore-session error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// --- LOGOUT CONTROLLER ---
export const handleLogout = async (req, res) => {
  try {
    res.clearCookie("sb_access_token");
    res.clearCookie("sb_refresh_token");
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
