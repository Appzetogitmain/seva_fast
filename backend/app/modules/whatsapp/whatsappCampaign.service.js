import Customer from "../../models/customer.js";
import WhatsAppCampaign from "../../models/whatsappCampaign.js";
import WhatsAppMessage from "../../models/whatsappMessage.js";
import { isValidE164Phone, normalizePhoneNumber, maskPhone } from "../../utils/phone.js";
import { sendWhatsAppTextMessage } from "./whatsapp.service.js";
import { getWhatsAppConfig } from "../../config/whatsapp.js";
import { WHATSAPP_MESSAGE_TYPES } from "./whatsapp.constants.js";
import { renderTemplate } from "./whatsapp.templates.js";
import logger from "../../services/logger.js";

async function resolveRecipients(campaign) {
  if (campaign.audienceType === "selected") {
    if (!campaign.targetCustomerIds?.length) return [];
    return Customer.find({
      _id: { $in: campaign.targetCustomerIds },
      isActive: true,
    })
      .select("_id name phone")
      .lean();
  }

  return Customer.find({ role: "user", isActive: true, isVerified: true })
    .select("_id name phone")
    .lean();
}

async function sendToRecipient(campaign, recipient) {
  const phone = normalizePhoneNumber(recipient.phone);

  if (!isValidE164Phone(phone)) {
    return "skipped";
  }

  const dedupeKey = `campaign:${campaign._id}:${recipient._id}`;
  let record;
  try {
    record = await WhatsAppMessage.create({
      customer: recipient._id,
      phone,
      messageType: WHATSAPP_MESSAGE_TYPES.CAMPAIGN,
      relatedCampaign: campaign._id,
      dedupeKey,
      status: "queued",
    });
  } catch (error) {
    if (error?.code === 11000) {
      // Already sent to this recipient for this campaign — skip, never resend.
      return "skipped";
    }
    logger.error("Failed to create WhatsApp campaign message record", {
      campaignId: String(campaign._id),
      message: error.message,
    });
    return "failed";
  }

  if (!getWhatsAppConfig()) {
    await WhatsAppMessage.updateOne(
      { _id: record._id },
      { $set: { status: "failed", failureReason: "WhatsApp is not configured" } },
    );
    return "failed";
  }

  try {
    const message = renderTemplate(campaign.message, { name: recipient.name || "there" });

    const result = await sendWhatsAppTextMessage({ to: phone, message });

    await WhatsAppMessage.updateOne(
      { _id: record._id },
      { $set: { status: "sent", waMessageId: result.waMessageId, sentAt: new Date() } },
    );
    return "sent";
  } catch (error) {
    await WhatsAppMessage.updateOne(
      { _id: record._id },
      { $set: { status: "failed", failureReason: error.message } },
    );
    logger.error("WhatsApp campaign message send failed", {
      campaignId: String(campaign._id),
      phone: maskPhone(phone),
      message: error.message,
    });
    return "failed";
  }
}

/**
 * Atomically claims the campaign (draft/scheduled -> sending) before doing
 * any work. If two triggers race (e.g. the immediate-send call right after
 * creation and a scheduler tick), only one wins the claim — the other is a
 * silent no-op — so a campaign can never be sent twice.
 */
export async function dispatchCampaign(campaignId) {
  const campaign = await WhatsAppCampaign.findOneAndUpdate(
    { _id: campaignId, status: { $in: ["draft", "scheduled"] } },
    { $set: { status: "sending", dispatchedAt: new Date() } },
    { new: true },
  );

  if (!campaign) {
    return null;
  }

  try {
    const recipients = await resolveRecipients(campaign);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const recipient of recipients) {
      const outcome = await sendToRecipient(campaign, recipient);
      if (outcome === "sent") sent += 1;
      else if (outcome === "failed") failed += 1;
      else skipped += 1;
    }

    const finalStatus = recipients.length === 0 ? "failed" : sent > 0 ? "sent" : "failed";

    await WhatsAppCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
          status: finalStatus,
          completedAt: new Date(),
          failureReason: recipients.length === 0 ? "No eligible recipients found" : "",
          "stats.totalRecipients": recipients.length,
          "stats.sent": sent,
          "stats.failed": failed,
          "stats.skipped": skipped,
        },
      },
    );

    return { totalRecipients: recipients.length, sent, failed, skipped };
  } catch (error) {
    await WhatsAppCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: "failed", failureReason: error.message, completedAt: new Date() } },
    );
    logger.error("WhatsApp campaign dispatch failed", {
      campaignId: String(campaignId),
      message: error.message,
    });
    throw error;
  }
}

export default { dispatchCampaign };
