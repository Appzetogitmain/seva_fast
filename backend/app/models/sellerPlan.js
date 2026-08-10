import mongoose from "mongoose";

const sellerPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        originalPrice: {
            type: Number,
            min: 0,
        },
        validityDays: {
            type: Number,
            required: true,
            default: 30,
        },
        description: {
            type: String,
            trim: true,
        },
        features: [
            {
                type: String,
                trim: true,
            },
        ],
        displayColor: {
            type: String,
            default: "#0ea5e9",
        },
        badgeText: {
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

export default mongoose.model("SellerPlan", sellerPlanSchema);
