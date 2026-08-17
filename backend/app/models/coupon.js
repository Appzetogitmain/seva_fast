import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },
        title: {
            type: String,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        // How discount is applied on amount
        discountType: {
            type: String,
            enum: ["percentage", "fixed", "free_delivery"],
            default: "percentage",
        },
        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },
        maxDiscount: {
            type: Number,
            min: 0,
        },
        // High level coupon strategy
        couponType: {
            type: String,
            enum: [
                "bulk_order", // Bulk Order Discount – Extra discount on high-value orders
                "min_order_value", // Minimum Order Value Coupon
                "free_delivery", // Free Delivery Coupon
                "category_based", // Category-Based Coupon
                "monthly_volume", // Monthly Volume Coupon
                "generic", // Plain discount without extra conditions
            ],
            default: "generic",
        },
        // Common conditions
        minOrderValue: {
            type: Number,
            default: 0,
            min: 0,
        },
        minItems: {
            type: Number,
            default: 0,
            min: 0,
        },
        applicableCategories: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Category",
            },
        ],
        // Monthly volume (for future analytics‑based rules)
        monthlyVolumeThreshold: {
            type: Number,
            min: 0,
        },
        usageLimit: {
            type: Number,
            min: 0,
        },
        perUserLimit: {
            type: Number,
            default: 1,
            min: 1,
        },
        usedCount: {
            type: Number,
            default: 0,
        },
        validFrom: {
            type: Date,
            required: true,
        },
        validTill: {
            type: Date,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        metadata: {
            type: Object,
        },
        // When set, only this customer may redeem the coupon (checked in
        // couponUsageService.assertCouponUsable + couponController.validateCoupon).
        // System-managed — never accepted from the admin coupon form.
        assignedCustomer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        // Marks the ONE coupon admins use as the source rules (discount type/value,
        // min order, etc.) that get cloned into a fresh per-customer coupon when a
        // customer's birthday arrives. Not directly redeemable itself.
        isBirthdayTemplate: {
            type: Boolean,
            default: false,
        },
        // Only meaningful when isBirthdayTemplate is true — how many days the
        // cloned per-customer coupon stays valid for, counted from issuance.
        birthdayValidityDays: {
            type: Number,
            default: 7,
            min: 1,
        },
        // Deterministic idempotency key for system-issued coupons, e.g.
        // "birthday:<customerId>:2026". A unique partial index on this field
        // is what stops a scheduler re-run from ever issuing two coupons for
        // the same customer/year — mirrors whatsappMessage.dedupeKey.
        dedupeKey: {
            type: String,
            default: "",
            trim: true,
        },
    },
    { timestamps: true }
);

couponSchema.index({ isActive: 1, validFrom: 1, validTill: 1 });
// MongoDB partial indexes only support $eq/$exists/$gt/$gte/$lt/$lte/$type/$and —
// $ne is NOT supported, so this must use $gt: "" (see whatsappMessage.js for the
// bug this exact mistake caused there).
couponSchema.index(
    { dedupeKey: 1 },
    { unique: true, partialFilterExpression: { dedupeKey: { $type: "string", $gt: "" } } }
);

export default mongoose.model("Coupon", couponSchema);

