import express from "express";
import { verifyToken, allowRoles } from "../../middleware/authMiddleware.js";
import {
  getWhatsAppConfigStatus,
  createCampaign,
  listCampaigns,
  getCampaign,
  cancelCampaign,
  getCampaignMessages,
  listWhatsAppTemplates,
  updateWhatsAppTemplate,
  resetWhatsAppTemplate,
  listWhatsAppMessages,
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
whatsappAdminRouter.get("/templates", listWhatsAppTemplates);
whatsappAdminRouter.put("/templates/:messageType", updateWhatsAppTemplate);
whatsappAdminRouter.delete("/templates/:messageType", resetWhatsAppTemplate);

export { whatsappAdminRouter };
export default whatsappAdminRouter;
