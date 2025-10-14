import express from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";
import {
  getOrganization,
  getLeaveTypes,
  createLeaveType,
  editLeaveType,
  removeLeaveType,
  getHolidays,
  createHoliday,
  editHoliday,
  removeHoliday,
} from "../controllers/organizationController.js";

const router = express.Router();

// Organization
router.get("/org", verifyAuth, getOrganization);

// Leave Types
router.get("/leave-types", verifyAuth, getLeaveTypes);
router.post("/leave-types", verifyAuth, createLeaveType);
router.put("/leave-types/:id", verifyAuth, editLeaveType);
router.delete("/leave-types/:id", verifyAuth, removeLeaveType);

// Holidays
router.get("/holidays", verifyAuth, getHolidays);
router.post("/holidays", verifyAuth, createHoliday);
router.put("/holidays/:id", verifyAuth, editHoliday);
router.delete("/holidays/:id", verifyAuth, removeHoliday);

export default router;
