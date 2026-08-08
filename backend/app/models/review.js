import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            required: true,
            trim: true,
        },
        images: [{
            type: String,
        }],
        video: {
            type: String,
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
    },
    { timestamps: true }
);

// Prevent multiple reviews from the same user for the same product within one order
// (a user can review a product again after re-purchasing it in a new order)
reviewSchema.index({ userId: 1, productId: 1, orderId: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
