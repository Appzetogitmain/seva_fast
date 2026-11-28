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
  // Revenue = productSubtotal (seller's actual product value before any
  // customer-facing discounts like coupons, wallet, or membership).
  // Discounts are subsidised by admin, not seller — so the seller's gross
  // revenue must reflect the full product value, not the discounted
  // grandTotal the customer paid.
  return {
    $ifNull: [
      "$paymentBreakdown.productSubtotal",
      {
        $ifNull: [
          "$pricing.subtotal",
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
      {
        $max: [
          {
            $subtract: [
              sellerOrderRevenueAmount(),
              sellerOrderCommissionAmount(),
            ],
          },
          0,
        ],
      },
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

// Seller's share of the delivery fee. Persisted explicitly on newer orders
// (Pan-India orders: the full delivery fee goes to the seller). Older orders
// fall back to deriving it from the payout the same way it was built:
// sellerPayoutTotal = max(sellingPrice - commission, 0) + deliveryEarning.
export function sellerOrderDeliveryEarningAmount() {
  return {
    $ifNull: [
      "$paymentBreakdown.sellerDeliveryFeeShare",
      {
        $subtract: [
          sellerOrderEarningAmount(),
          { $max: [{ $subtract: [sellerOrderSellingPriceAmount(), sellerOrderCommissionAmount()] }, 0] },
        ],
      },
    ],
  };
}

// Shiprocket freight the seller bears on Pan-India orders (deducted from payout).
export function sellerOrderShippingChargeAmount() {
  // All seller-borne Shiprocket charges (forward, RTO, return pickup and
  // final-bill adjustments); falls back to the forward-only field.
  return {
    $ifNull: [
      "$paymentBreakdown.sellerShippingChargesTotal",
      { $ifNull: ["$paymentBreakdown.shiprocketShippingCharge", 0] },
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

