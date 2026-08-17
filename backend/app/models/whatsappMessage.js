import mongoose from "mongoose";

export const WHATSAPP_MESSAGE_TYPES = [
  "order_placed",
  "out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "birthday_wish",
  "campaign",
  "other",
];

export const WHATSAPP_MESSAGE_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
];

const whatsappMessageSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    messageType: {
      type: String,
      enum: WHATSAPP_MESSAGE_TYPES,
      required: true,
      index: true,
    },
    templateName: {
      type: String,
      trim: true,
      default: "",
    },
    languageCode: {
      type: String,
      trim: true,
      default: "",
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    relatedCampaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppCampaign",
      default: null,
      index: true,
    },
    // Deterministic idempotency key, e.g. "order:ORD123:order_placed" or
    // "birthday:<customerId>:2026" or "campaign:<campaignId>:<customerId>".
    // A unique partial index on this field is the single source of truth
    // preventing duplicate sends for the same event/customer.
    dedupeKey: {
      type: String,
      default: "",
    },
    waMessageId: {
      type: String,
      default: "",
      index: true,
    },
    status: {
      type: String,
      enum: WHATSAPP_MESSAGE_STATUSES,
      default: "queued",
      index: true,
    },
    failureReason: {
      type: String,
      default: "",
    },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// MongoDB partial indexes only support a limited operator set ($eq, $exists,
// $gt/$gte/$lt/$lte, $type, $and) — $ne is NOT allowed and silently fails
// index creation (autoIndex logs the error but doesn't crash the app), so
// this must use $gt: "" instead of $ne: "" to exclude the empty-string default.
whatsappMessageSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string", $gt: "" } } },
);
whatsappMessageSchema.index({ customer: 1, messageType: 1, createdAt: -1 });
whatsappMessageSchema.index({ relatedCampaign: 1, status: 1 });
whatsappMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.WhatsAppMessage ||
  mongoose.model("WhatsAppMessage", whatsappMessageSchema);
