import mongoose from "mongoose";

const storePromotionPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
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
            default: 7,
        },
        benefits: [
            {
                type: String,
                trim: true,
            },
        ],
        badgeText: {
            type: String,
            trim: true,
            default: "",
        },
        displayColor: {
            type: String,
            default: "#6366f1",
        },
        description: {
            type: String,
            trim: true,
            default: "",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("StorePromotionPlan", storePromotionPlanSchema);
