import mongoose from "mongoose";

const platformAdSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        mediaUrl: {
            type: String,
            default: "",
        },
        mediaType: {
            type: String,
            enum: ["image", "video", "none"],
            default: "none",
        },
        imageUrl: {
            type: String,
            default: "",
        },
        videoUrl: {
            type: String,
            default: "",
        },
        targetUrl: {
            type: String,
            trim: true,
            default: "",
        },
        hasExternalUrl: {
            type: Boolean,
            default: false,
        },
        businessName: {
            type: String,
            trim: true,
            default: "",
        },
        contactPhone: {
            type: String,
            trim: true,
            default: "",
        },
        whatsapp: {
            type: String,
            trim: true,
            default: "",
        },
        address: {
            type: String,
            trim: true,
            default: "",
        },
        posters: [{
            type: String,
            trim: true,
        }],
        videos: [{
            type: String,
            trim: true,
        }],
        callToActionText: {
            type: String,
            trim: true,
            default: "Contact Us",
        },
        city: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        approvalStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
            index: true,
        },
        rejectionReason: {
            type: String,
            default: "",
        },
        paymentStatus: {
            type: String,
            enum: ["unpaid", "paid"],
            default: "unpaid",
            index: true,
        },
        paymentDetails: {
            transactionId: String,
            amountPaid: Number,
            paidAt: Date,
        },
        isPublished: {
            type: Boolean,
            default: false,
            index: true,
        },
        price: {
            type: Number,
            default: 999, // Fixed subscription price for platform banner ad
        }
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("PlatformAd", platformAdSchema);
