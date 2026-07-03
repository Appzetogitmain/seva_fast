import Plan from "../models/plan.js";
import User from "../models/customer.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import crypto from "crypto";
import Razorpay from "razorpay";
import { processPlanPurchaseLevelCommissions } from "../services/finance/commissionService.js";
import { resolvePlanPurchaseReferrer } from "../services/referralService.js";
import { upsertPlanSubscription } from "../services/planSubscriptionService.js";

function resolvePlanId(rawPlanId) {
    const planId = String(rawPlanId || "").trim();
    if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
        return null;
    }
    return planId;
}

/* ===============================
   ADMIN: CREATE PLAN
 ================================ */
export const createPlan = async (req, res) => {
    try {
        const plan = await Plan.create(req.body);
        return handleResponse(res, 201, "Plan created successfully", plan);
    } catch (error) {
        if (error.code === 11000) return handleResponse(res, 400, "Plan name must be unique");
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADMIN: UPDATE PLAN
 ================================ */
export const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await Plan.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!plan) return handleResponse(res, 404, "Plan not found");
        return handleResponse(res, 200, "Plan updated successfully", plan);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADMIN: DELETE PLAN
 ================================ */
export const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await Plan.findByIdAndDelete(id);
        if (!plan) return handleResponse(res, 404, "Plan not found");
        return handleResponse(res, 200, "Plan deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET ALL PLANS
 ================================ */
export const getPlans = async (req, res) => {
    try {
        const query = req.user?.role === "admin" ? {} : { isActive: true };
        const plans = await Plan.find(query).sort({ sortOrder: 1, createdAt: -1 });
        return handleResponse(res, 200, "Plans fetched successfully", plans);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   USER: INITIATE SUBSCRIPTION
 ================================ */
export const createPlanOrder = async (req, res) => {
    try {
        const { planId: rawPlanId, referralCode } = req.body;
        const userId = req.user.id;
        const planId = resolvePlanId(rawPlanId);

        if (!planId) {
            return handleResponse(res, 400, "A valid planId is required");
        }

        const plan = await Plan.findById(planId);
        if (!plan) {
            return handleResponse(res, 404, "Plan not found");
        }
        if (!plan.isActive) {
            return handleResponse(res, 400, "This plan is currently inactive");
        }

        const referredBy = await resolvePlanPurchaseReferrer(userId, {
            referralCode,
        });

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || "dummy_key",
            key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret"
        });

        const options = {
            amount: Math.round(plan.price * 100),
            currency: "INR",
            receipt: `rcpt_${userId.toString().slice(-5)}_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        return handleResponse(res, 200, "Order initiated successfully", { 
            success: true, 
            orderId: order.id, 
            amount: options.amount, 
            currency: options.currency,
            referredBy,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   USER: VERIFY AND SUBSCRIBE
 ================================ */
export const verifyPlanPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId: rawPlanId, referredBy } = req.body;
        const userId = req.user.id;
        const planId = resolvePlanId(rawPlanId);

        if (!planId) {
            return handleResponse(res, 400, "A valid planId is required");
        }

        const generated_signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dummy_secret")
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generated_signature !== razorpay_signature) {
            return handleResponse(res, 400, "Payment verification failed");
        }

        const plan = await Plan.findById(planId);
        if (!plan) return handleResponse(res, 404, "Plan not found");
        if (!plan.isActive) {
            return handleResponse(res, 400, "This plan is currently inactive");
        }

        const existingUser = await User.findById(userId).select("referredBy planSubscriptions");
        if (!existingUser) return handleResponse(res, 404, "User not found");

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (plan.validityDays || 365));

        const permissions = plan.features
            .filter(f => f.unit === "Boolean" && f.value === true)
            .map(f => f.key);

        const updateData = {
            currentPlan: plan._id,
            planExpiry: expiryDate,
            permissions: permissions,
            planSubscriptions: upsertPlanSubscription(existingUser.planSubscriptions, {
                planId: plan._id,
                validityDays: plan.validityDays || 365,
                paymentReference: razorpay_payment_id,
            }),
        };

        if (referredBy && !existingUser.referredBy) {
            updateData.referredBy = referredBy;
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        )
            .populate("currentPlan")
            .populate("planSubscriptions.plan")
            .populate("referredBy", "name phone referralCode role");

        try {
            await processPlanPurchaseLevelCommissions({
                buyerId: userId,
                planPrice: plan.price,
                planId: plan._id,
                planName: plan.name,
                paymentReference: razorpay_payment_id,
                directReferrerId: referredBy || null,
            });
        } catch (commissionError) {
            console.error(
                "[planController] Plan referral commission failed after successful payment:",
                commissionError?.message || commissionError,
            );
        }

        return handleResponse(res, 200, "Subscribed to plan successfully", updatedUser);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
