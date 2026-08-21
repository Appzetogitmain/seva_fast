import mongoose from "mongoose";
import {
    ALL_DELIVERY_PRICING_MODES,
    ALL_HANDLING_FEE_STRATEGIES,
} from "../constants/finance.js";

const settingSchema = new mongoose.Schema(
    {
        // General
        appName: {
            type: String,
            default: "Seva Fast",
        },
        supportEmail: {
            type: String,
            default: "support@sevafast.com",
        },
        supportPhone: {
            type: String,
            default: "",
        },
        currencySymbol: {
            type: String,
            default: "₹",
        },
        currencyCode: {
            type: String,
            default: "INR",
        },
        timezone: {
            type: String,
            default: "Asia/Kolkata",
        },

        // Branding
        logoUrl: String,
        faviconUrl: String,
        primaryColor: {
            type: String,
            default: "#0ea5e9",
        },
        secondaryColor: {
            type: String,
            default: "#64748b",
        },

        // Seller certificate — global signatory signature & official seal, used on every seller's certificate
        signatureImageUrl: {
            type: String,
            default: "",
        },
        sealImageUrl: {
            type: String,
            default: "",
        },

        // Legal
        companyName: String,
        taxId: String,
        address: String,
        termsAndConditions: {
            type: String,
            default: "",
        },
        privacyPolicy: {
            type: String,
            default: "",
        },
        returnPolicy: {
            type: String,
            default: "",
        },
        sellerTermsAndConditions: {
            type: String,
            default: "",
        },
        sellerPrivacyPolicy: {
            type: String,
            default: "",
        },
        deliveryTermsAndConditions: {
            type: String,
            default: "",
        },
        deliveryPrivacyPolicy: {
            type: String,
            default: "",
        },

        // COD Online QR collection (shown to customer by delivery partner)
        adminPaymentQrUrl: {
            type: String,
            default: "",
        },
        adminUpiId: {
            type: String,
            default: "",
        },
        adminUpiName: {
            type: String,
            default: "",
        },

        // Social
        facebook: String,
        twitter: String,
        instagram: String,
        linkedin: String,
        youtube: String,

        // Apps
        playStoreLink: String,
        appStoreLink: String,

        // SEO
        metaTitle: String,
        metaDescription: String,
        metaKeywords: String,
        keywords: [{ type: String }], // Array for structured SEO keywords

        // Optional: multi-tenant (null = default tenant)
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },

        // Returns / logistics configuration
        returnDeliveryCommission: {
            // Flat amount per return pickup, paid by seller
            type: Number,
            default: 0,
        },

        /**
         * Finance / delivery pricing rules (single source of truth).
         * Existing keys are kept for backward compatibility.
         */
        deliveryPricingMode: {
            type: String,
            enum: ALL_DELIVERY_PRICING_MODES,
            default: "distance_based",
        },
        pricingMode: {
            type: String,
            enum: ALL_DELIVERY_PRICING_MODES,
            default: "distance_based",
        },
        customerBaseDeliveryFee: {
            type: Number,
            default: 30,
            min: 0,
        },
        riderBasePayout: {
            type: Number,
            default: 30,
            min: 0,
        },
        baseDeliveryCharge: {
            type: Number,
            default: 30,
            min: 0,
        },
        baseDistanceCapacityKm: {
            type: Number,
            default: 0.5,
            min: 0,
        },
        incrementalKmSurcharge: {
            type: Number,
            default: 10,
            min: 0,
        },
        deliveryPartnerRatePerKm: {
            type: Number,
            default: 5,
            min: 0,
        },
        fleetCommissionRatePerKm: {
            type: Number,
            default: 5,
            min: 0,
        },
        fixedDeliveryFee: {
            type: Number,
            default: 30,
            min: 0,
        },
        minimumOrderValue: {
            type: Number,
            default: 0,
            min: 0,
        },
        freeDeliveryThreshold: {
            type: Number,
            default: 0,
            min: 0,
        },
        handlingFeeStrategy: {
            type: String,
            enum: ALL_HANDLING_FEE_STRATEGIES,
            default: "highest_category_fee",
        },
        codEnabled: {
            type: Boolean,
            default: true,
        },
        onlineEnabled: {
            type: Boolean,
            default: true,
        },
        lowStockAlertsEnabled: {
            type: Boolean,
            default: true,
        },
        productApproval: {
            sellerCreateRequiresApproval: {
                type: Boolean,
                default: false,
            },
            sellerEditRequiresApproval: {
                type: Boolean,
                default: false,
            },
        },
        // Commission and Charges Configuration
        adminCommissionPercent: {
            type: Number,
            default: 5,
        },
        technicalChargePercent: {
            type: Number,
            default: 5,
        },
        subAdminCommissionPercent: {
            type: Number,
            default: 10,
        },
        fieldWorkerCommissionPercent: {
            type: Number,
            default: 5,
        },
        goldCardMemberDiscountPercent: {
            type: Number,
            default: 10,
        },
        silverCardMemberDiscountPercent: {
            type: Number,
            default: 5,
        },
        bronzeCardMemberDiscountPercent: {
            type: Number,
            default: 2.5,
        },
        directSlabCommissionPercent: {
            type: Number,
            default: 25,
        },
        deductShippingBeforeCommission: {
            type: Boolean,
            default: true,
        },
        advertiseChargePercent: {
            type: Number,
            default: 5,
        },
        siteCashbackPercent: {
            type: Number,
            default: 15,
        },
        otherMaintenancePercent: {
            type: Number,
            default: 7.5,
        },
        affiliateMarketingPercent: {
            type: Number,
            default: 5,
        },
        professionalAdListingFee: {
            type: Number,
            default: 499,
        },
        professionalAdListingFeePhoto: {
            type: Number,
            default: 499,
        },
        professionalAdListingFeeVideo: {
            type: Number,
            default: 999,
        },
        platformAdFeePhoto: {
            type: Number,
            default: 999,
        },
        platformAdFeeVideo: {
            type: Number,
            default: 1999,
        },
        platformAdListingFee: {
            type: Number,
            default: 999,
        },
        professionalAdValidityDays: {
            type: Number,
            default: 30,
        },
        professionalAdSearchRadiusKm: {
            type: Number,
            default: 15,
        },
        /**
         * Slab-based customer delivery fee (distance x weight x order value).
         * Replaces the old linear base+per-km formula for `distance_based` mode.
         * maxKm: null means open-ended (e.g. "15+ km"). freeAboveOrderValue: null
         * means this slab is never free regardless of order value.
         */
        deliveryFeeSlabs: {
            type: [
                {
                    _id: false,
                    minKm: { type: Number, required: true, min: 0 },
                    maxKm: { type: Number, default: null, min: 0 },
                    fee: { type: Number, required: true, min: 0 },
                    freeAboveOrderValue: { type: Number, default: null, min: 0 },
                },
            ],
            default: () => [
                { minKm: 0, maxKm: 5, fee: 40, freeAboveOrderValue: 500 },
                { minKm: 5, maxKm: 10, fee: 60, freeAboveOrderValue: null },
                { minKm: 10, maxKm: 15, fee: 80, freeAboveOrderValue: null },
                { minKm: 15, maxKm: null, fee: 100, freeAboveOrderValue: null },
            ],
        },
        deliveryFeeBaseWeightKg: {
            type: Number,
            default: 2,
            min: 0,
        },
        deliveryFeeExtraFeePerKg: {
            type: Number,
            default: 10,
            min: 0,
        },
        expressDeliveryEnabled: {
            type: Boolean,
            default: true,
        },
        expressDeliveryFee: {
            type: Number,
            default: 150,
            min: 0,
        },
        expressDeliveryMaxWeightKg: {
            type: Number,
            default: 5,
            min: 0,
        },

        /**
         * Slab-based delivery partner earning. Independently configured from
         * the customer fee above — admin sets the platform's margin by how
         * these two tables differ. Always paid in full regardless of any
         * customer-side discount/free-delivery promo; admin absorbs the gap.
         */
        riderEarningSlabs: {
            type: [
                {
                    _id: false,
                    minKm: { type: Number, required: true, min: 0 },
                    maxKm: { type: Number, default: null, min: 0 },
                    earning: { type: Number, required: true, min: 0 },
                },
            ],
            default: () => [
                { minKm: 0, maxKm: 5, earning: 30 },
                { minKm: 5, maxKm: 10, earning: 45 },
                { minKm: 10, maxKm: 15, earning: 60 },
                { minKm: 15, maxKm: null, earning: 80 },
            ],
        },
        riderEarningBaseWeightKg: {
            type: Number,
            default: 2,
            min: 0,
        },
        riderEarningExtraFeePerKg: {
            type: Number,
            default: 10,
            min: 0,
        },
        riderExpressEarning: {
            type: Number,
            default: 100,
            min: 0,
        },
        // Additional per-km earning for distance beyond the last defined
        // rider slab's maxKm (e.g. beyond 15km). 0 = rider earns only the
        // last slab's flat amount no matter how far beyond it the delivery is.
        riderExtraEarningPerKmBeyondSlabs: {
            type: Number,
            default: 0,
            min: 0,
        },
        // Seller's cut of what's LEFT of the delivery fee after the rider is
        // paid (rider is always paid first, in full). E.g. 80 = seller gets
        // 80% of the remainder, admin keeps the rest. 0 = sellers get nothing
        // from delivery fee at all. If the rider's payout consumes the whole
        // fee (or more), there's nothing left to split regardless of this %.
        sellerDeliveryFeeSharePercent: {
            type: Number,
            default: 80,
            min: 0,
            max: 100,
        },

        // First Order Welcome Offer & Scratch Card Config
        firstOrderDiscountPercent: {
            type: Number,
            default: 10,
            min: 0,
            max: 100,
        },
        firstOrderFreeDelivery: {
            type: Boolean,
            default: true,
        },
        welcomeScratchCardEnabled: {
            type: Boolean,
            default: true,
        },

        // MLM Promotional Section Configuration
        mlmPromo: {
            enabled: {
                type: Boolean,
                default: true,
            },
            badgeText: {
                type: String,
                default: "SEVAFAST MLM",
            },
            title: {
                type: String,
                default: "JOIN SEVAFAST MULTI LEVEL MARKETING",
            },
            subtitle: {
                type: String,
                default: "Earn More, Refer More, Grow Your Network!",
            },
            ctaText: {
                type: String,
                default: "JOIN NOW",
            },
            ctaLink: {
                type: String,
                default: "/plans",
            },
            bannerBgColor: {
                type: String,
                default: "#FFF6F0",
            },
            customImageUrl: {
                type: String,
                default: "",
            },
            steps: {
                type: [
                    {
                        _id: false,
                        stepNumber: { type: Number, default: 1 },
                        title: { type: String, default: "Register Free" },
                        subtitle: { type: String, default: "Quick & Easy" },
                        iconType: { type: String, default: "edit" },
                    },
                ],
                default: () => [
                    { stepNumber: 1, title: "Register Free", subtitle: "Instant Activation", iconType: "edit" },
                    { stepNumber: 2, title: "Refer Your Friends", subtitle: "Share Referral Code", iconType: "users" },
                    { stepNumber: 3, title: "They Shop, You Earn", subtitle: "Direct & Team Commissions", iconType: "bag" },
                    { stepNumber: 4, title: "Unlimited Income", subtitle: "Multi-Level Growth", iconType: "income" },
                ],
            },
        },
    },
    {
        timestamps: true,
    }
);

settingSchema.pre("save", function syncFinanceAliases(next) {
    if (!this.pricingMode && this.deliveryPricingMode) {
        this.pricingMode = this.deliveryPricingMode;
    }
    if (!this.deliveryPricingMode && this.pricingMode) {
        this.deliveryPricingMode = this.pricingMode;
    }

    if (this.baseDeliveryCharge == null) {
        this.baseDeliveryCharge = this.customerBaseDeliveryFee ?? 30;
    }
    if (this.customerBaseDeliveryFee == null) {
        this.customerBaseDeliveryFee = this.baseDeliveryCharge ?? 30;
    }

    if (this.riderBasePayout == null) {
        this.riderBasePayout = this.baseDeliveryCharge ?? this.customerBaseDeliveryFee ?? 30;
    }

    if (this.fleetCommissionRatePerKm == null && this.deliveryPartnerRatePerKm != null) {
        this.fleetCommissionRatePerKm = this.deliveryPartnerRatePerKm;
    }
    if (this.deliveryPartnerRatePerKm == null && this.fleetCommissionRatePerKm != null) {
        this.deliveryPartnerRatePerKm = this.fleetCommissionRatePerKm;
    }

    if (this.fixedDeliveryFee == null) {
        this.fixedDeliveryFee = this.baseDeliveryCharge ?? this.customerBaseDeliveryFee ?? 30;
    }

    next();
});

export default mongoose.model("Setting", settingSchema);
