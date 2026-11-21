import mongoose from "mongoose";

const professionalReviewSchema = new mongoose.Schema(
    {
        providerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProfessionalAd",
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        userName: {
            type: String,
            required: true,
            trim: true,
            default: "Customer",
        },
        userPhone: {
            type: String,
            trim: true,
            default: "",
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            trim: true,
            default: "",
        },
        status: {
            type: String,
            enum: ["approved", "flagged", "hidden"],
            default: "approved",
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// One review per customer per service provider (allows updating/editing)
professionalReviewSchema.index({ providerId: 1, userId: 1 }, { unique: true });

export default mongoose.model("ProfessionalReview", professionalReviewSchema);
