import ProfessionalAd from "../models/professionalAd.js";
import ProfessionalCategory from "../models/professionalCategory.js";
import Setting from "../models/setting.js";
import User from "../models/customer.js";
import Transaction from "../models/transaction.js";
import handleResponse from "../utils/helper.js";
import Razorpay from "razorpay";
import crypto from "crypto";

export const createAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { name, phone, email, profession, categoryId, categoryIds, experienceYears, description, address, city, lat, lng, mediaUrl, mediaType } = req.body;

        const ids = Array.isArray(categoryIds) && categoryIds.length > 0 ? categoryIds : [categoryId].filter(Boolean);
        if (ids.length === 0) {
            return handleResponse(res, 400, "At least one category is required");
        }

        if (!name || !phone || !profession || !description || !address || !city || lat === undefined || lng === undefined) {
            return handleResponse(res, 400, "All fields (name, phone, profession, description, address, city, lat, lng) are required");
        }

        // Validate categories exist
        const validCategories = await ProfessionalCategory.find({ _id: { $in: ids }, isActive: true });
        if (validCategories.length !== ids.length) {
            return handleResponse(res, 400, "One or more invalid or inactive professional categories");
        }

        // Only one ad profile per user
        const existing = await ProfessionalAd.findOne({ owner: ownerId });
        if (existing) {
            return handleResponse(res, 400, "You already have a professional profile listing");
        }

        const settings = await Setting.findOne({}) || {};
        const isFree = validCategories.every(cat => cat.priceType === "free");
        const validityDays = settings.professionalAdValidityDays ?? 30;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + validityDays);

        const newAd = await ProfessionalAd.create({
            owner: ownerId,
            name: name.trim(),
            phone: phone.trim(),
            email: email?.trim() || "",
            profession: profession.trim(),
            category: ids[0],
            categories: ids,
            experienceYears: Number(experienceYears) || 0,
            description: description.trim(),
            address: address.trim(),
            city: city.trim(),
            location: {
                type: "Point",
                coordinates: [Number(lng), Number(lat)],
            },
            approvalStatus: "pending",
            paymentStatus: isFree ? "paid" : "unpaid",
            paymentDetails: isFree ? {
                transactionId: `TXN-AD-FREE-${Date.now()}`,
                amountPaid: 0,
                paidAt: new Date(),
            } : undefined,
            expiresAt: isFree ? expiryDate : undefined,
            isPublished: false,
            mediaUrl: mediaUrl || "",
            mediaType: mediaType || "none",
        });

        const successMsg = isFree
            ? "Professional profile listing created successfully and is pending admin approval."
            : "Professional profile listing created successfully. Please complete the listing payment to make it active.";

        return handleResponse(res, 201, successMsg, newAd);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const getMyAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const ad = await ProfessionalAd.findOne({ owner: ownerId })
            .populate("category", "name priceType price")
            .populate("categories", "name priceType price")
            .lean();
        if (!ad) {
            return handleResponse(res, 404, "Professional profile not found");
        }
        return handleResponse(res, 200, "Professional profile fetched successfully", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const updateMyAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { name, phone, email, profession, categoryId, categoryIds, experienceYears, description, address, city, lat, lng, mediaUrl, mediaType } = req.body;

        const ad = await ProfessionalAd.findOne({ owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Professional profile not found");
        }

        const ids = Array.isArray(categoryIds) && categoryIds.length > 0 ? categoryIds : (categoryId ? [categoryId] : null);
        if (ids) {
            if (ids.length === 0) {
                return handleResponse(res, 400, "At least one category is required");
            }
            const validCategories = await ProfessionalCategory.find({ _id: { $in: ids }, isActive: true });
            if (validCategories.length !== ids.length) {
                return handleResponse(res, 400, "One or more invalid or inactive professional categories");
            }
            ad.categories = ids;
            ad.category = ids[0];

             // If changed to free categories and not already paid, mark as paid
             const isFree = validCategories.every(cat => cat.priceType === "free");
             if (isFree) {
                 if (ad.paymentStatus !== "paid") {
                     const settings = await Setting.findOne({}) || {};
                     const validityDays = settings.professionalAdValidityDays ?? 30;
                     const expiryDate = new Date();
                     expiryDate.setDate(expiryDate.getDate() + validityDays);

                     ad.paymentStatus = "paid";
                     ad.paymentDetails = {
                         transactionId: `TXN-AD-FREE-${Date.now()}`,
                         amountPaid: 0,
                         paidAt: new Date(),
                     };
                     ad.expiresAt = expiryDate;
                 }
             } else {
                 // If not all are free, check if they need to pay
                 const settings = await Setting.findOne({}) || {};
                 const paidCategories = validCategories.filter(cat => cat.priceType === "paid");
                 const prices = paidCategories.map(cat => cat.price ?? settings.professionalAdListingFee ?? 499);
                 const requiredFee = prices.reduce((sum, p) => sum + p, 0);

                 const currentAmountPaid = ad.paymentDetails?.amountPaid || 0;
                 const isExpired = ad.expiresAt && ad.expiresAt < new Date();
                 if (currentAmountPaid < requiredFee || isExpired) {
                     ad.paymentStatus = "unpaid";
                     ad.expiresAt = null;
                 }
             }
         }

        if (name) ad.name = name.trim();
        if (phone) ad.phone = phone.trim();
        if (email !== undefined) ad.email = email.trim();
        if (profession) ad.profession = profession.trim();
        if (experienceYears !== undefined) ad.experienceYears = Number(experienceYears) || 0;
        if (description) ad.description = description.trim();
        if (address) ad.address = address.trim();
        if (city) ad.city = city.trim();
        if (mediaUrl !== undefined) ad.mediaUrl = mediaUrl;
        if (mediaType !== undefined) ad.mediaType = mediaType;
        if (lat !== undefined && lng !== undefined) {
            ad.location = {
                type: "Point",
                coordinates: [Number(lng), Number(lat)],
            };
        }

        // Updating resets approval state to pending
        ad.approvalStatus = "pending";
        ad.isPublished = false;

        await ad.save();

        return handleResponse(res, 200, "Professional profile updated successfully and is pending admin approval", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const updateMyServices = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { services } = req.body; // Array of { name, description, price, durationMinutes }

        if (!Array.isArray(services)) {
            return handleResponse(res, 400, "Services must be an array of items");
        }

        const ad = await ProfessionalAd.findOne({ owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Professional profile not found");
        }

        ad.services = services.map(s => ({
            name: s.name?.trim() || "",
            description: s.description?.trim() || "",
            price: Number(s.price) || 0,
            durationMinutes: Number(s.durationMinutes) || 30,
        }));

        // Updating catalog resets approval state
        ad.approvalStatus = "pending";
        ad.isPublished = false;

        await ad.save();

        return handleResponse(res, 200, "Service catalog updated successfully and is pending admin approval", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const payMyAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const ad = await ProfessionalAd.findOne({ owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Professional profile not found");
        }

        if (ad.paymentStatus === "paid" && ad.expiresAt && ad.expiresAt > new Date()) {
            return handleResponse(res, 400, "Listing is already active and paid");
        }

        const categoryIds = ad.categories && ad.categories.length > 0 ? ad.categories : [ad.category].filter(Boolean);
        const categories = await ProfessionalCategory.find({ _id: { $in: categoryIds } });
        const settings = await Setting.findOne({}) || {};
        const validityDays = settings.professionalAdValidityDays ?? 30;

        let fee = 0;
        const defaultListingFee = settings.professionalAdListingFee ?? 499;

        if (categories.length > 0) {
            const hasPaidCategory = categories.some(cat => cat.priceType === "paid");
            if (hasPaidCategory) {
                const paidCategories = categories.filter(cat => cat.priceType === "paid");
                const prices = paidCategories.map(cat => cat.price ?? defaultListingFee);
                fee = prices.reduce((sum, p) => sum + p, 0);
            } else {
                fee = 0;
            }
        } else {
            fee = defaultListingFee;
        }

        if (fee > 0) {
            // Fetch user wallet
            const user = await User.findById(ownerId);
            if (!user) {
                return handleResponse(res, 404, "User account not found");
            }

            // Temporarily commented out for testing flow bypass
            /*
            if ((user.walletBalance || 0) < fee) {
                return handleResponse(res, 400, `Insufficient wallet balance. You need ₹${fee} but have ₹${user.walletBalance || 0}`);
            }
            */

            // Deduct wallet balance
            user.walletBalance = (user.walletBalance || 0) - fee;
            await user.save();

            // Create transaction history record
            const txnId = `TXN-AD-${Date.now()}`;
            await Transaction.create({
                user: ownerId,
                userModel: "User",
                type: "Wallet Payment",
                amount: -fee,
                status: "Settled",
                reference: txnId,
                meta: {
                    description: `Professional Listing Advertisement Fee for ${ad.profession}`,
                },
            });

            // Update ad profile listing status
            ad.paymentStatus = "paid";
            ad.paymentDetails = {
                transactionId: txnId,
                amountPaid: fee,
                paidAt: new Date(),
            };
        } else {
            // Free category listing activation
            ad.paymentStatus = "paid";
            ad.paymentDetails = {
                transactionId: `TXN-AD-FREE-${Date.now()}`,
                amountPaid: 0,
                paidAt: new Date(),
            };
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + validityDays);
        ad.expiresAt = expiryDate;

        // Auto-publish if already approved
        if (ad.approvalStatus === "approved") {
            ad.isPublished = true;
        }

        await ad.save();

        const successMsg = fee > 0
            ? "Listing payment successful! Your advertisement is now active."
            : "Free listing activated successfully! Your advertisement is now active.";

        return handleResponse(res, 200, successMsg, ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const searchAds = async (req, res) => {
    try {
        const { categoryId, city, q, lat, lng } = req.query;
        const settings = await Setting.findOne({}) || {};
        const maxRadiusKm = settings.professionalAdSearchRadiusKm ?? 15;

        const query = {
            approvalStatus: "approved",
            paymentStatus: "paid",
            expiresAt: { $gt: new Date() },
            isPublished: true,
        };

        if (categoryId) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { category: categoryId },
                    { categories: categoryId }
                ]
            });
        }

        if (city) {
            query.city = { $regex: new RegExp(`^${city.trim()}$`, "i") };
        }

        if (q) {
            const searchRegex = new RegExp(q.trim(), "i");
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { name: searchRegex },
                    { profession: searchRegex },
                    { description: searchRegex },
                    { "services.name": searchRegex },
                ]
            });
        }

        if (lat !== undefined && lng !== undefined) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            if (!isNaN(latitude) && !isNaN(longitude)) {
                query.location = {
                    $near: {
                        $geometry: { type: "Point", coordinates: [longitude, latitude] },
                        $maxDistance: maxRadiusKm * 1000,
                    },
                };
            }
        }

        const ads = await ProfessionalAd.find(query)
            .populate("category", "name")
            .lean();

        return handleResponse(res, 200, "Advertisements fetched successfully", ads);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin Moderation Endpoints
export const adminGetAds = async (req, res) => {
    try {
        const { status, paymentStatus } = req.query;
        const query = { paymentStatus: "paid" };

        if (status) query.approvalStatus = status;

        const ads = await ProfessionalAd.find(query)
            .populate("owner", "name phone email")
            .populate("category", "name")
            .populate("categories", "name")
            .sort({ createdAt: -1 })
            .lean();

        return handleResponse(res, 200, "All advertisements fetched successfully", ads);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const adminApproveAd = async (req, res) => {
    try {
        const { id } = req.params;
        const ad = await ProfessionalAd.findById(id);
        if (!ad) {
            return handleResponse(res, 404, "Advertisement listing not found");
        }

        ad.approvalStatus = "approved";
        ad.rejectionReason = null;

        // Auto publish if payment is complete
        if (ad.paymentStatus === "paid" && ad.expiresAt > new Date()) {
            ad.isPublished = true;
        }

        await ad.save();

        return handleResponse(res, 200, "Advertisement approved successfully", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const adminRejectAd = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return handleResponse(res, 400, "Rejection reason is required");
        }

        const ad = await ProfessionalAd.findById(id);
        if (!ad) {
            return handleResponse(res, 404, "Advertisement listing not found");
        }

        ad.approvalStatus = "rejected";
        ad.rejectionReason = reason;
        ad.isPublished = false;

        await ad.save();

        return handleResponse(res, 200, "Advertisement rejected successfully", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

const calculateListingFee = async (ad, settings) => {
    const categoryIds = ad.categories && ad.categories.length > 0 ? ad.categories : [ad.category].filter(Boolean);
    const categories = await ProfessionalCategory.find({ _id: { $in: categoryIds } });
    const defaultListingFee = settings.professionalAdListingFee ?? 499;

    let fee = 0;
    if (categories.length > 0) {
        const hasPaidCategory = categories.some(cat => cat.priceType === "paid");
        if (hasPaidCategory) {
            const paidCategories = categories.filter(cat => cat.priceType === "paid");
            const prices = paidCategories.map(cat => cat.price ?? defaultListingFee);
            fee = prices.reduce((sum, p) => sum + p, 0);
        } else {
            fee = 0;
        }
    } else {
        fee = defaultListingFee;
    }
    return fee;
};

const getRazorpayInstance = () => {
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_S2tOuYBZiOuLb4',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'tiR3NbQKSBa5mrdKyZbsnh7x'
    });
};

export const initiatePayMyAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const ad = await ProfessionalAd.findOne({ owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Professional profile not found");
        }

        if (ad.paymentStatus === "paid" && ad.expiresAt && ad.expiresAt > new Date()) {
            return handleResponse(res, 400, "Listing is already active and paid");
        }

        const settings = await Setting.findOne({}) || {};
        const fee = await calculateListingFee(ad, settings);

        if (fee <= 0) {
            return handleResponse(res, 200, "Free listing activation, no payment required", { isFree: true });
        }

        const razorpayInstance = getRazorpayInstance();
        const options = {
            amount: Math.round(fee * 100), // paise
            currency: "INR",
            receipt: `pr_${String(ad._id).slice(-10)}_${String(Date.now()).slice(-8)}`
        };

        let order;
        try {
            order = await razorpayInstance.orders.create(options);
        } catch (rzpError) {
            console.error("Razorpay orders.create error:", rzpError);
            return handleResponse(res, 400, "Razorpay configuration error: Invalid API keys or authentication failed.");
        }

        return handleResponse(res, 200, "Razorpay order initiated successfully", {
            isFree: false,
            orderId: order.id,
            amount: order.amount,
            keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_S2tOuYBZiOuLb4'
        });
    } catch (error) {
        console.error("initiatePayMyAd error:", error);
        return handleResponse(res, 500, error.message);
    }
};

export const verifyPayMyAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return handleResponse(res, 400, "Missing required Razorpay parameters");
        }

        const ad = await ProfessionalAd.findOne({ owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Professional profile not found");
        }

        // Verify signature
        const secret = process.env.RAZORPAY_KEY_SECRET || 'tiR3NbQKSBa5mrdKyZbsnh7x';
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return handleResponse(res, 400, "Payment signature verification failed");
        }

        const settings = await Setting.findOne({}) || {};
        const validityDays = settings.professionalAdValidityDays ?? 30;
        const fee = await calculateListingFee(ad, settings);

        // Update ad profile listing status
        ad.paymentStatus = "paid";
        ad.paymentDetails = {
            transactionId: razorpay_payment_id,
            amountPaid: fee,
            paidAt: new Date(),
        };

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + validityDays);
        ad.expiresAt = expiryDate;
        await ad.save();

        // Create transaction history record
        await Transaction.create({
            user: ownerId,
            userModel: "User",
            type: "Wallet Payment",
            amount: -fee,
            status: "Settled",
            reference: razorpay_payment_id,
            meta: {
                description: `Professional Listing Advertisement Fee (Razorpay) for ${ad.profession}`,
            },
        });

        return handleResponse(res, 200, "Listing payment verified and activated successfully", ad);
    } catch (error) {
        console.error("verifyPayMyAd error:", error);
        return handleResponse(res, 500, error.message);
    }
};
