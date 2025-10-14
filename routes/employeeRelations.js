import { Router } from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";
import {
  createOrUpdateEmployeeManager,
  removeEmployeeManager,
  createOrUpdateHrAdmin,
  removeHrAdmin,
  createOrUpdateManagerHr,
  removeManagerHr,
  getAllRelations,
} from "../controllers/relationsController.js";

const router = Router();

// EMPLOYEE-MANAGER ROUTES
router.post("/employee-manager", verifyAuth, createOrUpdateEmployeeManager);
router.delete("/employee-manager/:employee_id", verifyAuth, removeEmployeeManager);

// HR-ADMIN ROUTES
router.post("/hr-admin", verifyAuth, createOrUpdateHrAdmin);
router.delete("/hr-admin/:hr_id", verifyAuth, removeHrAdmin);

// MANAGER-HR ROUTES
router.post("/manager-hr", verifyAuth, createOrUpdateManagerHr);
router.delete("/manager-hr/:manager_id", verifyAuth, removeManagerHr);

// GET ALL RELATIONS
router.get("/relations/all", verifyAuth, getAllRelations);

export default router;
