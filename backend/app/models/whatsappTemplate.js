import mongoose from "mongoose";

// One editable row per automated event type — these are the only message
// types the order/birthday dispatcher ever looks up (see whatsapp.templates.js).
export const WHATSAPP_TEMPLATE_TYPES = [
  "order_placed",
  "out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "wallet_update",
  "plan_purchased",
  "birthday_wish",
];

const whatsappTemplateSchema = new mongoose.Schema(
  {
    messageType: {
      type: String,
      enum: WHATSAPP_TEMPLATE_TYPES,
      required: true,
      unique: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.models.WhatsAppTemplate ||
  mongoose.model("WhatsAppTemplate", whatsappTemplateSchema);
