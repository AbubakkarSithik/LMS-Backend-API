import express from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";
import {
  createLeave,
  approveLeave,
  rejectLeave,
  getLeaveAuditLog,
  getLeaveRequests,
  getLeaveHistory,
} from "../controllers/leaveRequestController.js";

const router = express.Router();

router.post("/request", verifyAuth, createLeave);
router.patch("/approve/:id", verifyAuth, approveLeave);
router.patch("/reject/:id", verifyAuth, rejectLeave);
router.get("/:id/auditlog", verifyAuth, getLeaveAuditLog);
router.get("/requests", verifyAuth, getLeaveRequests);
router.get("/history", verifyAuth, getLeaveHistory);

export default router;
