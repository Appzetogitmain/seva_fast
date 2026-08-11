import mongoose from "mongoose";

const sellerStorePromotionSchema = new mongoose.Schema(
    {
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
            index: true,
        },
        plan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "StorePromotionPlan",
            required: true,
        },
        planName: {
            type: String,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        durationDays: {
            type: Number,
            required: true,
            min: 1,
        },
        benefits: [
            {
                type: String,
                trim: true,
            },
        ],
        paymentStatus: {
            type: String,
            enum: ["Unpaid", "Paid", "Failed"],
            default: "Unpaid",
            index: true,
        },
        campaignStatus: {
            type: String,
            enum: ["Pending Activation", "Active", "Paused", "Completed", "Cancelled"],
            default: "Pending Activation",
            index: true,
        },
        razorpayOrderId: {
            type: String,
            default: "",
        },
        razorpayPaymentId: {
            type: String,
            default: "",
        },
        paidAt: {
            type: Date,
            default: null,
        },
        activatedAt: {
            type: Date,
            default: null,
        },
        expiresAt: {
            type: Date,
            default: null,
            index: true,
        },
        adminNotes: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("SellerStorePromotion", sellerStorePromotionSchema);
