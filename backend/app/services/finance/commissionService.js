import User from "../../models/customer.js";
import Seller from "../../models/seller.js";
import Plan from "../../models/plan.js";
import Transaction from "../../models/transaction.js";
import Order from "../../models/order.js";
import { roundCurrency } from "../../utils/money.js";

const DEFAULT_LEVEL_COMMISSIONS = [10, 5, 2, 1, 0.5];
const ADMIN_LEVEL_COMMISSIONS = [10, 5, 2, 1, 0.5];
const MAX_REFERRAL_DEPTH = 15;

function resolvePurchasedPlanMaxLevels(plan) {
  const levelsFeature = plan?.features?.find((feature) => feature.key === "REFERRAL_LEVELS");
  const configuredLevels = Number(levelsFeature?.value || 0);
  if (configuredLevels > 0) {
    return configuredLevels;
  }
  return DEFAULT_LEVEL_COMMISSIONS.length;
}

function resolvePurchasedPlanLevelCommissionPercent(plan, level) {
  if (!plan || level < 1) return 0;

  const maxLevels = resolvePurchasedPlanMaxLevels(plan);
  if (level > maxLevels) {
    return 0;
  }

  const levelFeature = plan.features?.find((feature) => feature.key === "LEVEL_COMMISSION");
  if (levelFeature && Array.isArray(levelFeature.value)) {
    return Number(levelFeature.value[level - 1] || 0);
  }

  if (level <= DEFAULT_LEVEL_COMMISSIONS.length) {
    return Number(DEFAULT_LEVEL_COMMISSIONS[level - 1] || 0);
  }

  return 0;
}

function resolveReferrerCommissionPercent(referrer, level) {
  if (!referrer || level < 1) return 0;

  const isAdmin =
    referrer.role === "admin" && String(referrer.referralCode || "").toUpperCase() === "SEVAFAST";
  const hasActivePlan =
    referrer.currentPlan && referrer.planExpiry && new Date(referrer.planExpiry) > new Date();

  if (isAdmin) {
    return Number(ADMIN_LEVEL_COMMISSIONS[level - 1] || 0);
  }

  if (hasActivePlan) {
    return 0;
  }

  if (level <= DEFAULT_LEVEL_COMMISSIONS.length) {
    return Number(DEFAULT_LEVEL_COMMISSIONS[level - 1] || 0);
  }

  return 0;
}

async function resolveReferrerCommissionPercentFromPlan(referrer, level) {
  if (!referrer || level < 1) return 0;

  const isAdmin =
    referrer.role === "admin" && String(referrer.referralCode || "").toUpperCase() === "SEVAFAST";
  if (isAdmin) {
    return Number(ADMIN_LEVEL_COMMISSIONS[level - 1] || 0);
  }

  const hasActivePlan =
    referrer.currentPlan && referrer.planExpiry && new Date(referrer.planExpiry) > new Date();
  if (!hasActivePlan) {
    return resolveReferrerCommissionPercent(referrer, level);
  }

  const plan = await Plan.findById(referrer.currentPlan).lean();
  if (!plan) return 0;

  const levelsFeature = plan.features?.find((feature) => feature.key === "REFERRAL_LEVELS");
  const configuredLevels = Number(levelsFeature?.value || 0);
  if (configuredLevels > 0 && level > configuredLevels) {
    return 0;
  }

  const levelFeature = plan.features?.find((feature) => feature.key === "LEVEL_COMMISSION");
  if (levelFeature && Array.isArray(levelFeature.value)) {
    const percent = Number(levelFeature.value[level - 1] || 0);
    if (percent > 0) {
      return percent;
    }
  }

  if (level <= DEFAULT_LEVEL_COMMISSIONS.length) {
    return Number(DEFAULT_LEVEL_COMMISSIONS[level - 1] || 0);
  }

  return 0;
}

export async function processPlanPurchaseLevelCommissions({
  buyerId,
  planPrice,
  planId,
  planName = "",
  paymentReference,
  directReferrerId = null,
}) {
  const normalizedPrice = roundCurrency(planPrice);
  if (!buyerId || !normalizedPrice || normalizedPrice <= 0) {
    return { credited: 0 };
  }

  const buyer = await User.findById(buyerId).lean();
  if (!buyer) {
    return { credited: 0 };
  }

  const purchasedPlan = await Plan.findById(planId).lean();
  if (!purchasedPlan) {
    return { credited: 0 };
  }

  const maxLevels = Math.min(
    resolvePurchasedPlanMaxLevels(purchasedPlan),
    MAX_REFERRAL_DEPTH,
  );

  const buyerName = buyer.name || "User";
  const baseReference = String(paymentReference || `plan-${planId}-${buyerId}`);
  const visited = new Set([String(buyerId)]);
  let currentLevel = 0;
  let credited = 0;
  let nextReferrerId = directReferrerId || buyer.referredBy || null;

  while (nextReferrerId && currentLevel < maxLevels) {
    const referrerId = String(nextReferrerId);
    if (visited.has(referrerId)) break;
    visited.add(referrerId);
    currentLevel += 1;

    const referrer = await User.findById(referrerId);
    if (!referrer) break;

    const commissionPercent = resolvePurchasedPlanLevelCommissionPercent(
      purchasedPlan,
      currentLevel,
    );

    if (commissionPercent > 0) {
      const commissionAmount = roundCurrency((normalizedPrice * commissionPercent) / 100);
      const txReference = `PLAN-LVL-COMM-${baseReference}-${currentLevel}-${referrerId}`;
      const existingTransaction = await Transaction.findOne({ reference: txReference }).lean();

      if (!existingTransaction && commissionAmount > 0) {
        referrer.walletBalance = roundCurrency(
          Number(referrer.walletBalance || 0) + commissionAmount,
        );
        await referrer.save();

        await Transaction.create({
          user: referrer._id,
          userModel: "User",
          type: "Commission",
          amount: commissionAmount,
          status: "Settled",
          reference: txReference,
          meta: {
            planId,
            planName,
            planPrice: normalizedPrice,
            level: currentLevel,
            commissionPercent,
            referredUser: buyerId,
            description: `Plan referral commission (${commissionPercent}%) from ${buyerName}`,
          },
        });
        credited += 1;
      }
    }

    nextReferrerId = referrer.referredBy || null;
  }

  const targetReferrerId = directReferrerId || buyer.referredBy;
  if (targetReferrerId) {
    await checkAndRewardMonthlyReferralTarget(targetReferrerId);
  }

  return { credited };
}

export const processMonthlyTurnoverCommissions = async () => {
    try {
        const now = new Date();
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        
        const sellers = await Seller.find({ onboardedBy: { $ne: null } }).lean();
        if (sellers.length === 0) return { success: true, processed: 0, message: "No referred sellers found" };
        
        let processedCount = 0;
        
        for (const seller of sellers) {
            const user = await User.findById(seller.onboardedBy);
            const isAdmin = user && user.role === 'admin' && user.referralCode === 'SEVAFAST';
            const hasActivePlan = user && user.currentPlan && user.planExpiry >= now;
            
            if (!user || (!isAdmin && !hasActivePlan)) continue;
            
            let commissionPercent = 0;
            
            if (isAdmin) {
                commissionPercent = 5; // Default Admin Turnover Commission e.g. 5%
            } else {
                const plan = await Plan.findById(user.currentPlan);
                if (!plan) continue;
                
                const commissionFeature = plan.features.find(f => f.key === "TURNOVER_COMMISSION");
                commissionPercent = commissionFeature ? Number(commissionFeature.value) : 0;
            }
            
            if (commissionPercent <= 0) continue;
            
            // Check if already processed for this seller for this month to prevent duplicates
            const referenceId = `TURNOVER-COMM-${seller._id}-${startOfPrevMonth.getMonth() + 1}-${startOfPrevMonth.getFullYear()}`;
            const existingTransaction = await Transaction.findOne({ reference: referenceId });
            if (existingTransaction) continue;
            
            const orders = await Order.find({
                seller: seller._id,
                status: "Delivered",
                createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth }
            }).lean();
            
            const totalTurnover = orders.reduce((sum, order) => {
                return sum + (order.totalAmount || 0);
            }, 0);
            
            if (totalTurnover <= 0) continue;
            
            const commissionAmount = (totalTurnover * commissionPercent) / 100;
            
            user.walletBalance = (user.walletBalance || 0) + commissionAmount;
            await user.save();
            
            await Transaction.create({
                user: user._id,
                userModel: "User",
                type: "Incentive",
                amount: commissionAmount,
                status: "Settled",
                reference: referenceId,
                meta: {
                    sellerId: seller._id,
                    turnoverAmount: totalTurnover,
                    commissionPercent: commissionPercent,
                    description: `Monthly Turnover Commission (${commissionPercent}%) from ${seller.shopName}`,
                    month: startOfPrevMonth.getMonth() + 1,
                    year: startOfPrevMonth.getFullYear()
                }
            });
            
            processedCount++;
        }
        
        return { success: true, processed: processedCount, message: `Successfully processed ${processedCount} turnover commissions.` };
    } catch (error) {
        console.error("Error processing turnover commissions:", error);
        return { success: false, error: error.message };
    }
};

export const processOrderLevelCommissions = async (order) => {
    if (!order || !order.customer || !order.pricing?.total) return;

    // RULE: Only process commission for the customer's FIRST delivered order.
    try {
        const previousDeliveredOrdersCount = await Order.countDocuments({
            customer: order.customer,
            workflowStatus: 'delivered',
            _id: { $ne: order._id }
        });
        if (previousDeliveredOrdersCount > 0) {
            console.log(`[CommissionService] Skipping level commission: Order ${order._id} is not the first order for customer ${order.customer}`);
            return;
        }
    } catch (err) {
        console.error("Error checking previous orders for commission:", err);
        return;
    }
    
    let currentUserId = order.customer;
    let orderAmount = order.pricing.total;
    let orderIdString = order._id.toString();
    
    let orderCustomerName = 'Unknown User';
    try {
        const orderCustomer = await User.findById(currentUserId).lean();
        if (orderCustomer && orderCustomer.name) {
            orderCustomerName = orderCustomer.name;
        }
    } catch (e) {}

    let visited = new Set();
    let currentLevel = 0; 
    
    try {
        while (currentUserId && currentLevel < 15) {
            if (visited.has(currentUserId.toString())) break;
            visited.add(currentUserId.toString());
            
            const currentUser = await User.findById(currentUserId).lean();
            if (!currentUser || !currentUser.referredBy) break;
            
            let referrerId = currentUser.referredBy;
            currentLevel++;
            
            const referrer = await User.findById(referrerId);
            
            const isAdmin = referrer && referrer.role === 'admin' && referrer.referralCode === 'SEVAFAST';
            const hasActivePlan = referrer && referrer.currentPlan && referrer.planExpiry > new Date();
            
            let commissionPercent = 0;
            
            if (isAdmin) {
                const adminLevelCommissions = [10, 5, 2, 1, 0.5]; // Default Admin Commission Structure
                commissionPercent = adminLevelCommissions[currentLevel - 1] || 0;
            } else if (hasActivePlan) {
                const plan = await Plan.findById(referrer.currentPlan).lean();
                if (plan) {
                    const levelFeature = plan.features.find(f => f.key === "LEVEL_COMMISSION");
                    if (levelFeature && Array.isArray(levelFeature.value)) {
                        commissionPercent = levelFeature.value[currentLevel - 1] || 0;
                    }
                }
            }
            
            // Fallback for non-admin referrers without an active plan, or if plan has no commission set
            if (!isAdmin && (!hasActivePlan || commissionPercent === 0) && currentLevel <= 5) {
                const defaultCommissions = [10, 5, 2, 1, 0.5]; // Default up to 5 levels
                commissionPercent = defaultCommissions[currentLevel - 1] || 0;
            }
            
            if (commissionPercent && typeof commissionPercent === 'number' && commissionPercent > 0) {
                    let commissionAmount = (orderAmount * commissionPercent) / 100;
                    
                    referrer.walletBalance = (referrer.walletBalance || 0) + commissionAmount;
                    await referrer.save();
                    
                    await Transaction.create({
                        user: referrer._id,
                        userModel: "User",
                        type: "Commission",
                        amount: commissionAmount,
                        status: "Settled",
                        reference: `LVL-COMM-${orderIdString}-${currentLevel}`,
                        meta: {
                            orderId: order._id,
                            level: currentLevel,
                            commissionPercent: commissionPercent,
                            orderAmount: orderAmount,
                            description: `Referral Commission (${commissionPercent}%) from ${orderCustomerName}`
                        }
                    });
                }
            
            currentUserId = referrerId;
        }
    } catch (err) {
        console.error("Error processing level commissions:", err);
    }
};

export const checkAndRewardMonthlyReferralTarget = async (referrerId) => {
    try {
        if (!referrerId) return;
        const referrer = await User.findById(referrerId).populate("currentPlan");
        if (!referrer || !referrer.currentPlan) return;

        const features = referrer.currentPlan.features || [];
        const targetFeature = features.find(f => f.key === "MONTHLY_REFERRAL_TARGET");
        const rewardFeature = features.find(f => f.key === "MONTHLY_TARGET_REWARD");

        if (!targetFeature || !rewardFeature) return;

        const targetCount = Number(targetFeature.value) || 0;
        const rewardAmount = Number(rewardFeature.value) || 0;

        if (targetCount <= 0 || rewardAmount <= 0) return;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Count verified referrals for the current month
        const count = await User.countDocuments({
            referredBy: referrerId,
            isVerified: true,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (count >= targetCount) {
            const reference = `MONTHLY-REF-TARGET-${referrerId}-${now.getMonth() + 1}-${now.getFullYear()}`;
            const existingTx = await Transaction.findOne({ reference });
            if (!existingTx) {
                referrer.walletBalance = (referrer.walletBalance || 0) + rewardAmount;
                await referrer.save();

                await Transaction.create({
                    user: referrer._id,
                    userModel: "User",
                    type: "Incentive",
                    amount: rewardAmount,
                    status: "Settled",
                    reference,
                    meta: {
                        description: `Monthly Referral Target achieved (${targetCount} referrals for ${now.toLocaleString('default', { month: 'long' })})`,
                        month: now.getMonth() + 1,
                        year: now.getFullYear()
                    }
                });
                console.log(`[CommissionService] Credited monthly referral target reward of ₹${rewardAmount} to user ${referrerId}`);
            }
        }
    } catch (error) {
        console.error("Error rewarding monthly referral target:", error);
    }
};
