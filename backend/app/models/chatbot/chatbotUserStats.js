import mongoose from "mongoose";

// One rolling aggregate doc per identity — keeps admin dashboard cards cheap
// (no need to scan every ChatSession for per-user totals).
const chatbotUserStatsSchema = new mongoose.Schema(
  {
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

    totalSessions: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    lastSessionAt: { type: Date, default: null },

    highRiskCount: { type: Number, default: 0 },
    mediumRiskCount: { type: Number, default: 0 },
    interestHighCount: { type: Number, default: 0 },

    topCategories: [
      {
        category: String,
        count: Number,
      },
    ],
  },
  { timestamps: true },
);

chatbotUserStatsSchema.index({ role: 1, userRef: 1 }, { unique: true, sparse: true });
chatbotUserStatsSchema.index({ role: 1, anonymousId: 1 }, { unique: true, sparse: true });

export default mongoose.model("ChatbotUserStats", chatbotUserStatsSchema);
