import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  adminListReferralRewards,
  adminApproveReferralReward,
  adminRejectReferralReward,
} from "../controller/referralRewardController.js";

const router = express.Router();

router.use(verifyToken);
router.use(allowRoles("admin"));

router.get("/", adminListReferralRewards);
router.patch("/:id/approve", adminApproveReferralReward);
router.patch("/:id/reject", adminRejectReferralReward);

export default router;
