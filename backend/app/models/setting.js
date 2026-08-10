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
