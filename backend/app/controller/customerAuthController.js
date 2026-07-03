import crypto from "crypto";
import Customer from "../models/customer.js";
import Transaction from "../models/transaction.js";
import Order from "../models/order.js";
import jwt from "jsonwebtoken";
import handleResponse from "../utils/helper.js";
import {
    issueCustomerOtp,
    sanitizeCustomer,
    verifyCustomerOtpCode,
} from "../services/otpAuthService.js";
import {
    sendLoginOtpSchema,
    sendSignupOtpSchema,
    validateSchema,
    verifyOtpSchema,
} from "../validation/customerAuthValidation.js";
import { recordAuthActivity } from "../services/authActivityService.js";
import { ensurePlanSubscriptionsSynced } from "../services/planSubscriptionService.js";

const CUSTOMER_REFERRED_BY_FIELDS = "name phone referralCode role";

async function loadCustomerProfile(customerId) {
    await ensurePlanSubscriptionsSynced(customerId);
    return Customer.findById(customerId)
        .populate("currentPlan")
        .populate("planSubscriptions.plan")
        .populate("referredBy", CUSTOMER_REFERRED_BY_FIELDS);
}

const generateToken = (customer) =>
    jwt.sign(
        { id: customer._id, role: "customer" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

/* ===============================
   SIGNUP – Send OTP
================================ */
export const signupCustomer = async (req, res) => {
    try {
        const payload = validateSchema(sendSignupOtpSchema, req.body || {});

        await issueCustomerOtp({
            name: payload.name,
            rawPhone: payload.phone,
            flow: "signup",
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "If the number is eligible, OTP has been sent");
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   LOGIN – Send OTP
================================ */
export const loginCustomer = async (req, res) => {
    try {
        const payload = validateSchema(sendLoginOtpSchema, req.body || {});

        await issueCustomerOtp({
            rawPhone: payload.phone,
            flow: "login",
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "If the number is eligible, OTP has been sent");
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   VERIFY OTP – Login / Signup
================================ */
export const verifyCustomerOTP = async (req, res) => {
    try {
        const payload = validateSchema(verifyOtpSchema, req.body || {});
        const customer = await verifyCustomerOtpCode({
            rawPhone: payload.phone,
            otp: payload.otp,
            ipAddress: req.ip,
        });
        await customer.populate("currentPlan");
        await customer.populate("planSubscriptions.plan");
        await customer.populate("referredBy", CUSTOMER_REFERRED_BY_FIELDS);

        await recordAuthActivity({
            role: "customer",
            action: "login",
            userId: customer._id,
            user: customer,
            req,
        });

        const token = generateToken(customer);

        return handleResponse(
            res,
            200,
            "Login successful",
            {
                token,
                customer: sanitizeCustomer(customer),
            }
        );
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET PROFILE
================================ */
export const getCustomerProfile = async (req, res) => {
    try {
        const customer = await loadCustomerProfile(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }
        
        // Ensure legacy users have a referral code
        if (!customer.referralCode) {
            customer.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            await customer.save();
        }

        return handleResponse(res, 200, "Profile fetched successfully", customer);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET REFERRAL TREE
================================ */
export const getCustomerReferralTree = async (req, res) => {
    try {
        const userId = req.user.id;
        const rootUser = await Customer.findById(userId).populate("currentPlan").lean();
        if (!rootUser) {
            return handleResponse(res, 404, "Customer not found");
        }

        // Trigger fallback check and reward
        try {
            const { checkAndRewardMonthlyReferralTarget } = await import("../services/finance/commissionService.js");
            await checkAndRewardMonthlyReferralTarget(userId);
        } catch (e) {
            console.error("Error running checkAndRewardMonthlyReferralTarget fallback:", e);
        }

        // Calculate monthly target details
        let monthlyTarget = null;
        let monthlyTargetReward = null;
        let currentMonthReferralsCount = 0;
        let isTargetAchieved = false;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Count referrals in current month
        currentMonthReferralsCount = await Customer.countDocuments({
            referredBy: userId,
            isVerified: true,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (rootUser.currentPlan && Array.isArray(rootUser.currentPlan.features)) {
            const targetFeature = rootUser.currentPlan.features.find(f => f.key === "MONTHLY_REFERRAL_TARGET");
            const rewardFeature = rootUser.currentPlan.features.find(f => f.key === "MONTHLY_TARGET_REWARD");
            if (targetFeature) {
                monthlyTarget = Number(targetFeature.value) || 0;
            }
            if (rewardFeature) {
                monthlyTargetReward = Number(rewardFeature.value) || 0;
            }
        }

        if (monthlyTarget !== null && monthlyTarget > 0 && currentMonthReferralsCount >= monthlyTarget) {
            isTargetAchieved = true;
        }

        const targetDetails = {
            monthlyTarget,
            monthlyTargetReward,
            currentMonthReferralsCount,
            isTargetAchieved,
            monthName: now.toLocaleString('default', { month: 'long' }),
            year: now.getFullYear()
        };

        // Fetch all settled level-wise commissions/incentives for this user first
        const commissions = await Transaction.find({
            user: userId,
            type: { $in: ["Commission", "Incentive"] },
            status: "Settled"
        }).lean();

        // Extract order IDs to trace referee customer IDs
        const orderIds = commissions.map(tx => tx.meta?.orderId).filter(Boolean);
        const orders = await Order.find({ _id: { $in: orderIds } }).select("customer").lean();
        
        const orderToCustomerMap = {};
        orders.forEach(o => {
            if (o.customer) {
                orderToCustomerMap[o._id.toString()] = o.customer.toString();
            }
        });

        // Sum earnings per level and per specific customer
        const earningsByLevel = {};
        const earningsByCustomer = {};
        commissions.forEach(tx => {
            const level = tx.meta?.level;
            if (level !== undefined && level !== null) {
                earningsByLevel[level] = (earningsByLevel[level] || 0) + (tx.amount || 0);
            }

            const orderId = tx.meta?.orderId?.toString();
            if (orderId && orderToCustomerMap[orderId]) {
                const custId = orderToCustomerMap[orderId];
                earningsByCustomer[custId] = (earningsByCustomer[custId] || 0) + (tx.amount || 0);
            }
        });

        const buildTree = async (parentId, maxDepth = 5, currentDepth = 1) => {
            if (currentDepth > maxDepth) return [];
            const children = await Customer.find({ referredBy: parentId })
                .select("name phone referralCode createdAt")
                .lean();

            const nodes = [];
            for (const child of children) {
                const subtree = await buildTree(child._id, maxDepth, currentDepth + 1);
                nodes.push({
                    _id: child._id,
                    name: child.name || "Customer",
                    phone: child.phone,
                    referralCode: child.referralCode || "N/A",
                    level: currentDepth,
                    earnings: earningsByCustomer[child._id.toString()] || 0,
                    children: subtree
                });
            }
            return nodes;
        };

        const tree = {
            _id: rootUser._id,
            name: rootUser.name || "Me",
            phone: rootUser.phone,
            referralCode: rootUser.referralCode || "N/A",
            level: 0,
            earnings: 0,
            children: await buildTree(rootUser._id)
        };

        return handleResponse(res, 200, "Referral tree fetched successfully", {
            tree,
            earningsByLevel,
            targetDetails
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   UPDATE PROFILE
================================ */
export const updateCustomerProfile = async (req, res) => {
    try {
        const { name, email, addresses } = req.body;

        const customer = await Customer.findById(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        if (name) customer.name = name;
        if (email) customer.email = email;
        if (addresses) customer.addresses = addresses;

        await customer.save();

        const updatedCustomer = await loadCustomerProfile(customer._id);

        return handleResponse(res, 200, "Profile updated successfully", updatedCustomer);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET WALLET TRANSACTIONS
================================ */
export const getCustomerTransactions = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, Math.max(1, parseInt(limit, 10)));
        const perPage = Math.min(50, Math.max(1, parseInt(limit, 10)));

        const [transactions, total] = await Promise.all([
            Transaction.find({ user: customerId, userModel: "User" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(perPage)
                .populate("order", "orderId")
                .lean(),
            Transaction.countDocuments({ user: customerId, userModel: "User" }),
        ]);

        const items = transactions.map((t) => {
            const isCredit = t.amount > 0 || t.type === "Refund" || t.type === "Cashback";
            return {
                _id: t._id,
                type: isCredit ? "credit" : "debit",
                title: t.meta?.description || t.type,
                amount: Math.abs(t.amount),
                date: t.createdAt,
                reference: t.reference,
                orderId: t.order?.orderId,
            };
        });

        return handleResponse(res, 200, "Transactions fetched", {
            items,
            total,
            page: parseInt(page, 10),
            totalPages: Math.ceil(total / perPage) || 1,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
