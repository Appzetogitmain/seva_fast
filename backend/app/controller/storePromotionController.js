import StorePromotionPlan from "../models/storePromotionPlan.js";
import SellerStorePromotion from "../models/sellerStorePromotion.js";
import Seller from "../models/seller.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import crypto from "crypto";
import Razorpay from "razorpay";
import { debitWallet } from "../services/finance/walletService.js";
import { OWNER_TYPE } from "../constants/finance.js";

function resolveId(id) {
    const sId = String(id || "").trim();
    if (!sId || !mongoose.Types.ObjectId.isValid(sId)) {
        return null;
    }
    return sId;
}

/* =========================================================
   ADMIN STORE PROMOTION CONTROLLER METHODS
 ========================================================= */

// Create a new Store Promotion Plan
export const createPromotionPlan = async (req, res) => {
    try {
        const { name, amount, durationDays, benefits, badgeText, displayColor, description, sortOrder, isActive } = req.body;

        if (!name || amount === undefined || amount === null || !durationDays) {
            return handleResponse(res, 400, "Plan name, amount, and duration (days) are required");
        }

        const plan = await StorePromotionPlan.create({
            name: String(name).trim(),
            amount: Number(amount),
            durationDays: Number(durationDays),
            benefits: Array.isArray(benefits) ? benefits : [],
            badgeText: badgeText ? String(badgeText).trim() : "",
            displayColor: displayColor || "#6366f1",
            description: description ? String(description).trim() : "",
            sortOrder: sortOrder ? Number(sortOrder) : 0,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
        });

        return handleResponse(res, 201, "Store promotion plan created successfully", plan);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get all Store Promotion Plans (for Admin)
export const getAdminPromotionPlans = async (req, res) => {
    try {
        const plans = await StorePromotionPlan.find().sort({ sortOrder: 1, createdAt: -1 });
        return handleResponse(res, 200, "Store promotion plans fetched successfully", plans);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Update a Store Promotion Plan
export const updatePromotionPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const planId = resolveId(id);
        if (!planId) return handleResponse(res, 400, "Invalid plan ID");

        const plan = await StorePromotionPlan.findByIdAndUpdate(planId, req.body, { new: true, runValidators: true });
        if (!plan) return handleResponse(res, 404, "Store promotion plan not found");

        return handleResponse(res, 200, "Store promotion plan updated successfully", plan);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Delete a Store Promotion Plan
export const deletePromotionPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const planId = resolveId(id);
        if (!planId) return handleResponse(res, 400, "Invalid plan ID");

        const plan = await StorePromotionPlan.findByIdAndDelete(planId);
        if (!plan) return handleResponse(res, 404, "Store promotion plan not found");

        return handleResponse(res, 200, "Store promotion plan deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get all Seller Promotion Purchases (for Admin)
export const getAdminPromotionPurchases = async (req, res) => {
    try {
        const purchases = await SellerStorePromotion.find()
            .populate("seller", "name shopName email phone category city")
            .populate("plan", "name amount durationDays displayColor")
            .sort({ createdAt: -1 });

        return handleResponse(res, 200, "Store promotion purchases fetched successfully", purchases);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Update Promotion Campaign Status (Activate, Pause, Complete, Cancel)
export const updateCampaignStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { campaignStatus, adminNotes } = req.body;

        const promotionId = resolveId(id);
        if (!promotionId) return handleResponse(res, 400, "Invalid promotion purchase ID");

        const allowedStatuses = ["Pending Activation", "Active", "Paused", "Completed", "Cancelled"];
        if (!campaignStatus || !allowedStatuses.includes(campaignStatus)) {
            return handleResponse(res, 400, "Invalid campaign status provided");
        }

        const promotion = await SellerStorePromotion.findById(promotionId);
        if (!promotion) return handleResponse(res, 404, "Promotion purchase record not found");

        promotion.campaignStatus = campaignStatus;
        if (adminNotes !== undefined) {
            promotion.adminNotes = adminNotes;
        }

        if (campaignStatus === "Active") {
            const now = new Date();
            promotion.activatedAt = promotion.activatedAt || now;
            promotion.expiresAt = new Date(now.getTime() + promotion.durationDays * 24 * 60 * 60 * 1000);
        }

        await promotion.save();

        const updatedRecord = await SellerStorePromotion.findById(promotionId)
            .populate("seller", "name shopName email phone category city")
            .populate("plan", "name amount durationDays displayColor");

        return handleResponse(res, 200, `Promotion campaign status updated to ${campaignStatus}`, updatedRecord);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};


/* =========================================================
   SELLER STORE PROMOTION CONTROLLER METHODS
 ========================================================= */

// Get public active store promotion plans (for Seller Panel)
export const getPublicPromotionPlans = async (req, res) => {
    try {
        const plans = await StorePromotionPlan.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
        return handleResponse(res, 200, "Active store promotion plans fetched successfully", plans);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Initiate Razorpay order for store promotion plan purchase
export const initiatePromotionPurchase = async (req, res) => {
    try {
        const { planId: rawPlanId } = req.body;
        const sellerId = req.user._id || req.user.id;

        const planId = resolveId(rawPlanId);
        if (!planId) return handleResponse(res, 400, "Valid planId is required");

        const plan = await StorePromotionPlan.findById(planId);
        if (!plan) return handleResponse(res, 404, "Promotion plan not found");
        if (!plan.isActive) return handleResponse(res, 400, "This promotion plan is currently inactive");

        if (plan.amount === 0) {
            // Free promotion plan purchase
            const purchase = await SellerStorePromotion.create({
                seller: sellerId,
                plan: plan._id,
                planName: plan.name,
                amount: 0,
                durationDays: plan.durationDays,
                benefits: plan.benefits,
                paymentStatus: "Paid",
                campaignStatus: "Pending Activation",
                paidAt: new Date(),
            });

            return handleResponse(res, 200, "Free store promotion activated successfully", {
                success: true,
                isFree: true,
                purchaseId: purchase._id,
            });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || "dummy_key",
            key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
        });

        const options = {
            amount: Math.round(plan.amount * 100),
            currency: "INR",
            receipt: `rcpt_promo_${String(sellerId).slice(-5)}_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        return handleResponse(res, 200, "Promotion order initiated successfully", {
            success: true,
            orderId: order.id,
            amount: options.amount,
            currency: options.currency,
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            planName: plan.name,
            planAmount: plan.amount,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Verify payment and create promotion purchase record
export const verifyPromotionPurchase = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId: rawPlanId } = req.body;
        const sellerId = req.user._id || req.user.id;

        const planId = resolveId(rawPlanId);
        if (!planId) return handleResponse(res, 400, "Valid planId is required");

        const generated_signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dummy_secret")
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generated_signature !== razorpay_signature) {
            return handleResponse(res, 400, "Payment verification failed");
        }

        const plan = await StorePromotionPlan.findById(planId);
        if (!plan) return handleResponse(res, 404, "Store promotion plan not found");

        const purchase = await SellerStorePromotion.create({
            seller: sellerId,
            plan: plan._id,
            planName: plan.name,
            amount: plan.amount,
            durationDays: plan.durationDays,
            benefits: plan.benefits,
            paymentStatus: "Paid",
            campaignStatus: "Pending Activation",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            paidAt: new Date(),
        });

        return handleResponse(res, 200, "Store promotion plan purchased successfully!", purchase);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get Store Promotion Purchases for logged-in Seller
export const getSellerPromotions = async (req, res) => {
    try {
        const sellerId = req.user._id || req.user.id;
        const promotions = await SellerStorePromotion.find({ seller: sellerId })
            .populate("plan", "name displayColor badgeText")
            .sort({ createdAt: -1 });

        return handleResponse(res, 200, "Seller store promotions fetched successfully", promotions);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Pay for promotion using Seller Wallet Balance
export const payPromotionWithWallet = async (req, res) => {
    try {
        const { planId: rawPlanId } = req.body;
        const sellerId = req.user._id || req.user.id;

        const planId = resolveId(rawPlanId);
        if (!planId) return handleResponse(res, 400, "Valid planId is required");

        const plan = await StorePromotionPlan.findById(planId);
        if (!plan) return handleResponse(res, 404, "Promotion plan not found");
        if (!plan.isActive) return handleResponse(res, 400, "This promotion plan is currently inactive");

        // Debit wallet
        const debitResult = await debitWallet({
            ownerType: OWNER_TYPE.SELLER,
            ownerId: sellerId,
            amount: plan.amount,
            bucket: "available",
        });

        // Create promotion purchase record
        const purchase = await SellerStorePromotion.create({
            seller: sellerId,
            plan: plan._id,
            planName: plan.name,
            amount: plan.amount,
            durationDays: plan.durationDays,
            benefits: plan.benefits,
            paymentStatus: "Paid",
            campaignStatus: "Pending Activation",
            razorpayOrderId: `WALLET_${Date.now()}`,
            razorpayPaymentId: `WALLET_${Date.now()}`,
            paidAt: new Date(),
        });

        return handleResponse(res, 200, "Paid for store promotion using Wallet Balance successfully!", {
            success: true,
            purchase,
            newWalletBalance: debitResult.after,
        });
    } catch (error) {
        return handleResponse(res, 400, error.message);
    }
};

// Get active store promotion status & pre-expiry / expiry check for seller
export const getSellerPromotionStatus = async (req, res) => {
    try {
        const sellerId = req.user._id || req.user.id;
        const promotions = await SellerStorePromotion.find({ seller: sellerId })
            .sort({ createdAt: -1 });

        const now = new Date();
        let activePromotion = null;
        let hasActivePromotion = false;
        let isExpiringSoon = false;
        let isExpired = false;
        let hoursRemaining = 0;
        let daysRemaining = 0;
        let justExpiredPromotion = null;

        for (const promo of promotions) {
            if (promo.campaignStatus === "Active" || promo.campaignStatus === "Pending Activation") {
                if (promo.campaignStatus === "Active" && promo.expiresAt) {
                    const expiresAt = new Date(promo.expiresAt);
                    const msDiff = expiresAt.getTime() - now.getTime();
                    if (msDiff > 0) {
                        hasActivePromotion = true;
                        activePromotion = promo;
                        hoursRemaining = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60)));
                        daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
                        if (hoursRemaining <= 24) {
                            isExpiringSoon = true;
                        }
                        break;
                    } else {
                        // Mark as completed/expired
                        promo.campaignStatus = "Completed";
                        await promo.save();
                        isExpired = true;
                        justExpiredPromotion = promo;
                    }
                } else if (promo.campaignStatus === "Pending Activation") {
                    hasActivePromotion = true;
                    activePromotion = promo;
                    break;
                }
            }
        }

        return handleResponse(res, 200, "Seller promotion status fetched", {
            hasActivePromotion,
            activePromotion,
            isExpiringSoon,
            isExpired,
            hoursRemaining,
            daysRemaining,
            justExpiredPromotion,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
