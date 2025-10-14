import {
  upsertEmployeeManager,
  deleteEmployeeManager,
  upsertHrAdmin,
  deleteHrAdmin,
  upsertManagerHr,
  deleteManagerHr,
  fetchUsers,
  fetchRelations,
} from "../models/relationsModel.js";
import { checkAdminAndGetOrgId } from "../middleware/verifyAdmin.js";

// --- EMPLOYEE MANAGER CONTROLLERS ---
export const createOrUpdateEmployeeManager = async (req, res) => {
  const { employee_id, manager_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: "Missing employee_id." });

  if (!(await checkAdminAndGetOrgId(req.user.id, employee_id, res))) return;

  const { data, error } = await upsertEmployeeManager(employee_id, manager_id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};

export const removeEmployeeManager = async (req, res) => {
  const { employee_id } = req.params;
  if (!(await checkAdminAndGetOrgId(req.user.id, employee_id, res))) return;

  const { error } = await deleteEmployeeManager(employee_id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
};

// --- HR ADMIN CONTROLLERS ---
export const createOrUpdateHrAdmin = async (req, res) => {
  const { hr_id, admin_id } = req.body;
  if (!hr_id) return res.status(400).json({ error: "Missing hr_id." });

  if (!(await checkAdminAndGetOrgId(req.user.id, hr_id, res))) return;

  const { data, error } = await upsertHrAdmin(hr_id, admin_id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};

export const removeHrAdmin = async (req, res) => {
  const { hr_id } = req.params;
  if (!(await checkAdminAndGetOrgId(req.user.id, hr_id, res))) return;

  const { error } = await deleteHrAdmin(hr_id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
};

// --- MANAGER HR CONTROLLERS ---
export const createOrUpdateManagerHr = async (req, res) => {
  const { manager_id, hr_id } = req.body;
  if (!manager_id) return res.status(400).json({ error: "Missing manager_id." });

  if (!(await checkAdminAndGetOrgId(req.user.id, manager_id, res))) return;

  const { data, error } = await upsertManagerHr(manager_id, hr_id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};

export const removeManagerHr = async (req, res) => {
  const { manager_id } = req.params;
  if (!(await checkAdminAndGetOrgId(req.user.id, manager_id, res))) return;

  const { error } = await deleteManagerHr(manager_id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
};

// --- GET ALL RELATIONS CONTROLLER ---
export const getAllRelations = async (req, res) => {
  try {
    const { data: users, error: userError } = await fetchUsers();
    if (userError) return res.status(500).json({ error: "Failed to fetch users" });

    if (!users?.length) {
      return res.status(200).json({
        relations: { "employee-manager": [], "manager-hr": [] },
      });
    }

    const { empMgr, mgrHr } = await fetchRelations();
    if (empMgr.error || mgrHr.error) {
      return res.status(500).json({ error: "Failed to fetch relations" });
    }

    const relations = {
      "employee-manager": empMgr.data || [],
      "manager-hr": mgrHr.data || [],
    };

    res.status(200).json({ relations });
  } catch (err) {
    console.error("Unexpected error fetching all relations:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
};
