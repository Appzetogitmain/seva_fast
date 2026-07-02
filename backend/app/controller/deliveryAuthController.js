import Delivery from "../models/delivery.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import handleResponse from "../utils/helper.js";
import { sendSmsIndiaHubOtp } from "../services/smsIndiaHubService.js";
import { generateOTP } from "../utils/otp.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import { __testables as otpTestables } from "../modules/otp/otp.service.js";

const DELIVERY_TEST_NUMBERS = new Set(["6268423925", "9111966732", "8888888888"]);
const DELIVERY_TEST_OTP = "123456";

function isDeliveryTestPhone(rawPhone) {
    try {
        const normalized = otpTestables.assertValidMobile(rawPhone);
        return DELIVERY_TEST_NUMBERS.has(normalized);
    } catch {
        return false;
    }
}

async function findDeliveryByPhone(rawPhone) {
    const candidates = otpTestables.getPhoneCandidates(rawPhone);
    return Delivery.findOne({ phone: { $in: candidates } }).select("+otp +otpExpiry");
}

async function dispatchDeliveryOtpSms({ phone, otp, context }) {
    if (otpTestables.isMockOtpEnabled() || isDeliveryTestPhone(phone)) {
        return { skipped: true };
    }

    const normalized = otpTestables.assertValidMobile(phone);
    try {
        await sendSmsIndiaHubOtp({ phone: normalized, otp });
        return { sent: true };
    } catch (smsError) {
        if (process.env.NODE_ENV === "production") {
            throw smsError;
        }
        console.warn(
            `[${context}] SMS dispatch failed in non-production; OTP saved for testing.`,
            smsError.message,
        );
        return { sent: false, devOtp: otp };
    }
}

const generateToken = (delivery) =>
    jwt.sign(
        { id: delivery._id, role: "delivery" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

/* ===============================
   SIGNUP – Send OTP
================================ */
export const signupDelivery = async (req, res) => {
    try {
        const {
            name, phone, vehicleType,
            email, address, vehicleNumber,
            drivingLicenseNumber,
            accountHolder, accountNumber, ifsc,
            sellerCode
        } = req.body;

        if (!name || !phone) {
            return handleResponse(res, 400, "Name and phone are required");
        }

        let sellerId = null;
        if (sellerCode && sellerCode.trim()) {
            const seller = await mongoose.model("Seller").findOne({
                sellerCode: sellerCode.trim().toUpperCase()
            });
            if (!seller) {
                return handleResponse(res, 400, "Invalid Seller Code");
            }
            sellerId = seller._id;
        }

        let delivery = await findDeliveryByPhone(phone);

        if (delivery && delivery.isVerified) {
            return handleResponse(res, 400, "Delivery partner already exists");
        }

        let otp = generateOTP();
        if (isDeliveryTestPhone(phone)) {
            otp = DELIVERY_TEST_OTP;
        }

        let aadharUrl = delivery?.documents?.aadhar || "";
        let panUrl = delivery?.documents?.pan || "";
        let dlUrl = delivery?.documents?.drivingLicense || "";
        let profileImageUrl = delivery?.profileImage || "";

        // Handle File Uploads via Multer
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                if (file.fieldname === "profileImage") {
                    profileImageUrl = await uploadToCloudinary(file.buffer, "delivery/profiles");
                } else if (file.fieldname === "aadhar") {
                    aadharUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                } else if (file.fieldname === "pan") {
                    panUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                } else if (file.fieldname === "dl") {
                    dlUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                }
            }
        }

        const normalizedAadhar = String(req.body?.aadharUrl || req.body?.aadhar || "").trim();
        const normalizedPan = String(req.body?.panUrl || req.body?.pan || "").trim();
        const normalizedDl = String(
          req.body?.drivingLicenseUrl || req.body?.dlUrl || req.body?.dl || "",
        ).trim();
        const normalizedProfileImage = String(req.body?.profileImageUrl || req.body?.profileImage || "").trim();

        if (/^https?:\/\//i.test(normalizedAadhar)) aadharUrl = normalizedAadhar;
        if (/^https?:\/\//i.test(normalizedPan)) panUrl = normalizedPan;
        if (/^https?:\/\//i.test(normalizedDl)) dlUrl = normalizedDl;
        if (/^https?:\/\//i.test(normalizedProfileImage)) profileImageUrl = normalizedProfileImage;

        const deliveryData = {
            name,
            phone,
            vehicleType,
            email,
            address,
            vehicleNumber,
            drivingLicenseNumber,
            accountHolder,
            accountNumber,
            ifsc,
            sellerId,
            profileImage: profileImageUrl,
            documents: {
                aadhar: aadharUrl,
                pan: panUrl,
                drivingLicense: dlUrl,
            },
            otp,
            otpExpiry: Date.now() + 5 * 60 * 1000,
        };

        if (!delivery) {
            delivery = await Delivery.create(deliveryData);
        } else {
            Object.assign(delivery, deliveryData);
            await delivery.save();
        }

        const smsResult = await dispatchDeliveryOtpSms({
            phone,
            otp,
            context: "signupDelivery",
        });

        const payload = {};
        if (smsResult.devOtp) {
            payload.devOtp = smsResult.devOtp;
        }

        return handleResponse(res, 200, "OTP sent successfully", payload);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   LOGIN – Send OTP
================================ */
export const loginDelivery = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return handleResponse(res, 400, "Phone number is required");
        }

        const delivery = await findDeliveryByPhone(phone);

        if (!delivery) {
            return handleResponse(res, 404, "Delivery partner not found");
        }

        if (!delivery.isVerified) {
            return handleResponse(res, 403, "Your delivery partner account is pending admin approval.", {
                isVerified: false,
                applicationStatus: "pending",
            });
        }

        let otp = generateOTP();
        if (isDeliveryTestPhone(phone)) {
            otp = DELIVERY_TEST_OTP;
        }

        delivery.otp = otp;
        delivery.otpExpiry = Date.now() + 5 * 60 * 1000;
        await delivery.save();

        const smsResult = await dispatchDeliveryOtpSms({
            phone,
            otp,
            context: "loginDelivery",
        });

        const payload = {};
        if (smsResult.devOtp) {
            payload.devOtp = smsResult.devOtp;
        }

        return handleResponse(res, 200, "OTP sent successfully", payload);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   VERIFY OTP
================================ */
export const verifyDeliveryOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return handleResponse(res, 400, "Phone and OTP are required");
        }

        const candidates = otpTestables.getPhoneCandidates(phone);
        const delivery = await Delivery.findOne({
            phone: { $in: candidates },
            otp,
            otpExpiry: { $gt: Date.now() },
        }).select("+otp +otpExpiry");

        if (!delivery) {
            return handleResponse(res, 400, "Invalid or expired OTP");
        }

        // If rider registered under a seller (via invite code), keep isVerified=false
        // so the seller can review and approve them from their dashboard.
        // Standalone riders (no sellerId) are auto-verified immediately.
        if (!delivery.sellerId) {
            delivery.isVerified = true;
            delivery.isOnline = true;
        }
        delivery.otp = undefined;
        delivery.otpExpiry = undefined;
        delivery.lastLogin = new Date();

        await delivery.save();

        const token = generateToken(delivery);

        return handleResponse(res, 200, "Login successful", {
            token,
            delivery,
            applicationStatus: delivery.isVerified ? "approved" : "pending",
            requiresApproval: !delivery.isVerified,
        });
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET PROFILE
================================ */
export const getDeliveryProfile = async (req, res) => {
    try {
        const delivery = await Delivery.findById(req.user.id);
        if (!delivery) {
            return handleResponse(res, 404, "Delivery partner not found");
        }
        return handleResponse(res, 200, "Profile fetched successfully", delivery);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   UPDATE PROFILE
================================ */
export const updateDeliveryProfile = async (req, res) => {
    try {
        const {
            name,
            vehicleType,
            vehicleNumber,
            drivingLicenseNumber,
            currentArea,
            isOnline,
            email,
            address,
            accountHolder,
            accountNumber,
            ifsc
        } = req.body;

        const delivery = await Delivery.findById(req.user.id);
        if (!delivery) {
            return handleResponse(res, 404, "Delivery partner not found");
        }

        if (name !== undefined) delivery.name = name;
        if (vehicleType !== undefined) delivery.vehicleType = vehicleType;
        if (vehicleNumber !== undefined) delivery.vehicleNumber = vehicleNumber;
        if (drivingLicenseNumber !== undefined) delivery.drivingLicenseNumber = drivingLicenseNumber;
        if (currentArea !== undefined) delivery.currentArea = currentArea;
        if (typeof isOnline !== 'undefined') delivery.isOnline = isOnline;
        if (email !== undefined) delivery.email = email;
        if (address !== undefined) delivery.address = address;
        if (accountHolder !== undefined) delivery.accountHolder = accountHolder;
        if (accountNumber !== undefined) delivery.accountNumber = accountNumber;
        if (ifsc !== undefined) delivery.ifsc = ifsc;

        await delivery.save();

        return handleResponse(res, 200, "Profile updated successfully", delivery);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
