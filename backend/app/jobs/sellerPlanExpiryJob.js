import Seller from "../models/seller.js";
import logger from "../services/logger.js";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export const getSellerPlanExpiryJobInterval = () => {
  return parseInt(process.env.SELLER_PLAN_EXPIRY_JOB_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`, 10);
};

/**
 * Order-time commission math already re-checks subscription.expiresAt on
 * every order (pricingService.generateOrderPaymentBreakdown compares it
 * against `new Date()` live), so an expired 0%-commission plan never
 * actually lets a seller skip commission. This job only keeps the persisted
 * seller record in sync with that reality — otherwise commissionModel stays
 * "PLAN_BASED" and subscription.status stays "active" forever unless the
 * seller happens to open a screen that lazily flips it (getSellerSubscriptionStatus)
 * or manually calls switchToCategoryCommission.
 */
export const getSellerPlanExpiryJobHandler = () => {
  return async () => {
    const startTime = Date.now();
    try {
      const now = new Date();
      const result = await Seller.updateMany(
        {
          commissionModel: "PLAN_BASED",
          "subscription.expiresAt": { $lte: now },
          "subscription.status": { $ne: "expired" },
        },
        {
          $set: {
            commissionModel: "CATEGORY_WISE",
            "subscription.status": "expired",
          },
        },
      );

      const expiredCount = result.modifiedCount ?? result.nModified ?? 0;
      if (expiredCount > 0) {
        logger.info("Seller plan expiry job completed", {
          jobName: "sellerPlanExpiryJob",
          duration: Date.now() - startTime,
          expiredCount,
        });
      }
    } catch (error) {
      logger.error("Seller plan expiry job failed", {
        jobName: "sellerPlanExpiryJob",
        duration: Date.now() - startTime,
        error: error.message,
        stack: error.stack,
      });
    }
  };
};

export default getSellerPlanExpiryJobHandler;
