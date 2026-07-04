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
  };
}

export function sellerOrderRevenueAmount() {
  return {
    $ifNull: ["$pricing.total", 0],
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
