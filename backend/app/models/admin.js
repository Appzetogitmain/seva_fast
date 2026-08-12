import mongoose from "mongoose";
import bcrypt from "bcrypt";

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "sub-admin"],
      default: "admin",
    },
    profileImage: {
      type: String,
      trim: true,
      default: "",
    },
    assignedZones: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Zone",
      },
    ],
    // Header-level categories this sub-admin is responsible for.
    // Empty array means "all categories" (backward-compatible default).
    assignedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    // Per-sub-admin commission rate (%). When set, overrides the global
    // subAdminCommissionPercent from finance settings for this sub-admin's
    // assigned category items. null/undefined = use global rate.
    categoryCommissionRate: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    allowedPermissions: [
      {
        type: String,
      },
    ],
    isVerified: {
      type: Boolean,
      default: true,
    },

    lastLogin: Date,
  },
  { timestamps: true },
);

// Hash password before saving
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
adminSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Admin", adminSchema);
