import mongoose from "mongoose";

export const WHATSAPP_CAMPAIGN_TYPES = [
  "offer",
  "sale",
  "new_launch",
  "new_service",
  "festival",
  "announcement",
  "custom",
];

export const WHATSAPP_AUDIENCE_TYPES = ["all", "selected"];
export const WHATSAPP_SCHEDULE_TYPES = ["immediate", "scheduled"];
export const WHATSAPP_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

const whatsappCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    campaignType: {
      type: String,
      enum: WHATSAPP_CAMPAIGN_TYPES,
      default: "announcement",
    },
    // Admin-entered description of the campaign content (kept as a readable
    // record even though the actual outbound message is the approved template).
    message: {
      type: String,
      trim: true,
      default: "",
    },
    // Meta-approved template name/language — required for business-initiated sends.
    templateName: {
      type: String,
      required: true,
      trim: true,
    },
    languageCode: {
      type: String,
      trim: true,
      default: "",
    },
    // Ordered values for the template body's {{1}}, {{2}}... placeholders,
    // appended after the auto-injected recipient name.
    bodyParams: {
      type: [String],
      default: [],
    },
    mediaUrl: {
      type: String,
      trim: true,
      default: "",
    },
    audienceType: {
      type: String,
      enum: WHATSAPP_AUDIENCE_TYPES,
      required: true,
    },
    targetCustomerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    scheduleType: {
      type: String,
      enum: WHATSAPP_SCHEDULE_TYPES,
      default: "immediate",
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: WHATSAPP_CAMPAIGN_STATUSES,
      default: "draft",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    stats: {
      totalRecipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    dispatchedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failureReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

whatsappCampaignSchema.index({ status: 1, scheduleType: 1, scheduledAt: 1 });
whatsappCampaignSchema.index({ status: 1, scheduleType: 1, createdAt: 1 });

export default mongoose.models.WhatsAppCampaign ||
  mongoose.model("WhatsAppCampaign", whatsappCampaignSchema);
