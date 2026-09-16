import mongoose from "mongoose";

// One doc per (role, userRef) identity. Governs ONLY chatbot access —
// never the underlying account itself (that stays untouched per business rule).
const chatbotAccessControlSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "seller", "delivery", "admin", "sub-admin"],
      required: true,
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "TEMPORARILY_DISABLED", "PERMANENTLY_DISABLED"],
      default: "ACTIVE",
    },
    disabledAt: Date,
    disabledUntil: Date, // set only for TEMPORARILY_DISABLED; auto-reactivates once passed
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    actionedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true },
);

chatbotAccessControlSchema.index({ role: 1, userRef: 1 }, { unique: true });

export default mongoose.model("ChatbotAccessControl", chatbotAccessControlSchema);
