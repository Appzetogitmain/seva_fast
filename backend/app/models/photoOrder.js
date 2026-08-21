import mongoose from "mongoose";

const photoOrderSchema = new mongoose.Schema({
    customer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    seller: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Seller", 
        required: true 
    },
    city: { 
        type: String 
    },
    photoUrl: { 
        type: String, 
        required: false 
    },
    notes: { 
        type: String 
    },
    status: { 
        type: String, 
        enum: ["Pending", "Accepted", "Rejected", "Completed"], 
        default: "Pending" 
    },
    messages: [{
        senderRole: { type: String, enum: ['customer', 'seller'], required: true },
        senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
        text: { type: String },
        type: { type: String, enum: ['text', 'reply_card', 'contact_card', 'image'], default: 'text' },
        imageUrl: { type: String },
        estimatedPrice: { type: Number },
        sellerContactPhone: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    sellerReply: { type: String },
    estimatedPrice: { type: Number },
    sellerContactShared: { type: Boolean, default: false },
    chatDisabled: { type: Boolean, default: false },
    chatDisabledReason: { type: String }
}, { timestamps: true });

export default mongoose.model("PhotoOrder", photoOrderSchema);
