import mongoose from "mongoose";

const serviceItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    durationMinutes: {
        type: Number,
        default: 30,
    },
    image: String,
    images: [{
        type: String,
        trim: true,
    }],
    video: String,
    videos: [{
        type: String,
        trim: true,
    }],
});

const professionalAdSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
        },
        email: String,
        profession: {
            type: String,
            required: true,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProfessionalCategory",
            required: true,
        },
        categories: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "ProfessionalCategory",
            },
        ],
        experienceYears: {
            type: Number,
            min: 0,
            default: 0,
        },
        description: {
            type: String,
            required: true,
        },
        pricing: {
            calloutFee: { type: Number, default: 0 },
            hourlyRate: { type: Number, default: 0 },
        },
        services: [serviceItemSchema],
        address: {
            type: String,
            required: true,
        },
        city: {
            type: String,
            required: true,
            index: true,
        },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true,
            },
        },
        approvalStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
            index: true,
        },
        rejectionReason: String,
        paymentStatus: {
            type: String,
            enum: ["unpaid", "paid", "expired"],
            default: "unpaid",
        },
        paymentDetails: {
            transactionId: String,
            amountPaid: Number,
            paidAt: Date,
        },
        expiresAt: {
            type: Date,
            index: true,
        },
        isPublished: {
            type: Boolean,
            default: false,
            index: true,
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
        portfolioImages: [{
            type: String,
            trim: true,
        }],
        portfolioVideos: [{
            type: String,
            trim: true,
        }],
        visitsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        contactsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        callClicksCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        whatsappClicksCount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

professionalAdSchema.index({ location: "2dsphere" });

export default mongoose.model("ProfessionalAd", professionalAdSchema);
