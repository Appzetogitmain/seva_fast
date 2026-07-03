import mongoose from "mongoose";

const authActivityLogSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["customer", "seller", "admin", "sub-admin", "delivery"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["login", "logout"],
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      trim: true,
      default: "",
    },
    userEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    userPhone: {
      type: String,
      trim: true,
      default: "",
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

authActivityLogSchema.index({ createdAt: -1 });
authActivityLogSchema.index({ role: 1, action: 1, createdAt: -1 });

export default mongoose.models.AuthActivityLog ||
  mongoose.model("AuthActivityLog", authActivityLogSchema);
