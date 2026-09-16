import mongoose from "mongoose";

const CHAT_RETENTION_DAYS = parseInt(process.env.CHATBOT_SESSION_RETENTION_DAYS || "180", 10);

const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "seller", "delivery", "admin", "sub-admin", "anonymous"],
      required: true,
      index: true,
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    anonymousId: {
      type: String,
      default: null,
    },

    startedAt: { type: Date, default: Date.now },
    lastMessageAt: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
    },

    // Populated asynchronously by the classification pipeline. Absent until
    // the first classification pass runs (not every raw turn is classified).
    summary: { type: String, default: "" },
    intent: { type: String, default: "" },
    intentCategory: { type: String, default: "" },

    interest: {
      level: {
        type: String,
        enum: ["NONE", "LOW", "MEDIUM", "HIGH"],
        default: "NONE",
      },
      product: { type: String, default: "" },
      category: { type: String, default: "" },
      details: { type: String, default: "" },
    },

    moderation: {
      riskLevel: {
        type: String,
        enum: ["NONE", "LOW", "MEDIUM", "HIGH"],
        default: "NONE",
      },
      flags: { type: [String], default: [] },
      reason: { type: String, default: "" },
    },

    lastClassifiedAt: { type: Date, default: null },
    lastClassifiedMessageCount: { type: Number, default: 0 },

    retainUntil: {
      type: Date,
      default: () => new Date(Date.now() + CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true },
);

chatSessionSchema.index({ role: 1, createdAt: -1 });
chatSessionSchema.index({ "moderation.riskLevel": 1, createdAt: -1 });
chatSessionSchema.index({ "interest.level": 1, createdAt: -1 });
chatSessionSchema.index({ retainUntil: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("ChatSession", chatSessionSchema);
