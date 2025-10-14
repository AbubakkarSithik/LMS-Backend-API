import {
  getUserById,
  getUsersByOrganization,
  updateUserById,
  deleteUserById,
} from "../models/appUserModel.js";
import { verifyAdminForOrg, verifyHRForOrg } from "../middleware/verifyAdmin.js";

/**GET /app_user/me*/
export const getMyProfile = async (req, res) => {
  const { id } = req.user;
  const { data, error } = await getUserById(id);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

/**PUT /app_user/me*/
export const updateMyProfile = async (req, res) => {
  const { id } = req.user;
  const { username, first_name, last_name } = req.body;
  const { data, error } = await updateUserById(id, {
    username,
    first_name,
    last_name,
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

/*** GET /app_user/:id*/
export const getUserProfile = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await getUserById(id);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

/*** GET /app_user/org/:organization_id Accessible by Admins and HR*/
export const getUsersByOrg = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { organization_id } = req.params;

    const isAdmin = await verifyAdminForOrg(userId, organization_id);
    const isHR = await verifyHRForOrg(userId, organization_id);

    if (!isAdmin && !isHR)
      return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await getUsersByOrganization(organization_id);
    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error("Error fetching users by org:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/*** PUT /app_user/:userId * Accessible by Admins or HR*/
export const updateUser = async (req, res) => {
  const { id } = req.user;
  const { userId } = req.params;
  const { role_id, organization_id, username, first_name, last_name } =
    req.body;

  const isAdmin = await verifyAdminForOrg(id, organization_id);
  const isHR = await verifyHRForOrg(id, organization_id);

  if (!isAdmin && !isHR)
    return res.status(403).json({ error: "Forbidden" });

  const payload = { username, first_name, last_name };
  if (isAdmin && role_id) payload.role_id = role_id;

  const { data, error } = await updateUserById(userId, payload);
  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
};

/*** DELETE /app_user/:id* Accessible by Admin only*/
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  const { error } = await deleteUserById(id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "User deleted successfully" });
};
