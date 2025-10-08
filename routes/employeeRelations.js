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

// --- GET ALL RELATIONS IN AN ORGANIZATION ---
router.get("/relations/all", verifyAuth, async (req, res) => {
  try {
    const { data: users, error: userError } = await supabase
      .from("app_user")
      .select("id, first_name, last_name, organization_id");

    if (userError) {
      console.error("Error fetching users:", userError.message);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    if (!users?.length) {
      return res.status(200).json({
        relations: {
          "employee-manager": [],
          "manager-hr": [],
        },
      });
    }

    const [{ data: empMgrData, error: empMgrError }, { data: mgrHrData, error: mgrHrError }] =
      await Promise.all([
        supabase.from("employee_manager").select("*"),
        supabase.from("manager_hr").select("*"),
      ]);

    if (empMgrError || mgrHrError) {
      console.error("Error fetching relations:", empMgrError || mgrHrError);
      return res.status(500).json({ error: "Failed to fetch relations" });
    }

    const relations = {
      "employee-manager": empMgrData || [],
      "manager-hr": mgrHrData || [],
    };

    res.status(200).json({ relations });
  } catch (err) {
    console.error("Unexpected error fetching all relations:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

export default router;
