import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { recordLogoutActivity } from "../controller/authActivityController.js";

const router = express.Router();

router.post("/logout", verifyToken, recordLogoutActivity);

export default router;
