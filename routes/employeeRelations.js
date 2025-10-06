import { Router } from "express";
import supabase from "../config/supabase.js";
import {verifyAuth }from "../middleware/verifyAuth.js";
import { checkAdminAndGetOrgId } from "../middleware/verifyAdmin.js";

const router = Router();

// --- EMPLOYEE MANAGER OPERATIONS ---
router.post("/employee-manager", verifyAuth, async (req, res) => {
  const { employee_id, manager_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: "Missing employee_id." });
  
  if (!(await checkAdminAndGetOrgId(req.user.id, employee_id, res))) return;

  const { data, error } = await supabase
    .from("employee_manager")
    .upsert({ employee_id, manager_id }, { onConflict: "employee_id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.delete("/employee-manager/:employee_id", verifyAuth, async (req, res) => {
  const employee_id = req.params.employee_id;
  
  if (!(await checkAdminAndGetOrgId(req.user.id, employee_id, res))) return;

  const { error } = await supabase
    .from("employee_manager")
    .delete()
    .eq("employee_id", employee_id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// --- HR ADMIN OPERATIONS ---
router.post("/hr-admin", verifyAuth, async (req, res) => {
  const { hr_id, admin_id } = req.body;
  if (!hr_id) return res.status(400).json({ error: "Missing hr_id." });
  
  if (!(await checkAdminAndGetOrgId(req.user.id, hr_id, res))) return;

  const { data, error } = await supabase
    .from("hr_admin")
    .upsert({ hr_id, admin_id }, { onConflict: "hr_id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.delete("/hr-admin/:hr_id", verifyAuth, async (req, res) => {
  const hr_id = req.params.hr_id;
  
  if (!(await checkAdminAndGetOrgId(req.user.id, hr_id, res))) return;

  const { error } = await supabase
    .from("hr_admin")
    .delete()
    .eq("hr_id", hr_id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// --- MANAGER HR OPERATIONS ---
router.post("/manager-hr", verifyAuth, async (req, res) => {
  const { manager_id, hr_id } = req.body;
  if (!manager_id) return res.status(400).json({ error: "Missing manager_id." });
  
  if (!(await checkAdminAndGetOrgId(req.user.id, manager_id, res))) return;

  const { data, error } = await supabase
    .from("manager_hr")
    .upsert({ manager_id, hr_id }, { onConflict: "manager_id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.delete("/manager-hr/:manager_id", verifyAuth, async (req, res) => {
  const manager_id = req.params.manager_id;
  
  if (!(await checkAdminAndGetOrgId(req.user.id, manager_id, res))) return;

  const { error } = await supabase
    .from("manager_hr")
    .delete()
    .eq("manager_id", manager_id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// --- READ ENDPOINT (Accessible to all authenticated users for context) ---

router.get("/relations/:table/:id", verifyAuth, async (req, res) => {
  const { table, id } = req.params;
  let keyField;

  switch (table) {
    case 'employee-manager': keyField = 'employee_id'; break;
    case 'hr-admin': keyField = 'hr_id'; break;
    case 'manager-hr': keyField = 'manager_id'; break;
    default: return res.status(400).json({ error: "Invalid table name." });
  }

  const { data, error } = await supabase
    .from(table.replace('-', '_'))
    .select("*")
    .eq(keyField, id)
    .single();
    
  if (error && error.code !== 'PGRST116') { 
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data || {});
});

export default router;
