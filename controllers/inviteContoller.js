import { verifyAdminForOrg } from "../middleware/verifyAdmin.js";
import {
  getAllRoles,
  insertPendingInvite,
  sendInviteEmail,
  updateInviteResult,
} from "../models/inviteModel.js";

/* ---------------- ROLES ---------------- */
export const listRoles = async (req, res) => {
  try {
    const roles = await getAllRoles();
    res.json(roles);
  } catch (err) {
    console.error("roles error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- INVITE USER ---------------- */
export const inviteUser = async (req, res) => {
  const inviterId = req.user?.id;
  const { email, role_id, organization_id, redirectTo } = req.body;

  if (!email || !role_id || !organization_id || !redirectTo) {
    return res.status(400).json({ error: "Insufficient Data!" });
  }

  try {
    const isAdmin = await verifyAdminForOrg(inviterId, organization_id);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden: admin only" });
    const pending = await insertPendingInvite(email, organization_id, role_id, inviterId);
    const inviteData = {
      organization_id,
      role_id,
      username: null,
      first_name: null,
      last_name: null,
      pending_invite_id: pending.invite_id,
    };

    console.log("redirect url:", redirectTo);

    let inviteRes;
    try {
      inviteRes = await sendInviteEmail(email, redirectTo, inviteData);
    } catch (inviteErr) {
      console.error("inviteUserByEmail error:", inviteErr.message);
      await updateInviteResult(pending.invite_id, { error: inviteErr.message });
      return res.status(500).json({ error: inviteErr.message });
    }

    await updateInviteResult(pending.invite_id, inviteRes);

    res.json({ message: "Invite sent", pending, inviteRes });
  } catch (err) {
    console.error("invite error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
