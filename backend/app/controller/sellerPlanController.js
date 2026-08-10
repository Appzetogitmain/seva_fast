import SellerPlan from "../models/sellerPlan.js";
import Seller from "../models/seller.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import crypto from "crypto";
import Razorpay from "razorpay";

function resolveId(id) {
    const sId = String(id || "").trim();
    if (!sId || !mongoose.Types.ObjectId.isValid(sId)) {
        return null;
    }
    return sId;
}

/* =========================================================
   ADMIN CONTROLLER METHODS
 ========================================================= */

// Create a new seller plan
export const createSellerPlan = async (req, res) => {
    try {
        const { name, price, originalPrice, validityDays, description, features, displayColor, badgeText, sortOrder, isActive } = req.body;
        
        if (!name || price === undefined || !validityDays) {
            return handleResponse(res, 400, "Name, price, and validityDays are required");
        }

        const plan = await SellerPlan.create({
            name,
            price: Number(price),
            originalPrice: originalPrice ? Number(originalPrice) : undefined,
            validityDays: Number(validityDays),
            description,
            features: Array.isArray(features) ? features : [],
            displayColor: displayColor || "#0ea5e9",
            badgeText: badgeText || "",
            sortOrder: sortOrder ? Number(sortOrder) : 0,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
        });

        return handleResponse(res, 201, "Seller subscription plan created successfully", plan);
    } catch (error) {
        if (error.code === 11000) return handleResponse(res, 400, "A seller plan with this name already exists");
        return handleResponse(res, 500, error.message);
    }
};

// Get all seller plans (for Admin)
export const getAdminSellerPlans = async (req, res) => {
    try {
        const plans = await SellerPlan.find().sort({ sortOrder: 1, createdAt: -1 });
        return handleResponse(res, 200, "Seller plans fetched successfully", plans);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Update a seller plan
export const updateSellerPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const planId = resolveId(id);
        if (!planId) return handleResponse(res, 400, "Invalid plan ID");

        const plan = await SellerPlan.findByIdAndUpdate(planId, req.body, { new: true, runValidators: true });
        if (!plan) return handleResponse(res, 404, "Seller plan not found");

        return handleResponse(res, 200, "Seller plan updated successfully", plan);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Delete a seller plan
export const deleteSellerPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const planId = resolveId(id);
        if (!planId) return handleResponse(res, 400, "Invalid plan ID");

        const plan = await SellerPlan.findByIdAndDelete(planId);
        if (!plan) return handleResponse(res, 404, "Seller plan not found");

        return handleResponse(res, 200, "Seller plan deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin manually assigns or updates a plan for a specific seller
export const assignSellerPlanToSeller = async (req, res) => {
    try {
        const { id } = req.params; // sellerId
        const { planId: rawPlanId, customValidityDays, paymentReference } = req.body;
        
        const sellerId = resolveId(id);
        if (!sellerId) return handleResponse(res, 400, "Invalid seller ID");

        const seller = await Seller.findById(sellerId);
        if (!seller) return handleResponse(res, 404, "Seller not found");

        let planName = "Custom Admin Plan";
        let validityDays = Number(customValidityDays) || 30;
        let pricePaid = 0;
        let pId = null;

        if (rawPlanId) {
            pId = resolveId(rawPlanId);
            if (pId) {
                const plan = await SellerPlan.findById(pId);
                if (plan) {
                    planName = plan.name;
                    validityDays = Number(customValidityDays) || plan.validityDays || 30;
                    pricePaid = plan.price;
                }
            }
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

        seller.commissionModel = "PLAN_BASED";
        seller.subscription = {
            planId: pId,
            planName,
            pricePaid,
            validityDays,
            purchasedAt: now,
            expiresAt,
            paymentReference: paymentReference || "ADMIN_ASSIGNED",
            status: "active",
        };

        await seller.save();

        return handleResponse(res, 200, "Plan assigned to seller successfully", seller);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};


/* =========================================================
   SELLER CONTROLLER METHODS
 ========================================================= */

// Get public active seller plans (for Seller Panel)
export const getPublicSellerPlans = async (req, res) => {
    try {
        const plans = await SellerPlan.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
        return handleResponse(res, 200, "Active seller plans fetched", plans);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Initiate Razorpay order for seller plan purchase
export const initiateSellerPlanPurchase = async (req, res) => {
    try {
        const { planId: rawPlanId } = req.body;
        const sellerId = req.user._id || req.user.id;

        const planId = resolveId(rawPlanId);
        if (!planId) return handleResponse(res, 400, "Valid planId is required");

        const plan = await SellerPlan.findById(planId);
        if (!plan) return handleResponse(res, 404, "Seller plan not found");
        if (!plan.isActive) return handleResponse(res, 400, "This plan is currently inactive");

        if (plan.price === 0) {
            // Free seller plan activation
            const now = new Date();
            const expiresAt = new Date(now.getTime() + (plan.validityDays || 30) * 24 * 60 * 60 * 1000);

            await Seller.findByIdAndUpdate(sellerId, {
                $set: {
                    commissionModel: "PLAN_BASED",
                    subscription: {
                        planId: plan._id,
                        planName: plan.name,
                        pricePaid: 0,
                        validityDays: plan.validityDays,
                        purchasedAt: now,
                        expiresAt: expiresAt,
                        paymentReference: `FREE_${Date.now()}`,
                        status: "active",
                    }
                }
            });

            return handleResponse(res, 200, "Free seller plan activated successfully", {
                success: true,
                isFree: true,
                orderId: `free_seller_${Date.now()}`
            });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || "dummy_key",
            key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret"
        });

        const options = {
            amount: Math.round(plan.price * 100),
            currency: "INR",
            receipt: `rcpt_slr_${String(sellerId).slice(-5)}_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        return handleResponse(res, 200, "Order initiated successfully", {
            success: true,
            orderId: order.id,
            amount: options.amount,
            currency: options.currency,
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            planName: plan.name,
            planPrice: plan.price
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Verify payment and activate plan for seller
export const verifySellerPlanPurchase = async (req, res) => {
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

        const plan = await SellerPlan.findById(planId);
        if (!plan) return handleResponse(res, 404, "Seller plan not found");

        const now = new Date();
        const expiresAt = new Date(now.getTime() + (plan.validityDays || 30) * 24 * 60 * 60 * 1000);

        const updatedSeller = await Seller.findByIdAndUpdate(
            sellerId,
            {
                $set: {
                    commissionModel: "PLAN_BASED",
                    subscription: {
                        planId: plan._id,
                        planName: plan.name,
                        pricePaid: plan.price,
                        validityDays: plan.validityDays,
                        purchasedAt: now,
                        expiresAt: expiresAt,
                        paymentReference: razorpay_payment_id,
                        status: "active",
                    }
                }
            },
            { new: true }
        );

        return handleResponse(res, 200, "Subscribed to plan successfully!", updatedSeller);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Get seller subscription status & 24h pre-expiry warning check
export const getSellerSubscriptionStatus = async (req, res) => {
    try {
        const sellerId = req.user._id || req.user.id;
        const seller = await Seller.findById(sellerId).select("commissionModel subscription category");

        if (!seller) return handleResponse(res, 404, "Seller not found");

        const now = new Date();
        const subscription = seller.subscription || {};
        const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
        
        let status = "none";
        let isExpiringSoon = false; // Within 24 hours
        let isExpired = false;
        let hoursRemaining = 0;
        let daysRemaining = 0;

        if (seller.commissionModel === "PLAN_BASED" && expiresAt) {
            const msDiff = expiresAt.getTime() - now.getTime();
            if (msDiff > 0) {
                status = "active";
                hoursRemaining = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60)));
                daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
                if (hoursRemaining <= 24) {
                    isExpiringSoon = true;
                }
            } else {
                status = "expired";
                isExpired = true;
                // Auto-mark status as expired if not already
                if (seller.subscription?.status !== "expired") {
                    await Seller.findByIdAndUpdate(sellerId, {
                        "subscription.status": "expired"
                    });
                }
            }
        } else if (seller.commissionModel === "CATEGORY_WISE") {
            status = "category_wise";
        }

        return handleResponse(res, 200, "Seller subscription status fetched", {
            commissionModel: seller.commissionModel,
            subscription: seller.subscription,
            status,
            isExpiringSoon,
            isExpired,
            hoursRemaining,
            daysRemaining,
            now: now.toISOString(),
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Switch back to category-wise commission (Only allowed after plan expires)
export const switchToCategoryCommission = async (req, res) => {
    try {
        const sellerId = req.user._id || req.user.id;
        const seller = await Seller.findById(sellerId);
        if (seller?.commissionModel === "PLAN_BASED" && seller?.subscription?.expiresAt && new Date(seller.subscription.expiresAt) > new Date()) {
            return handleResponse(res, 400, "Active subscription plan cannot be cancelled early. Your 0% Commission Pass will remain active until its expiration date.");
        }

        const updatedSeller = await Seller.findByIdAndUpdate(
            sellerId,
            {
                $set: {
                    commissionModel: "CATEGORY_WISE",
                    "subscription.status": "expired"
                }
            },
            { new: true }
        );
        return handleResponse(res, 200, "Switched to Category-Wise Commission successfully", updatedSeller);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
