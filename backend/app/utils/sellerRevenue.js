import mongoose from "mongoose";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";

export function sellerDeliveredOrderMatch(sellerId) {
  const sellerOid =
    sellerId instanceof mongoose.Types.ObjectId
      ? sellerId
      : new mongoose.Types.ObjectId(String(sellerId));

  return {
    seller: sellerOid,
    $or: [{ status: "delivered" }, { workflowStatus: WORKFLOW_STATUS.DELIVERED }],
    returnStatus: { $nin: ["returned", "qc_passed", "refund_completed"] },
  };
}

export function sellerOrderRevenueAmount() {
  return {
    $ifNull: [
      "$pricing.total",
      {
        $ifNull: [
          "$paymentBreakdown.grandTotal",
          {
            $sum: {
              $map: {
                input: { $ifNull: ["$items", []] },
                as: "item",
                in: {
                  $multiply: [
                    { $ifNull: ["$$item.price", 0] },
                    { $ifNull: ["$$item.quantity", 0] },
                  ],
                },
              },
            },
          },
        ],
      },
    ],
  };
}

export function sellerOrderEarningAmount() {
  return {
    $ifNull: [
      "$paymentBreakdown.sellerPayoutTotal",
      { $ifNull: ["$pricing.total", 0] },
    ],
  };
}

export function sellerOrderCostAmount() {
  return {
    $ifNull: [
      "$paymentBreakdown.totalCostPrice",
      {
        $sum: {
          $map: {
            input: { $ifNull: ["$items", []] },
            as: "item",
            in: {
              $multiply: [
                { $ifNull: ["$$item.costPrice", 0] },
                { $ifNull: ["$$item.quantity", 0] },
              ],
            },
          },
        },
      },
    ],
  };
}

export function sellerOrderProfitAmount() {
  return {
    $ifNull: [
      "$paymentBreakdown.sellerNetProfit",
      {
        $subtract: [
          sellerOrderEarningAmount(),
          sellerOrderCostAmount(),
        ],
      },
    ],
  };
}

// Sum of item price*qty — what the seller sold the order for, before any deduction.
export function sellerOrderSellingPriceAmount() {
  return {
    $ifNull: [
      "$paymentBreakdown.productSubtotal",
      {
        $sum: {
          $map: {
            input: { $ifNull: ["$items", []] },
            as: "item",
            in: {
              $multiply: [
                { $ifNull: ["$$item.price", 0] },
                { $ifNull: ["$$item.quantity", 0] },
              ],
            },
          },
        },
      },
    ],
  };
}

export function sellerOrderCommissionAmount() {
  return { $ifNull: ["$paymentBreakdown.adminProductCommissionTotal", 0] };
}

// Seller's share of the delivery fee (see DELIVERY_FEE_SELLER_SHARE in pricingService.js) —
// not persisted as its own field, so it's derived the same way sellerPayoutTotal was built:
// sellerPayoutTotal = max(sellingPrice - commission, 0) + deliveryEarning.
export function sellerOrderDeliveryEarningAmount() {
  return {
    $subtract: [
      sellerOrderEarningAmount(),
      { $max: [{ $subtract: [sellerOrderSellingPriceAmount(), sellerOrderCommissionAmount()] }, 0] },
    ],
  };
}

// True only when the order was priced with the seller's commission fully waived
// (active paid plan / one-time charge) — checked via the first line item's
// appliedCommissionType snapshot, since exemption applies uniformly to the whole order.
export function sellerOrderCommissionExemptFlag() {
  return {
    $eq: [
      {
        $ifNull: [
          { $arrayElemAt: ["$paymentBreakdown.lineItems.appliedCommissionType", 0] },
          "",
        ],
      },
      "one_time_exempt",
    ],
  };
}

