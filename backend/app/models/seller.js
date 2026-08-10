import mongoose from "mongoose";
import bcrypt from "bcrypt";

const sellerSchema = new mongoose.Schema(
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
      required: true,
      unique: true,
    },
    whatsappNumber: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    shopName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    businessType: {
      type: String,
      enum: ["Proprietorship", "Partnership", "LLP", "Pvt. Ltd.", "Other"],
      trim: true,
    },

    sellerType: {
      type: String,
      enum: ["Retailer", "Wholesaler", "Manufacturer", "Service Provider"],
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    shiprocketPickupLocation: {
      type: String,
      trim: true,
    },

    panNumber: { type: String, trim: true, uppercase: true },
    aadhaarNumber: { type: String, trim: true },
    gstinNumber: { type: String, trim: true, uppercase: true },
    udyamNumber: { type: String, trim: true },

    bankDetails: {
      accountHolderName: { type: String, trim: true },
      bankName: { type: String, trim: true },
      branch: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
    },

    businessInfo: {
      yearsInBusiness: { type: Number },
      expectedMonthlyOrders: { type: String, trim: true },
      pickupAddress: { type: String, trim: true },
    },

    documents: {
      tradeLicense: { type: String, trim: true },
      gstCertificate: { type: String, trim: true },
      idProof: { type: String, trim: true },
      panCard: { type: String, trim: true },
      addressProof: { type: String, trim: true },
      cancelledCheque: { type: String, trim: true },
      businessRegistration: { type: String, trim: true },
      fssaiLicense: { type: String, trim: true },
      other: { type: String, trim: true },
    },

    role: {
      type: String,
      default: "seller",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    applicationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    reviewedAt: {
      type: Date,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    officialKycDocumentUrl: {
      type: String,
      trim: true,
    },

    kycUploadedAt: {
      type: Date,
    },

    certificate: {
      certificateNo: { type: String, trim: true },
      sellerId: { type: String, trim: true },
      sellerName: { type: String, trim: true },
      shopName: { type: String, trim: true },
      category: { type: String, trim: true },
      cityLocation: { type: String, trim: true },
      issueDate: { type: String, trim: true },
      validFrom: { type: String, trim: true },
      validUntil: { type: String, trim: true },
      signatoryName: { type: String, trim: true, default: "SEVAFAST Operations" },
      issuedAt: { type: Date, default: Date.now },
      accepted: { type: Boolean, default: false },
      acceptedAt: { type: Date },
      acceptedIp: { type: String, trim: true },
    },

    isActive: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    sellerCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    serviceRadius: {
      type: Number,
      default: 5, // Default 5km
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },
    onboardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acceptsPhotoOrders: {
      type: Boolean,
      default: false,
    },
    commissionModel: {
      type: String,
      enum: ['CATEGORY_WISE', 'PLAN_BASED', 'ONE_TIME'],
      default: 'CATEGORY_WISE',
    },
    oneTimeChargeAmount: {
      type: Number,
      default: 0,
    },
    oneTimeChargePaid: {
      type: Boolean,
      default: false,
    },
    oneTimeChargeInterval: {
      type: String,
      enum: ['monthly', 'quarterly', 'half_yearly', 'yearly'],
      default: 'monthly',
    },
    subscription: {
      planId: { type: mongoose.Schema.Types.ObjectId, ref: "SellerPlan" },
      planName: { type: String, trim: true },
      pricePaid: { type: Number, default: 0 },
      validityDays: { type: Number, default: 30 },
      purchasedAt: { type: Date },
      expiresAt: { type: Date },
      paymentReference: { type: String, trim: true },
      status: { type: String, enum: ['active', 'expired', 'none'], default: 'none' },
    },
    categoryCommissionOverrides: {
      type: Map,
      of: Number,
      default: {},
    },
    lastLogin: Date,
  },
  { timestamps: true },
);

sellerSchema.index({ location: "2dsphere" });
sellerSchema.index({ isActive: 1, isVerified: 1 });

// Generate sellerCode and Hash password before saving
sellerSchema.pre("save", async function (next) {
  if (!this.sellerCode) {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.sellerCode = `SV-${randomCode}`;
  }
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
sellerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Seller", sellerSchema);
