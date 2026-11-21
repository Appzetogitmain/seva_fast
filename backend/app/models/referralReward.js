import mongoose from "mongoose";

/**
 * One row per referred customer — the unique index on `referredCustomer` is
 * the idempotency lock that guarantees a referrer is paid at most once per
 * friend, no matter how many times the scheduler re-scans the same order.
 *
 * This is the "refer & earn" cashback, and it runs alongside (never instead
 * of) the existing multi-level commission in finance/commissionService.js.
 */
const referralRewardSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referredCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    orderId: { type: String, default: "" },
    orderAmount: { type: Number, default: 0 },

    rewardType: { type: String, enum: ["fixed", "percent"], required: true },
    rewardValue: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },

    status: {
      type: String,
      // processing: lock taken, credit in progress
      // credited:   money is in the referrer's wallet
      // flagged:    fraud signals found — waiting for admin approve/reject
      // rejected:   admin rejected a flagged reward
      // ineligible: did not meet the rules (min order value, monthly cap, ...)
      // failed:     credit threw — admin can retry via approve
      enum: ["processing", "credited", "flagged", "rejected", "ineligible", "failed"],
      default: "processing",
      index: true,
    },
    reason: { type: String, default: "" },
    fraudSignals: [{ type: String }],

    transactionReference: { type: String, default: "" },
    creditedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
  },
  { timestamps: true },
);

referralRewardSchema.index({ referredCustomer: 1 }, { unique: true });
referralRewardSchema.index({ referrer: 1, status: 1, creditedAt: -1 });
referralRewardSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("ReferralReward", referralRewardSchema);
