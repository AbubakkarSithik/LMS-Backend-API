import express from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";
import { onboardUser } from "../controllers/onboardController.js";

const router = express.Router();
router.post("/", verifyAuth, onboardUser);

export default router;