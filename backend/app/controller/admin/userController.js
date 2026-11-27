import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import {
  getUserByIdData,
  getUsersData,
  updateUserWalletData,
} from "../../services/admin/userAdminService.js";
import Customer from "../../models/customer.js";
import Transaction from "../../models/transaction.js";
import Order from "../../models/order.js";
import { markCustomerAccessChanged } from "../../middleware/authMiddleware.js";

export const getUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 200,
    });

    const data = await getUsersData({ page, limit, skip });
    return handleResponse(res, 200, "Users fetched successfully", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserByIdData(id);

    if (!user) {
      return handleResponse(res, 404, "Customer not found");
    }

    return handleResponse(
      res,
      200,
      "Customer details fetched successfully",
      user,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateUserWallet = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, action, reason } = req.body;
    
    if (!amount || !action) {
      return handleResponse(res, 400, "Amount and action (add/deduct) are required");
    }

    const result = await updateUserWalletData(id, amount, action, reason);
    return handleResponse(res, 200, "Wallet updated successfully", result);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

export const getUserReferralTree = async (req, res) => {
  try {
    const userId = req.params.id;
    const rootUser = await Customer.findById(userId).populate("currentPlan").lean();
    if (!rootUser) {
      return handleResponse(res, 404, "Customer not found");
    }

    // Trigger fallback check and reward
    try {
      const { checkAndRewardMonthlyReferralTarget } = await import("../../services/finance/commissionService.js");
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
   BLOCK / UNBLOCK CUSTOMER
================================ */
const OPEN_RETURN_STATUSES = [
  "return_requested",
  "return_approved",
  "return_pickup_assigned",
  "picked_up",
  "return_in_transit",
  "return_drop_pending",
];

export const setUserStatus = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return handleResponse(res, 403, "Only the main admin can block or unblock customers");
    }
    const { id } = req.params;
    const { isActive } = req.body || {};
    if (typeof isActive !== "boolean") {
      return handleResponse(res, 400, "isActive (true/false) is required");
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, role: "user" },
      { $set: { isActive } },
      { new: true },
    ).select("name phone isActive");
    if (!customer) return handleResponse(res, 404, "Customer not found");

    markCustomerAccessChanged(id);

    return handleResponse(
      res,
      200,
      isActive ? "Customer unblocked" : "Customer blocked",
      { id: customer._id, status: customer.isActive ? "active" : "inactive" },
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   PERMANENTLY DELETE CUSTOMER
   Removes the profile and personal data (cart, wishlist, push tokens,
   notification settings, notifications). Orders, payments and wallet
   transactions are kept because they are financial records shared with
   sellers/riders; they will show as "Deleted customer".
================================ */
export const deleteUser = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return handleResponse(res, 403, "Only the main admin can delete customers");
    }
    const { id } = req.params;
    const customer = await Customer.findOne({ _id: id, role: "user" }).select("_id name").lean();
    if (!customer) return handleResponse(res, 404, "Customer not found");

    const [activeOrders, openReturns] = await Promise.all([
      Order.countDocuments({
        customer: id,
        status: { $nin: ["delivered", "cancelled"] },
        // Abandoned unpaid online checkouts never progress; don't let them block deletion.
        $nor: [{ paymentMode: "ONLINE", workflowStatus: "CREATED" }],
      }),
      Order.countDocuments({ customer: id, returnStatus: { $in: OPEN_RETURN_STATUSES } }),
    ]);
    if (activeOrders > 0 || openReturns > 0) {
      return handleResponse(
        res,
        409,
        `Cannot delete: customer has ${activeOrders} active order(s) and ${openReturns} open return(s). Complete or cancel them first, or block the customer instead.`,
      );
    }

    const [{ default: Cart }, { default: Wishlist }, { default: PushToken }, { default: NotificationPreference }, { default: Notification }] =
      await Promise.all([
        import("../../models/cart.js"),
        import("../../models/wishlist.js"),
        import("../../modules/notifications/token.model.js"),
        import("../../modules/notifications/preference.model.js"),
        import("../../models/notification.js"),
      ]);

    await Promise.allSettled([
      Cart.deleteMany({ customerId: id }),
      Wishlist.deleteMany({ customerId: id }),
      PushToken.deleteMany({ userId: id }),
      NotificationPreference.deleteMany({ userId: id }),
      Notification.deleteMany({ $or: [{ userId: id }, { recipient: id }] }),
    ]);

    await Customer.deleteOne({ _id: id, role: "user" });
    markCustomerAccessChanged(id);

    return handleResponse(res, 200, "Customer profile deleted permanently", { id });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
