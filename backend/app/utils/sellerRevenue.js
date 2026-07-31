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
