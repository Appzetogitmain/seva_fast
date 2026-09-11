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
import {
    normalizeIndian10DigitPhone,
    getPhoneLookupCandidates,
} from "../utils/phone.js";

/* ===============================
   Utils
================================ */

const generateToken = (seller) =>
    jwt.sign({ id: seller._id, role: "seller" }, process.env.JWT_SECRET || "default_jwt_secret", {
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

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
            return handleResponse(res, 400, "Please enter a valid email address.");
        }

        // 1. Bank Details Format Validation (Step 2)
        let parsedBankDetails = {};
        let parsedBusinessInfo = {};
        try {
            parsedBankDetails = typeof bankDetails === "string" ? JSON.parse(bankDetails) : (bankDetails || {});
            parsedBusinessInfo = typeof businessInfo === "string" ? JSON.parse(businessInfo) : (businessInfo || {});
        } catch(e) {
            return handleResponse(res, 400, "Invalid bank details format.");
        }

        const accountHolderName = String(parsedBankDetails.accountHolderName || "").trim();
        const bankName = String(parsedBankDetails.bankName || "").trim();
        const branch = String(parsedBankDetails.branch || "").trim();
        const accountNumber = String(parsedBankDetails.accountNumber || "").trim();
        const ifscCode = String(parsedBankDetails.ifscCode || "").trim().toUpperCase();

        if (!accountHolderName) {
            return handleResponse(res, 400, "Please enter Account Holder Name.");
        }
        if (!bankName) {
            return handleResponse(res, 400, "Please enter Bank Name.");
        }
        if (!branch) {
            return handleResponse(res, 400, "Please enter Branch Name.");
        }
        if (!accountNumber || !/^\d{9,18}$/.test(accountNumber)) {
            return handleResponse(res, 400, "Please enter a valid Bank Account Number (9 to 18 digits).");
        }
        if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
            return handleResponse(res, 400, "Please enter a valid 11-character IFSC Code (e.g. SBIN0001234, 5th character must be '0').");
        }

        parsedBankDetails = {
            accountHolderName,
            bankName,
            branch,
            accountNumber,
            ifscCode,
        };

        // 2. KYC Details Format Validation (Step 4)
        const cleanPan = panNumber ? String(panNumber).trim().toUpperCase() : "";
        const cleanAadhaar = aadhaarNumber ? String(aadhaarNumber).trim() : "";
        const cleanGstin = gstinNumber ? String(gstinNumber).trim().toUpperCase() : "";
        const cleanUdyam = udyamNumber ? String(udyamNumber).trim().toUpperCase() : "";

        if (!cleanPan && !cleanAadhaar) {
            return handleResponse(res, 400, "Either PAN Number or Aadhaar Number is compulsory.");
        }

        if (cleanPan) {
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
                return handleResponse(res, 400, "Please enter a valid 10-character PAN Number (e.g. ABCDE1234F).");
            }
        }

        if (cleanAadhaar) {
            if (!/^\d{12}$/.test(cleanAadhaar)) {
                return handleResponse(res, 400, "Aadhaar Number must be exactly 12 digits.");
            }
        }

        if (cleanGstin) {
            if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGstin) && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$/.test(cleanGstin)) {
                return handleResponse(res, 400, "Please enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5).");
            }
        }

        if (cleanUdyam) {
            const isUdyam = /^UDYAM-[A-Z]{2}-\d{1,3}-\d{4,9}$/i.test(cleanUdyam) || /^UDYAM[A-Z]{2}\d{5,10}$/i.test(cleanUdyam) || /^[A-Z]{2}-\d{1,3}-\d{4,9}$/i.test(cleanUdyam);
            const isShopAct = /^[A-Z0-9\/-]{3,25}$/i.test(cleanUdyam);
            if (!isUdyam && !isShopAct) {
                return handleResponse(res, 400, "Please enter a valid Udyam (e.g. UDYAM-XX-00-0000000) or Shop Act Registration number.");
            }
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const normalizedPhone = normalizeIndian10DigitPhone(phone);
        if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
            return handleResponse(res, 400, "Please enter a valid 10-digit phone number starting with 6-9.");
        }
        const normalizedWhatsapp = whatsappNumber ? normalizeIndian10DigitPhone(whatsappNumber) : undefined;

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

        const phoneCandidates = getPhoneLookupCandidates(phone);
        let seller = await Seller.findOne({
            $or: [{ email: normalizedEmail }, { phone: { $in: phoneCandidates } }]
        });

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

        const sellerData = {
            name,
            email: normalizedEmail,
            phone: normalizedPhone,
            whatsappNumber: normalizedWhatsapp,
            password,
            shopName,
            businessType,
            sellerType,
            category,
            description,
            panNumber: cleanPan,
            aadhaarNumber: cleanAadhaar,
            gstinNumber: cleanGstin,
            udyamNumber: cleanUdyam,
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
            const normalizedReferralCode = String(referralCode).trim().toUpperCase();
            referrerUser = await User.findOne({ referralCode: normalizedReferralCode });

            if (!referrerUser) {
                return handleResponse(res, 400, "Invalid referral code. Please check and try again.");
            }

            // Persist the code that was actually used regardless of whether it
            // qualifies for an onboarding reward below, so admin can still see
            // which code brought this seller in.
            sellerData.referralCodeUsed = normalizedReferralCode;

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

        const token = generateToken(seller);

        return handleResponse(res, 201, "Seller registered successfully", {
            token,
            seller: {
                _id: seller._id,
                name: seller.name,
                email: seller.email,
                phone: seller.phone,
                shopName: seller.shopName,
                role: "seller",
                applicationStatus: seller.applicationStatus || "pending",
                isVerified: seller.isVerified === true,
                isActive: seller.isActive === true,
            },
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

        const identifier = String(email || "").trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
        let query;
        if (isEmail) {
            query = { email: identifier.toLowerCase() };
        } else {
            const phoneCandidates = getPhoneLookupCandidates(identifier);
            query = { phone: { $in: phoneCandidates } };
        }
        const seller = await Seller.findOne(query).select("+password");

        if (!seller) {
            return handleResponse(
                res,
                404,
                "This store isn't registered. Please sign up first.",
            );
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

            const token = generateToken(seller);

            return handleResponse(res, 403, approvalMessage, {
                token,
                seller: {
                    _id: seller._id,
                    name: seller.name,
                    email: seller.email,
                    phone: seller.phone,
                    shopName: seller.shopName,
                    role: "seller",
                    applicationStatus,
                    isVerified: seller.isVerified === true,
                    isActive: seller.isActive === true,
                    rejectionReason: seller.rejectionReason || "",
                },
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

/* ===============================
   CHECK SELLER APPROVAL STATUS
================================ */
export const checkSellerApprovalStatus = async (req, res) => {
    try {
        const sellerId = req.user?.id || req.query.sellerId || req.body?.sellerId;
        const email = req.query.email || req.body?.email;
        const phone = req.query.phone || req.body?.phone;

        let query = null;
        if (sellerId) query = { _id: sellerId };
        else if (email) query = { email: String(email).trim().toLowerCase() };
        else if (phone) {
            const candidates = getPhoneLookupCandidates(phone);
            query = { phone: { $in: candidates } };
        }

        if (!query) {
            return handleResponse(res, 400, "Seller ID, email or phone is required");
        }

        const seller = await Seller.findOne(query).select("name shopName email phone applicationStatus isVerified isActive rejectionReason");
        if (!seller) {
            return handleResponse(res, 404, "Seller not found");
        }

        const applicationStatus = seller.applicationStatus || (seller.isVerified ? "approved" : "pending");
        const isApproved = seller.isVerified === true && seller.isActive === true && applicationStatus === "approved";

        return handleResponse(res, 200, "Status fetched successfully", {
            sellerId: seller._id,
            isApproved,
            applicationStatus,
            isVerified: seller.isVerified === true,
            isActive: seller.isActive === true,
            rejectionReason: seller.rejectionReason || "",
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

