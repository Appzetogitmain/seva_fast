import express from "express";
import { verifyToken, allowRoles } from "../../middleware/authMiddleware.js";
import {
  getWhatsAppConfigStatus,
  createCampaign,
  listCampaigns,
  getCampaign,
  cancelCampaign,
  getCampaignMessages,
  listWhatsAppMessages,
  verifyWhatsAppWebhook,
  receiveWhatsAppWebhook,
} from "./whatsapp.controller.js";

// Admin-only campaign management + message tracking, mounted at /api/admin/whatsapp
const whatsappAdminRouter = express.Router();
whatsappAdminRouter.use(verifyToken);
whatsappAdminRouter.use(allowRoles("admin"));

whatsappAdminRouter.get("/config-status", getWhatsAppConfigStatus);
whatsappAdminRouter.post("/campaigns", createCampaign);
whatsappAdminRouter.get("/campaigns", listCampaigns);
whatsappAdminRouter.get("/campaigns/:id", getCampaign);
whatsappAdminRouter.post("/campaigns/:id/cancel", cancelCampaign);
whatsappAdminRouter.get("/campaigns/:id/messages", getCampaignMessages);
whatsappAdminRouter.get("/messages", listWhatsAppMessages);

// Public Meta webhook, mounted at /api/whatsapp/webhook — no auth middleware
// (Meta verifies via hub.verify_token on GET and X-Hub-Signature-256 on POST).
const whatsappWebhookRouter = express.Router();
whatsappWebhookRouter.get("/webhook", verifyWhatsAppWebhook);
whatsappWebhookRouter.post("/webhook", receiveWhatsAppWebhook);

export { whatsappAdminRouter, whatsappWebhookRouter };
export default whatsappAdminRouter;
