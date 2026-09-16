import mongoose from "mongoose";

// Raw message retention is OFF by default (CHATBOT_RAW_MESSAGE_RETENTION_DAYS=0)
// — sessions are analyzed and summarized, then raw turns are discarded via TTL.
// Set the env var > 0 to keep raw transcripts around for debugging for that many days.
const RAW_RETENTION_DAYS = parseInt(process.env.CHATBOT_RAW_MESSAGE_RETENTION_DAYS || "0", 10);

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "model"],
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    retainUntil: {
      type: Date,
      default: () => new Date(Date.now() + Math.max(RAW_RETENTION_DAYS, 1) * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true },
);

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });
chatMessageSchema.index({ retainUntil: 1 }, { expireAfterSeconds: 0 });

export const isRawMessageRetentionEnabled = () => RAW_RETENTION_DAYS > 0;

export default mongoose.model("ChatMessage", chatMessageSchema);
