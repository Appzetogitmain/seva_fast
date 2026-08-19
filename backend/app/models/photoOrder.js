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
    }
}, { timestamps: true });

export default mongoose.model("PhotoOrder", photoOrderSchema);
