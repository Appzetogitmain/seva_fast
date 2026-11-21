import mongoose from "mongoose";

const adInteractionLogSchema = new mongoose.Schema(
    {
        targetType: {
            type: String,
            enum: ["ProfessionalAd", "PlatformAd"],
            required: true,
            index: true,
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        interactionType: {
            type: String,
            enum: ["visit", "contact", "call", "whatsapp"],
            required: true,
            index: true,
        },
        visitorId: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        lastInteractedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index to quickly find visitor's last interaction on this target
adInteractionLogSchema.index({ targetType: 1, targetId: 1, interactionType: 1, visitorId: 1 });

export default mongoose.model("AdInteractionLog", adInteractionLogSchema);
