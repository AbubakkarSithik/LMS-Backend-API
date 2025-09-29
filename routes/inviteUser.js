import express from "express";
import supabase from "../config/supabase.js";
import { verifyAdminForOrg } from "../middleware/verifyAdmin.js";
import { verifyAuth } from "../middleware/verifyAuth.js";
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();

// GET /api/roles  -> list roles (private)
router.get("/roles", verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("role").select("*").order("role_id");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error("roles error", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/invite
 * Body: { email, role_id, organization_id, first_name?, last_name?, username? }
 * Only org Admins can invite.
 */
router.post("/invite-user", verifyAuth, async (req, res) => {
  const inviterId = req.user?.id;
  const { email, role_id, organization_id, redirectTo  } = req.body;

  if (!email || !role_id || !organization_id || !redirectTo) {
    return res.status(400).json({ error: "Insufficient Data!" });
  }

  try {
    // 1) verify caller is Admin of the organization
    const isAdmin = await verifyAdminForOrg(inviterId, organization_id);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden: admin only" });

    // 2) Insert pending_invite row (so you have a record)
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_invite")
      .insert([{
        email,
        organization_id,
        role_id,
        username: null,
        first_name: null,
        last_name: null,
        invited_by: inviterId
      }])
      .select()
      .single();

    if (pendingErr) {
      console.error("pending_invite insert error", pendingErr);
      return res.status(500).json({ error: pendingErr.message });
    }
   
    const inviteData = {
      organization_id,
      role_id,
      username : null,
      first_name : null,
      last_name: null,
      pending_invite_id: pending.invite_id, 
    };

    console.log("redirect url", redirectTo);
    const { data: inviteRes, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: redirectTo,
        data: inviteData, 
      }
    );

    if (inviteError) {
      console.error("inviteUserByEmail error:", inviteError);
      await supabase
        .from("pending_invite")
        .update({ invite_result: { error: inviteError } })
        .eq("invite_id", pending.invite_id);
      return res.status(500).json({ error: inviteError.message });
    }

    // 4) store invite result in pending_invite (optional)
    await supabase
      .from("pending_invite")
      .update({ invite_result: inviteRes })
      .eq("invite_id", pending.invite_id);

    // 5) respond success
    res.json({ message: "Invite sent", pending, inviteRes });
  } catch (err) {
    console.error("invite error", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;