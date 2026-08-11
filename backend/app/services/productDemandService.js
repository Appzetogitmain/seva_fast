import ProductDemand from "../models/productDemand.js";
import Product from "../models/product.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import logger from "./logger.js";

/**
 * Notifies every customer with a pending "notify me" demand for this
 * product/variant that it's back in stock, then marks those demands as
 * notified so the same restock doesn't re-notify them.
 *
 * Fire-and-forget: callers should not await failures from this into their
 * own response — a notification failure must never block a stock update.
 */
export async function notifyPendingDemandsForRestock(productId, { variantSku = null } = {}) {
  try {
    const pendingDemands = await ProductDemand.find({
      product: productId,
      variantSku: variantSku || null,
      status: "pending",
    }).select("_id customer");

    if (!pendingDemands.length) {
      return { notified: 0 };
    }

    const product = await Product.findById(productId).select("name").lean();
    const productName = product?.name || "Item";

    await ProductDemand.updateMany(
      { _id: { $in: pendingDemands.map((d) => d._id) } },
      { $set: { status: "notified", notifiedAt: new Date() } },
    );

    for (const demand of pendingDemands) {
      emitNotificationEvent(NOTIFICATION_EVENTS.PRODUCT_BACK_IN_STOCK, {
        customerId: String(demand.customer),
        productId: String(productId),
        productName,
        variantSku: variantSku || "",
      });
    }

    return { notified: pendingDemands.length };
  } catch (error) {
    logger.error("Failed to notify pending product demands on restock", {
      productId: String(productId),
      variantSku: variantSku || "",
      message: error.message,
    });
    return { notified: 0 };
  }
}

export default { notifyPendingDemandsForRestock };
