import Seller from "../models/seller.js";
import jwt from "jsonwebtoken";
import handleResponse from "../utils/helper.js";
import {
    issueSellerVerificationOtp,
    verifySellerOtpCode,
    verifySellerVerificationToken,
    issueSellerPasswordResetOtp,
    verifySellerPasswordResetOtp,
    resetSellerPasswordWithToken,
} from "../services/sellerVerificationService.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import { recordAuthActivity } from "../services/authActivityService.js";
import { getAdminIds } from "../utils/adminIds.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";

/* ===============================
   Utils
================================ */

const generateToken = (seller) =>
    jwt.sign({ id: seller._id, role: "seller" }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });

const SELLER_DOCUMENT_FIELDS = {
    tradeLicense: "Trade License",
    gstCertificate: "GST Certificate",
    idProof: "ID Proof",
    panCard: "PAN Card",
    addressProof: "Address Proof",
    cancelledCheque: "Cancelled Cheque",
};

const ALLOWED_SELLER_DOCUMENT_FIELDS = Object.keys(SELLER_DOCUMENT_FIELDS);

const parseDocumentsPayload = (documents) => {
    if (!documents) {
        return {};
    }

    if (typeof documents === "string") {
        try {
            return JSON.parse(documents);
        } catch {
            return {};
        }
    }

    if (typeof documents === "object") {
        return documents;
    }

    return {};
};

const isValidUploadedDocumentReference = (value) => {
    const normalized = String(value || "").trim();
    return /^https?:\/\//i.test(normalized);
};

const resolveSellerDocuments = (body = {}, parsedDocuments = {}) => {
    const resolved = { ...(parsedDocuments || {}) };

    const directFields = {
        tradeLicense: body.tradeLicenseUrl || body.tradeLicense,
        gstCertificate: body.gstCertificateUrl || body.gstCertificate,
        idProof: body.idProofUrl || body.idProof,
        panCard: body.panCardUrl || body.panCard,
        addressProof: body.addressProofUrl || body.addressProof,
        cancelledCheque: body.cancelledChequeUrl || body.cancelledCheque,
    };

    for (const [field, candidate] of Object.entries(directFields)) {
        const normalized = String(candidate || "").trim();
        if (normalized && /^https?:\/\//i.test(normalized)) {
            resolved[field] = normalized;
        }
    }

    return resolved;
};

const getMissingRequiredSellerDocuments = (documents = {}) => {
    // tradeLicense and gstCertificate were previously required, keep them required.
    // addressProof and cancelledCheque are new required fields.
    const strictlyRequired = ["tradeLicense", "addressProof", "cancelledCheque"];
    const missing = strictlyRequired.filter(
        (fieldName) => !isValidUploadedDocumentReference(documents[fieldName])
    );
    
    // Either PAN Card OR ID Proof (Aadhaar) is required
    if (!isValidUploadedDocumentReference(documents.panCard) && !isValidUploadedDocumentReference(documents.idProof)) {
        missing.push("panCard"); // Add one to trigger the error message clearly
    }
    return missing;
};

/* ===============================
   SELLER SIGNUP
================================ */
export const signupSeller = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            password,
            emailVerificationToken,
            phoneVerificationToken,
            shopName,
            category,
            description,
            address,
            locality,
            pincode,
            city,
            state,
            documents,
            lat,
            lng,
            radius,
            referralCode,
            whatsappNumber,
            businessType,
            sellerType,
            panNumber,
            aadhaarNumber,
            gstinNumber,
            udyamNumber,
            bankDetails,
            businessInfo
        } = req.body || {};

        // 1. Handle file uploads if they exist in req.files (multipart form)
        const documentFiles = req.files || [];
        const uploadedDocs = {};

        if (Array.isArray(documentFiles) && documentFiles.length > 0) {
            for (const file of documentFiles) {
                try {
                    const fieldName = file.fieldname;
                    if (fieldName && ALLOWED_SELLER_DOCUMENT_FIELDS.includes(fieldName)) {
                        const url = await uploadToCloudinary(file.buffer, "docs", {
                            mimeType: file.mimetype,
                        });
                        uploadedDocs[fieldName] = url;
                    }
                } catch (err) {
                    console.error("Failed to upload document to Cloudinary", err);
                }
            }
        }

        // Merge uploaded document URLs into body for resolveSellerDocuments
        const augmentedBody = {
            ...req.body,
            ...uploadedDocs
        };

        const parsedLat = lat !== undefined ? Number(lat) : undefined;
        const parsedLng = lng !== undefined ? Number(lng) : undefined;
        const parsedRadius = radius !== undefined ? Number(radius) : undefined;

        if (!name || !email || !phone || !password || !shopName) {
            return handleResponse(res, 400, "All fields are required");
        }

        if (!panNumber && !aadhaarNumber) {
            return handleResponse(res, 400, "Either PAN Number or Aadhaar Number is compulsory.");
        }

        verifySellerVerificationToken({
            channel: "email",
            rawValue: email,
            token: emailVerificationToken,
        });
        verifySellerVerificationToken({
            channel: "phone",
            rawValue: phone,
            token: phoneVerificationToken,
        });

        // Validate coordinates and radius if provided
        if (lat !== undefined && (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
            return handleResponse(res, 400, "Invalid latitude");
        }
        if (lng !== undefined && (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
            return handleResponse(res, 400, "Invalid longitude");
        }
        if (radius !== undefined && (!Number.isFinite(parsedRadius) || parsedRadius < 1 || parsedRadius > 100)) {
            return handleResponse(res, 400, "Radius must be between 1 and 100 km");
        }

        let seller = await Seller.findOne({ $or: [{ email }, { phone }] });

        if (seller) {
            return handleResponse(res, 400, "Seller with this email or phone already exists");
        }

        const parsedDocuments = parseDocumentsPayload(documents);
        const sellerDocuments = resolveSellerDocuments(augmentedBody, parsedDocuments);
        const missingRequiredDocuments = getMissingRequiredSellerDocuments(
            sellerDocuments || {}
        );

        if (missingRequiredDocuments.length > 0) {
            const readableMissing = missingRequiredDocuments
                .map((field) => SELLER_DOCUMENT_FIELDS[field] || field)
                .join(", ");
            return handleResponse(
                res,
                400,
                `All required documents must be uploaded: ${readableMissing}`
            );
        }

        let parsedBankDetails = {};
        let parsedBusinessInfo = {};
        try {
            parsedBankDetails = typeof bankDetails === "string" ? JSON.parse(bankDetails) : (bankDetails || {});
            parsedBusinessInfo = typeof businessInfo === "string" ? JSON.parse(businessInfo) : (businessInfo || {});
        } catch(e) {}

        const sellerData = {
            name,
            email,
            phone,
            whatsappNumber,
            password,
            shopName,
            businessType,
            sellerType,
            category,
            description,
            panNumber,
            aadhaarNumber,
            gstinNumber,
            udyamNumber,
            bankDetails: parsedBankDetails,
            businessInfo: parsedBusinessInfo,
            address,
            locality,
            pincode,
            city,
            state,
            documents: sellerDocuments,
            applicationStatus: "pending",
            isVerified: false,
            emailVerified: true,
            phoneVerified: true,
            isActive: false,
            onboardedBy: null,
        };

        if (parsedLat !== undefined && parsedLng !== undefined) {
            sellerData.location = {
                type: "Point",
                coordinates: [parsedLng, parsedLat],
            };
        }

        if (parsedRadius !== undefined) {
            sellerData.serviceRadius = parsedRadius;
        }

        let referrerUser = null;
        let rewardAmount = 0;

        if (referralCode) {
            const User = (await import("../models/customer.js")).default;
            referrerUser = await User.findOne({ referralCode: referralCode.toUpperCase() });
            
            if (referrerUser && referrerUser.currentPlan && referrerUser.planExpiry > new Date()) {
                const Plan = (await import("../models/plan.js")).default;
                const plan = await Plan.findById(referrerUser.currentPlan);
                if (plan) {
                    const vendorFeature = plan.features.find(f => f.key === "VENDOR_ONBOARDING");
                    if (vendorFeature && Number(vendorFeature.value) > 0) {
                        rewardAmount = Number(vendorFeature.value);
                        sellerData.onboardedBy = referrerUser._id;
                    }
                }
            }
        }

        seller = await Seller.create(sellerData);

        try {
            const adminIds = await getAdminIds();
            if (adminIds.length > 0) {
                emitNotificationEvent(NOTIFICATION_EVENTS.NEW_SELLER_REGISTERED, {
                    adminIds,
                    sellerId: seller._id?.toString?.(),
                    sellerName: seller.name,
                    shopName: seller.shopName,
                    email: seller.email,
                    phone: seller.phone,
                    data: {
                        applicationStatus: seller.applicationStatus || "pending",
                    },
                });
            }
        } catch (notifyErr) {
            console.error("Failed to emit new seller registration notification:", notifyErr);
        }

        if (rewardAmount > 0 && referrerUser) {
            const Transaction = (await import("../models/transaction.js")).default;
            referrerUser.walletBalance = (referrerUser.walletBalance || 0) + rewardAmount;
            await referrerUser.save();

            await Transaction.create({
                user: referrerUser._id,
                userModel: "User",
                type: "Incentive",
                amount: rewardAmount,
                status: "Settled",
                reference: `VENDOR-REF-${seller._id}`,
                meta: {
                    sellerId: seller._id,
                    description: "Vendor Onboarding Reward",
                }
            });
        }

        return handleResponse(res, 201, "Seller registered successfully", {
            seller,
            applicationStatus: "pending",
            requiresApproval: true,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const sendSellerSignupOtp = async (req, res) => {
    try {
        const { channel, email, phone, value } = req.body || {};
        const targetValue =
            channel === "email"
                ? email || value
                : channel === "phone"
                    ? phone || value
                    : value;

        const result = await issueSellerVerificationOtp({
            channel,
            rawValue: targetValue,
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "OTP sent successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

export const verifySellerSignupOtp = async (req, res) => {
    try {
        const { channel, email, phone, value, otp } = req.body || {};
        const targetValue =
            channel === "email"
                ? email || value
                : channel === "phone"
                    ? phone || value
                    : value;

        const result = await verifySellerOtpCode({
            channel,
            rawValue: targetValue,
            otp,
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "OTP verified successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   SELLER LOGIN
================================ */
export const loginSeller = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return handleResponse(res, 400, "Email/Phone and password are required");
        }

        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const query = isEmail ? { email } : { phone: email };
        const seller = await Seller.findOne(query).select("+password");

        if (!seller) {
            return handleResponse(res, 404, "Seller not found");
        }

        const isMatch = await seller.comparePassword(password);

        if (!isMatch) {
            return handleResponse(res, 401, "Invalid credentials");
        }

        const applicationStatus =
            seller.applicationStatus || (seller.isVerified ? "approved" : "pending");
        const isApproved =
            seller.isVerified === true &&
            seller.isActive === true &&
            applicationStatus === "approved";

        if (!isApproved) {
            const approvalMessage =
                applicationStatus === "rejected"
                    ? "Your seller application was rejected. Please contact support."
                    : "Your seller account is pending admin approval.";

            return handleResponse(res, 403, approvalMessage, {
                applicationStatus,
                isVerified: seller.isVerified === true,
                isActive: seller.isActive === true,
                rejectionReason: seller.rejectionReason || "",
            });
        }

        seller.lastLogin = new Date();
        await seller.save();

        await recordAuthActivity({
            role: "seller",
            action: "login",
            userId: seller._id,
            user: seller,
            req,
        });

        const token = generateToken(seller);

        return handleResponse(res, 200, "Login successful", {
            token,
            seller,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   SELLER FORGOT PASSWORD
================================ */
export const sendSellerPasswordResetOtp = async (req, res) => {
    try {
        const { email } = req.body || {};

        const result = await issueSellerPasswordResetOtp({
            rawValue: email,
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "OTP sent successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

export const verifySellerPasswordResetOtpController = async (req, res) => {
    try {
        const { email, otp } = req.body || {};

        const result = await verifySellerPasswordResetOtp({
            rawValue: email,
            otp,
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "OTP verified successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

export const resetSellerPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body || {};

        await resetSellerPasswordWithToken({
            rawValue: email,
            resetToken,
            newPassword,
        });

        return handleResponse(res, 200, "Password reset successfully");
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   ACCEPT SELLER CERTIFICATE
================================ */
export const acceptSellerCertificate = async (req, res) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) {
            return handleResponse(res, 401, "Unauthorized");
        }

        const seller = await Seller.findById(sellerId);
        if (!seller) {
            return handleResponse(res, 404, "Seller not found");
        }

        if (!seller.certificate) {
            return handleResponse(res, 400, "No certificate found for this seller");
        }

        if (!seller.certificate.accepted) {
            seller.certificate.accepted = true;
            seller.certificate.acceptedAt = new Date();
            seller.certificate.acceptedIp = req.ip || req.headers["x-forwarded-for"] || "";
            await seller.save();
        }

        return handleResponse(res, 200, "Authorised seller certificate accepted successfully", {
            seller,
            certificate: seller.certificate,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
