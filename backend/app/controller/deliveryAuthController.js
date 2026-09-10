import Delivery from "../models/delivery.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import handleResponse from "../utils/helper.js";
import { sendSmsIndiaHubOtp } from "../services/smsIndiaHubService.js";
import { generateOTP } from "../utils/otp.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import { __testables as otpTestables } from "../modules/otp/otp.service.js";
import { recordAuthActivity } from "../services/authActivityService.js";
import { notify } from "../modules/notifications/notification.service.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";

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
            dob, bloodGroup, aadharNumber, panNumber,
            experienceYears, preferredArea
        } = req.body;

        if (!name || !phone) {
            return handleResponse(res, 400, "Name and phone are required");
        }

        let delivery = await findDeliveryByPhone(phone);

        if (delivery && delivery.isVerified) {
            return handleResponse(res, 400, "Delivery partner already exists");
        }

        if (delivery && delivery.isPhoneVerified && !delivery.isVerified) {
            return handleResponse(res, 400, "Your application is already submitted and pending admin approval");
        }

        let otp = generateOTP();
        if (isDeliveryTestPhone(phone)) {
            otp = DELIVERY_TEST_OTP;
        }

        let aadharUrl = delivery?.documents?.aadhar || "";
        let panUrl = delivery?.documents?.pan || "";
        let dlUrl = delivery?.documents?.drivingLicense || "";
        let profileImageUrl = delivery?.profileImage || "";

        // Handle File Uploads via Multer concurrently
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            await Promise.all(
                req.files.map(async (file) => {
                    if (file.fieldname === "profileImage") {
                        profileImageUrl = await uploadToCloudinary(file.buffer, "delivery/profiles");
                    } else if (file.fieldname === "aadhar") {
                        aadharUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                    } else if (file.fieldname === "pan") {
                        panUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                    } else if (file.fieldname === "dl") {
                        dlUrl = await uploadToCloudinary(file.buffer, "delivery/documents");
                    }
                })
            );
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
            dob,
            bloodGroup,
            aadharNumber,
            panNumber,
            experienceYears:
                experienceYears !== undefined && experienceYears !== ""
                    ? Number(experienceYears)
                    : undefined,
            preferredArea,
            profileImage: profileImageUrl,
            documents: {
                aadhar: aadharUrl,
                pan: panUrl,
                drivingLicense: dlUrl,
            },
            isPhoneVerified: false,
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

        // If rider is already verified/approved by admin, ensure isPhoneVerified is active
        if (delivery.isVerified) {
            if (!delivery.isPhoneVerified) {
                delivery.isPhoneVerified = true;
                await delivery.save();
            }
        } else if (delivery.isPhoneVerified === false && !delivery.isVerified && !delivery.isPhoneVerified) {
            return handleResponse(res, 400, "Please complete your registration and mobile verification first.", {
                isVerified: false,
                isPhoneVerified: false,
            });
        } else if (!delivery.isVerified) {
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

        delivery.otp = undefined;
        delivery.otpExpiry = undefined;
        const isNewSignup = !delivery.isPhoneVerified && !delivery.isVerified;
        delivery.isPhoneVerified = true;
        await delivery.save();

        if (isNewSignup) {
            try {
                const Admin = mongoose.model("Admin");
                const admins = await Admin.find({}, "_id");
                const adminIds = admins.map(a => a._id);
                if (adminIds.length > 0) {
                    await notify(NOTIFICATION_EVENTS.NEW_DELIVERY_REGISTERED, {
                        adminIds,
                        deliveryId: delivery._id,
                        deliveryName: delivery.name,
                        email: delivery.email,
                        phone: delivery.phone,
                    });
                }
            } catch (err) {
                console.error("Failed to notify admins of new delivery registration", err);
            }
        }

        if (!delivery.isVerified) {
            return handleResponse(res, 403, "Your delivery partner account is pending admin approval.", {
                isVerified: false,
                isPhoneVerified: true,
                applicationStatus: "pending",
                requiresApproval: true,
            });
        }

        delivery.lastLogin = new Date();
        delivery.isOnline = true;
        await delivery.save();

        await recordAuthActivity({
            role: "delivery",
            action: "login",
            userId: delivery._id,
            user: delivery,
            req,
        });
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
            ifsc,
            dob,
            bloodGroup,
            aadharNumber,
            panNumber,
            experienceYears,
            preferredArea
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
        if (dob !== undefined) delivery.dob = dob;
        if (bloodGroup !== undefined) delivery.bloodGroup = bloodGroup;
        if (aadharNumber !== undefined) delivery.aadharNumber = aadharNumber;
        if (panNumber !== undefined) delivery.panNumber = panNumber;
        if (experienceYears !== undefined && experienceYears !== "") delivery.experienceYears = Number(experienceYears);
        if (preferredArea !== undefined) delivery.preferredArea = preferredArea;

        // Handle profile photo upload via multer or base64 / url
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            for (const file of req.files) {
                if (file.fieldname === "profileImage" || file.fieldname === "image" || file.fieldname === "avatar") {
                    const result = await uploadToCloudinary(file.buffer, "delivery/profiles", {
                        mimeType: file.mimetype,
                    });
                    delivery.profileImage = typeof result === "string" ? result : (result?.secure_url || result?.url || "");
                }
            }
        } else if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, "delivery/profiles", {
                mimeType: req.file.mimetype,
            });
            delivery.profileImage = typeof result === "string" ? result : (result?.secure_url || result?.url || "");
        } else if (req.body.profileImage !== undefined) {
            delivery.profileImage = req.body.profileImage;
        }

        await delivery.save();

        return handleResponse(res, 200, "Profile updated successfully", delivery);
    } catch (error) {
        console.error("Error updating delivery profile:", error);
        return handleResponse(res, error.statusCode || 500, error.message || "Failed to update delivery profile");
    }
};

/* ===============================
   PUBLIC DELIVERY PARTNER VERIFICATION
================================ */
export const getPublicDeliveryVerification = async (req, res) => {
    try {
        const { idOrRiderId } = req.params;
        if (!idOrRiderId) {
            return handleResponse(res, 400, "Rider ID or Identifier is required");
        }

        let query = {};
        if (mongoose.Types.ObjectId.isValid(idOrRiderId)) {
            query = { _id: idOrRiderId };
        } else {
            const cleaned = idOrRiderId.replace(/^SF-DRV-/i, "").toLowerCase();
            query = {
                $or: [
                    { phone: idOrRiderId },
                    mongoose.Types.ObjectId.isValid(cleaned) ? { _id: cleaned } : null,
                    { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: `${cleaned}$`, options: "i" } } }
                ].filter(Boolean)
            };
        }

        const delivery = await Delivery.findOne(query).select(
            "name phone vehicleType vehicleNumber isVerified createdAt profileImage city currentArea preferredArea"
        );

        if (!delivery) {
            return handleResponse(res, 404, "Delivery Partner Not Found");
        }

        const riderId = `SF-DRV-${delivery._id.toString().slice(-6).toUpperCase()}`;

        return handleResponse(res, 200, "Verification data fetched successfully", {
            id: delivery._id,
            riderId,
            name: delivery.name,
            phone: delivery.phone ? `${delivery.phone.slice(0, 2)}******${delivery.phone.slice(-2)}` : "—",
            vehicleType: delivery.vehicleType || "Bike",
            vehicleNumber: delivery.vehicleNumber || "Verified Commercial Partner",
            isVerified: delivery.isVerified,
            status: delivery.isVerified ? "AUTHORIZED_DELIVERY_PARTNER" : "PENDING_VERIFICATION",
            joinedDate: delivery.createdAt,
            city: delivery.city || delivery.currentArea || delivery.preferredArea || "Indore",
            organization: "SEVAFAST Logistics Pvt. Ltd.",
            verifiedAt: new Date().toISOString(),
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
