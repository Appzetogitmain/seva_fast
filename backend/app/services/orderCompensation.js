import Transaction from "../models/transaction.js";
import Order from "../models/order.js";
import CheckoutGroup from "../models/checkoutGroup.js";
import { releaseReservedStockForOrder } from "./stockService.js";
import { reverseOrderFinanceOnCancellation } from "./finance/orderFinanceService.js";

/**
 * Reverse stock and fail seller transaction when an order is cancelled
 * after stock was deducted at placement. Also reverses order finance / initiates Razorpay refund.
 */
export async function compensateOrderCancellation(order, orderIdString) {
  const existing = await Order.findById(order._id);
  if (existing) {
    await releaseReservedStockForOrder(existing, {
      reason: "Cancelled",
    });
    await existing.save();

    // Trigger finance reversal & Razorpay online refund if order has financial breakdown
    if (existing.paymentBreakdown?.grandTotal != null || existing.financeFlags?.onlinePaymentCaptured) {
      try {
        await reverseOrderFinanceOnCancellation(existing._id, {
          actorId: existing.customer,
          reason: existing.cancelReason || "Cancelled before acceptance",
        });
      } catch (financeErr) {
        console.warn(
          `[compensateOrderCancellation] Finance reversal failed for order ${existing.orderId}:`,
          financeErr.message,
        );
      }
    }
  }

  await Transaction.findOneAndUpdate(
    { reference: orderIdString },
    { status: "Failed" },
  );

  if (existing?.checkoutGroupId) {
    const activeCount = await Order.countDocuments({
      checkoutGroupId: existing.checkoutGroupId,
      status: { $ne: "cancelled" },
      workflowStatus: { $ne: "CANCELLED" },
    });
    if (activeCount === 0) {
      await CheckoutGroup.updateOne(
        { checkoutGroupId: existing.checkoutGroupId },
        {
          $set: {
            status: "CANCELLED",
            paymentStatus: "FAILED",
            "stockReservation.status": "RELEASED",
            "stockReservation.releasedAt": new Date(),
          },
        },
      );
    }
  }
}
