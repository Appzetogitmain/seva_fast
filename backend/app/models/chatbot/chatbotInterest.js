import mongoose from "mongoose";

// Denormalized interest log — one row per classified session that showed
// product/category interest. Powers "most discussed products/categories".
const chatbotInterestSchema = new mongoose.Schema(
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
    level: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      required: true,
    },
    product: { type: String, default: "" },
    category: { type: String, default: "" },
    details: { type: String, default: "" },
  },
  { timestamps: true },
);

chatbotInterestSchema.index({ category: 1, createdAt: -1 });
chatbotInterestSchema.index({ product: 1, createdAt: -1 });
chatbotInterestSchema.index({ level: 1, createdAt: -1 });

export default mongoose.model("ChatbotInterest", chatbotInterestSchema);
