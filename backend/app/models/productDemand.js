import mongoose from "mongoose";

const productDemandSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        variantSku: {
            type: String,
            trim: true,
            default: null,
        },
        location: {
            type: String, // String representation of customer's location/address
            trim: true,
        },
        coordinates: {
            lat: { type: Number },
            lng: { type: Number },
        },
        status: {
            type: String,
            enum: ["pending", "notified", "restocked"],
            default: "pending",
        },
        notifiedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Indexes for faster querying
productDemandSchema.index({ seller: 1, status: 1 });
productDemandSchema.index({ product: 1, status: 1 });
// Only one *pending* demand per customer/product/variant at a time — but a
// customer can re-subscribe on a later out-of-stock cycle after already
// being notified once, so the uniqueness must not span all statuses.
productDemandSchema.index(
  { customer: 1, product: 1, variantSku: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export default mongoose.model("ProductDemand", productDemandSchema);
