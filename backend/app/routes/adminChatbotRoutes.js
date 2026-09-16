import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getOverview,
  listSessions,
  getSessionDetail,
  listFlagged,
  reviewFlagged,
} from "../controller/admin/chatbotAnalyticsController.js";
import {
  getAccessStatus,
  disableAccess,
  enableAccess,
} from "../controller/admin/chatbotAccessController.js";

const router = express.Router();

router.use(verifyToken, allowRoles("admin"));

router.get("/analytics/overview", getOverview);
router.get("/sessions", listSessions);
router.get("/sessions/:sessionId", getSessionDetail);
router.get("/flagged", listFlagged);
router.patch("/flagged/:id", reviewFlagged);

router.get("/access/:role/:userId", getAccessStatus);
router.post("/access/:role/:userId/disable", disableAccess);
router.post("/access/:role/:userId/enable", enableAccess);

export default router;
