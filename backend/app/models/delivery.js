import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
        },

        vehicleType: {
            type: String,
            enum: ["bike", "cycle", "scooter", "other"],
            default: "bike",
        },

        email: {
            type: String,
            trim: true,
        },

        address: {
            type: String,
            trim: true,
        },

        dob: {
            type: String,
            trim: true,
        },

        bloodGroup: {
            type: String,
            trim: true,
        },

        accountHolder: {
            type: String,
            trim: true,
        },

        accountNumber: {
            type: String,
            trim: true,
        },

        ifsc: {
            type: String,
            trim: true,
        },

        documents: {
            aadhar: { type: String },
            pan: { type: String },
            drivingLicense: { type: String },
        },

        aadharNumber: {
            type: String,
            trim: true,
        },

        panNumber: {
            type: String,
            trim: true,
            uppercase: true,
        },

        vehicleNumber: {
            type: String,
            trim: true,
        },

        drivingLicenseNumber: {
            type: String,
            trim: true,
        },

        currentArea: {
            type: String,
            trim: true,
        },

        experienceYears: {
            type: Number,
            min: 0,
        },

        preferredArea: {
            type: String,
            trim: true,
        },
        profileImage: {
            type: String,
            trim: true,
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        isPhoneVerified: {
            type: Boolean,
            default: false,
        },

        rating: {
            type: Number,
            default: 5.0,
            min: 1,
            max: 5,
        },

        totalRatings: {
            type: Number,
            default: 0,
        },



        // Work-availability toggle ("accepting orders right now"), set by the
        // rider from their dashboard — independent of session state.
        isOnline: {
            type: Boolean,
            default: true,
        },
        // True only while the rider has an active login session (set true on
        // login, false on logout). Used to suppress push/socket order
        // notifications while logged out, regardless of isOnline above.
        isLoggedIn: {
            type: Boolean,
            default: false,
        },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number],
                default: [0, 0],
            },
        },
        role: {
            type: String,
            default: "delivery",
        },

        otp: {
            type: String,
            select: false,
        },

        otpExpiry: {
            type: Date,
            select: false,
        },

        lastLogin: Date,

        /** Last GPS fix from POST /delivery/location (for radius matching). */
        lastLocationAt: {
            type: Date,
        },
        zoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Zone",
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

deliverySchema.index({ location: "2dsphere" });
deliverySchema.index({ isOnline: 1, isVerified: 1 });

deliverySchema.virtual('id').get(function () {
    return this._id.toHexString();
});

export default mongoose.model("Delivery", deliverySchema);
