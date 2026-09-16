import mongoose from "mongoose";

// Append-only flagged-event log, separate from ChatSession so the admin
// moderation queue can be queried/paginated fast without scanning all sessions.
const chatbotModerationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "seller", "delivery", "admin", "sub-admin", "anonymous"],
      required: true,
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    anonymousId: {
      type: String,
      default: null,
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      required: true,
    },
    flags: { type: [String], default: [] },
    reason: { type: String, default: "" },
    snippet: { type: String, default: "" }, // short redacted excerpt for admin context, not full transcript

    reviewStatus: {
      type: String,
      enum: ["open", "reviewed", "actioned", "dismissed"],
      default: "open",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
  },
  { timestamps: true },
);

chatbotModerationSchema.index({ riskLevel: 1, createdAt: -1 });
chatbotModerationSchema.index({ reviewStatus: 1, createdAt: -1 });
chatbotModerationSchema.index({ role: 1, createdAt: -1 });

export default mongoose.model("ChatbotModeration", chatbotModerationSchema);
