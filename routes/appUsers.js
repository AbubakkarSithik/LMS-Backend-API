import express from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";
import {
  getMyProfile,
  updateMyProfile,
  getUserProfile,
  getUsersByOrg,
  updateUser,
  deleteUser,
} from "../controllers/appUserController.js";

const router = express.Router();

router.get("/me", verifyAuth, getMyProfile);
router.put("/me", verifyAuth, updateMyProfile);
router.get("/:id", verifyAuth, getUserProfile);
router.get("/org/:organization_id", verifyAuth, getUsersByOrg);
router.put("/:userId", verifyAuth, updateUser);
router.delete("/:id", verifyAuth, deleteUser);

export default router;
