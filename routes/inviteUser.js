import express from "express";
import dotenv from "dotenv";
import { verifyAuth } from "../middleware/verifyAuth.js";
import { listRoles, inviteUser } from "../controllers/inviteContoller.js";

dotenv.config();
const router = express.Router();

// GET /api/roles  -> list all roles (private)
router.get("/roles", verifyAuth, listRoles);

// POST /api/invite-user -> Admins only
router.post("/invite-user", verifyAuth, inviteUser);

export default router;
