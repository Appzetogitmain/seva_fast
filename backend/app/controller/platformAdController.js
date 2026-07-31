import PlatformAd from "../models/platformAd.js";
import User from "../models/customer.js";
import Transaction from "../models/transaction.js";
import Setting from "../models/setting.js";
import handleResponse from "../utils/helper.js";
import Razorpay from "razorpay";
import crypto from "crypto";

// Create platform ad request
export const createPlatformAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { title, content, mediaUrl, mediaType, targetUrl, city, imageUrl, videoUrl } = req.body;

        if (!title || !content || !city) {
            return handleResponse(res, 400, "Title, content, and city are required fields");
        }

        const settings = await Setting.findOne({}) || {};
        const fee = settings.platformAdListingFee ?? settings.platformAdFeePhoto ?? 999;

        const newAd = await PlatformAd.create({
            owner: ownerId,
            title: title.trim(),
            content: content.trim(),
            mediaUrl: mediaUrl || "",
            mediaType: mediaType || "none",
            imageUrl: imageUrl || "",
            videoUrl: videoUrl || "",
            targetUrl: targetUrl || "",
            city: city.trim(),
            approvalStatus: "pending",
            paymentStatus: "unpaid",
            price: fee
        });

        return handleResponse(res, 201, "Platform advertisement request submitted successfully", newAd);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Update platform ad request
export const updatePlatformAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { id } = req.params;
        const { title, content, mediaUrl, mediaType, targetUrl, city, imageUrl, videoUrl } = req.body;

        if (!title || !content || !city) {
            return handleResponse(res, 400, "Title, content, and city are required fields");
        }

        const ad = await PlatformAd.findOne({ _id: id, owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Platform advertisement not found");
        }

        ad.title = title.trim();
        ad.content = content.trim();
        if (mediaUrl !== undefined) ad.mediaUrl = mediaUrl;
        if (mediaType !== undefined) ad.mediaType = mediaType;
        if (imageUrl !== undefined) ad.imageUrl = imageUrl;
        if (videoUrl !== undefined) ad.videoUrl = videoUrl;
        if (targetUrl !== undefined) ad.targetUrl = targetUrl;
        ad.city = city.trim();

        // Reset approval status since content changed
        ad.approvalStatus = "pending";
        ad.rejectionReason = "";
        
        await ad.save();

        return handleResponse(res, 200, "Platform advertisement updated successfully", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get current user's platform ads
export const getMyPlatformAds = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const ads = await PlatformAd.find({ owner: ownerId }).sort({ createdAt: -1 });
        return handleResponse(res, 200, "My platform advertisements fetched successfully", ads);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Pay for platform ad from wallet
export const payPlatformAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { id } = req.params;

        const ad = await PlatformAd.findOne({ _id: id, owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Advertisement request not found");
        }

        if (ad.paymentStatus === "paid") {
            return handleResponse(res, 400, "Advertisement is already paid");
        }

        const settings = await Setting.findOne({}) || {};
        const fee = settings.platformAdListingFee ?? settings.platformAdFeePhoto ?? 999;
        ad.price = fee;

        // Fetch user wallet
        const user = await User.findById(ownerId);
        if (!user) {
            return handleResponse(res, 404, "User account not found");
        }

        if ((user.walletBalance || 0) < fee) {
            return handleResponse(res, 400, `Insufficient wallet balance. You need ₹${fee} but have ₹${user.walletBalance || 0}`);
        }

        // Deduct wallet balance
        user.walletBalance = (user.walletBalance || 0) - fee;
        await user.save();

        // Create transaction history record
        const txnId = `TXN-PLAD-${Date.now()}`;
        await Transaction.create({
            user: ownerId,
            userModel: "User",
            type: "Wallet Payment",
            amount: -fee,
            status: "Settled",
            reference: txnId,
            meta: {
                description: `Platform Banner Ad Subscription Fee for "${ad.title}"`,
            },
        });

        // Update ad listing status
        ad.paymentStatus = "paid";
        ad.paymentDetails = {
            transactionId: txnId,
            amountPaid: fee,
            paidAt: new Date(),
        };

        ad.isPublished = false;

        await ad.save();

        return handleResponse(res, 200, "Platform advertisement payment successful! Your ad is now active.", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin retrieve all platform ads
export const adminGetPlatformAds = async (req, res) => {
    try {
        const { status } = req.query;
        const query = { paymentStatus: "paid" };

        if (status) query.approvalStatus = status;

        const ads = await PlatformAd.find(query)
            .populate("owner", "name phone email")
            .sort({ createdAt: -1 })
            .lean();

        return handleResponse(res, 200, "All platform advertisements fetched successfully", ads);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin approve platform ad
export const adminApprovePlatformAd = async (req, res) => {
    try {
        const { id } = req.params;
        const ad = await PlatformAd.findById(id);
        if (!ad) {
            return handleResponse(res, 404, "Platform advertisement not found");
        }

        ad.approvalStatus = "approved";
        ad.rejectionReason = "";

        // Auto publish if payment is complete
        if (ad.paymentStatus === "paid") {
            ad.isPublished = true;
        }

        await ad.save();

        return handleResponse(res, 200, "Platform advertisement approved successfully", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin reject platform ad
export const adminRejectPlatformAd = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return handleResponse(res, 400, "Rejection reason is required");
        }

        const ad = await PlatformAd.findById(id);
        if (!ad) {
            return handleResponse(res, 404, "Platform advertisement not found");
        }

        ad.approvalStatus = "rejected";
        ad.rejectionReason = reason;
        ad.isPublished = false;

        await ad.save();

        return handleResponse(res, 200, "Platform advertisement rejected successfully", ad);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get active (approved, paid, published) platform ads for public display
export const getActivePlatformAds = async (req, res) => {
    try {
        const { city } = req.query;
        const query = {
            approvalStatus: "approved",
            paymentStatus: "paid",
            isPublished: true
        };

        if (city) {
            query.city = new RegExp(city.trim(), "i");
        }

        const ads = await PlatformAd.find(query).sort({ createdAt: -1 });
        return handleResponse(res, 200, "Active platform ads fetched successfully", ads);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

const getRazorpayInstance = () => {
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_S2tOuYBZiOuLb4',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'tiR3NbQKSBa5mrdKyZbsnh7x'
    });
};

export const initiatePayPlatformAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { id } = req.params;

        const ad = await PlatformAd.findOne({ _id: id, owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Advertisement request not found");
        }

        if (ad.paymentStatus === "paid") {
            return handleResponse(res, 400, "Advertisement is already paid");
        }

        const settings = await Setting.findOne({}) || {};
        const fee = settings.platformAdListingFee ?? settings.platformAdFeePhoto ?? 999;
        ad.price = fee;
        await ad.save();

        const razorpayInstance = getRazorpayInstance();
        const options = {
            amount: Math.round(fee * 100), // paise
            currency: "INR",
            receipt: `pl_${String(ad._id).slice(-10)}_${String(Date.now()).slice(-8)}`
        };

        let order;
        try {
            order = await razorpayInstance.orders.create(options);
        } catch (rzpError) {
            console.error("Razorpay orders.create error:", rzpError);
            return handleResponse(res, 400, "Razorpay configuration error: Invalid API keys or authentication failed.");
        }

        return handleResponse(res, 200, "Razorpay order initiated successfully", {
            orderId: order.id,
            amount: order.amount,
            keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_S2tOuYBZiOuLb4'
        });
    } catch (error) {
        console.error("initiatePayPlatformAd error:", error);
        return handleResponse(res, 500, error.message);
    }
};

export const verifyPayPlatformAd = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { id } = req.params;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return handleResponse(res, 400, "Missing required Razorpay parameters");
        }

        const ad = await PlatformAd.findOne({ _id: id, owner: ownerId });
        if (!ad) {
            return handleResponse(res, 404, "Advertisement request not found");
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
        const fee = settings.platformAdListingFee ?? settings.platformAdFeePhoto ?? 999;

        // Update ad listing status
        ad.paymentStatus = "paid";
        ad.paymentDetails = {
            transactionId: razorpay_payment_id,
            amountPaid: fee,
            paidAt: new Date(),
        };

        const validityDays = settings.professionalAdValidityDays ?? 30;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + validityDays);
        ad.expiresAt = expiryDate;
        ad.approvalStatus = "pending";
        ad.isPublished = false;
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
                description: `Platform Banner Ad Subscription Fee (Razorpay) for "${ad.title}"`,
            },
        });

        return handleResponse(res, 200, "Platform ad payment verified and activated successfully", ad);
    } catch (error) {
        console.error("verifyPayPlatformAd error:", error);
        return handleResponse(res, 500, error.message);
    }
};
