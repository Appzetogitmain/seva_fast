import WhatsAppCampaign from "../models/whatsappCampaign.js";
import { dispatchCampaign } from "../modules/whatsapp/whatsappCampaign.service.js";
import logger from "../services/logger.js";

export function isWhatsAppCampaignJobEnabled() {
  return String(process.env.WHATSAPP_CAMPAIGN_JOB_ENABLED ?? "true").toLowerCase() !== "false";
}

export function getWhatsAppCampaignJobInterval() {
  return parseInt(process.env.WHATSAPP_CAMPAIGN_JOB_INTERVAL_MS || "60000", 10);
}

export async function processScheduledWhatsAppCampaigns() {
  const now = new Date();
  // Stale-immediate recovery window: if the API process died right after
  // creating an "immediate" campaign but before the setImmediate dispatch
  // ran, pick it up here instead of leaving it stuck in "draft" forever.
  const staleImmediateCutoff = new Date(now.getTime() - 5 * 60 * 1000);

  const dueCampaigns = await WhatsAppCampaign.find({
    $or: [
      { status: "scheduled", scheduleType: "scheduled", scheduledAt: { $lte: now } },
      { status: "draft", scheduleType: "immediate", createdAt: { $lte: staleImmediateCutoff } },
    ],
  })
    .select("_id")
    .lean();

  let dispatched = 0;
  for (const campaign of dueCampaigns) {
    try {
      const result = await dispatchCampaign(campaign._id);
      if (result) dispatched += 1;
    } catch (error) {
      logger.error("Scheduled WhatsApp campaign dispatch failed", {
        campaignId: String(campaign._id),
        message: error.message,
      });
    }
  }

  if (dueCampaigns.length) {
    logger.info("WhatsApp campaign job completed", { due: dueCampaigns.length, dispatched });
  }

  return { due: dueCampaigns.length, dispatched };
}

export function getWhatsAppCampaignJobHandler() {
  return processScheduledWhatsAppCampaigns;
}

export default {
  isWhatsAppCampaignJobEnabled,
  getWhatsAppCampaignJobInterval,
  getWhatsAppCampaignJobHandler,
  processScheduledWhatsAppCampaigns,
};
