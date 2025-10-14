import { verifyAdminForOrg } from "../middleware/verifyAdmin.js";
import {
  getOrganizationByUserId,
  getOrgIdForUser,
  getLeaveTypesByOrg,
  insertLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getHolidaysByOrg,
  insertHoliday,
  updateHoliday,
  deleteHoliday,
} from "../models/organizationModel.js";

/* ---------------- ORGANIZATION ---------------- */
export const getOrganization = async (req, res) => {
  try {
    const userId = req.user?.id;
    const org = await getOrganizationByUserId(userId);
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- LEAVE TYPES ---------------- */
export const getLeaveTypes = async (req, res) => {
  try {
    const orgId = await getOrgIdForUser(req.user?.id);
    const leaveTypes = await getLeaveTypesByOrg(orgId);
    res.json(leaveTypes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createLeaveType = async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId = await getOrgIdForUser(userId);

    const isAdmin = await verifyAdminForOrg(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { name, description, max_days_per_year } = req.body;
    const leaveType = await insertLeaveType(orgId, name, description, max_days_per_year);
    res.json(leaveType);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const editLeaveType = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, description, max_days_per_year } = req.body;

    const orgId = await getOrgIdForUser(userId);
    const isAdmin = await verifyAdminForOrg(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const updated = await updateLeaveType(id, { name, description, max_days_per_year });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const removeLeaveType = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const orgId = await getOrgIdForUser(userId);
    const isAdmin = await verifyAdminForOrg(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    await deleteLeaveType(id);
    res.json({ message: "Leave type deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- HOLIDAYS ---------------- */
export const getHolidays = async (req, res) => {
  try {
    const orgId = await getOrgIdForUser(req.user?.id);
    const holidays = await getHolidaysByOrg(orgId);
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createHoliday = async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId = await getOrgIdForUser(userId);
    const isAdmin = await verifyAdminForOrg(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const { holiday_date, name, is_recurring } = req.body;
    const holiday = await insertHoliday(orgId, holiday_date, name, is_recurring);
    res.json(holiday);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const editHoliday = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { holiday_date, name, is_recurring } = req.body;

    const orgId = await getOrgIdForUser(userId);
    const isAdmin = await verifyAdminForOrg(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    const updated = await updateHoliday(id, { holiday_date, name, is_recurring });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const removeHoliday = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const orgId = await getOrgIdForUser(userId);
    const isAdmin = await verifyAdminForOrg(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

    await deleteHoliday(id);
    res.json({ message: "Holiday deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
