import mongoose from "mongoose";

/**
 * One customer reward from the Site Cashback or Direct Customer Buy Slab
 * program. This collection IS the customer-wise reward history.
 *
 * Lifecycle:  pending → approved → credited
 *                  ↘          ↘          ↘
 *                   reversed   reversed   reversed (wallet debited back)
 *
 * Uniqueness (prevents double rewards):
 *   - site_cashback: one per order
 *   - direct_slab:   one per customer per month
 */
export const REWARD_PROGRAMS = ["site_cashback", "direct_slab"];
export const REWARD_STATUSES = ["pending", "approved", "credited", "reversed"];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: REWARD_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, default: "system" }, // "system" or admin id
    note: { type: String, default: "" },
  },
  { _id: false },
);

const customerRewardSchema = new mongoose.Schema(
  {
    program: { type: String, enum: REWARD_PROGRAMS, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: REWARD_STATUSES, default: "pending", index: true },
    amount: { type: Number, required: true, min: 0 },

    // site_cashback
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    orderId: { type: String, default: "" },

    // direct_slab
    period: { type: String, default: "" }, // "YYYY-MM" (IST)
    monthlySpend: { type: Number, default: 0 },
    monthlyOrders: { type: Number, default: 0 },
    slab: {
      minMonthlySpend: { type: Number, default: 0 },
      minOrders: { type: Number, default: 0 },
      reward: { type: Number, default: 0 },
    },
    scaleFactor: { type: Number, default: 1 }, // < 1 when the month's pool was short

    // budget transparency
    adminCommission: { type: Number, default: 0 },
    budgetPercent: { type: Number, default: 0 },
    budgetAmount: { type: Number, default: 0 },

    reason: { type: String, default: "" },
    eligibleAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    creditedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    transactionReference: { type: String, default: "" },
    reversalReference: { type: String, default: "" },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

customerRewardSchema.index(
  { program: 1, order: 1 },
  { unique: true, partialFilterExpression: { program: "site_cashback" } },
);
customerRewardSchema.index(
  { program: 1, customer: 1, period: 1 },
  { unique: true, partialFilterExpression: { program: "direct_slab" } },
);
customerRewardSchema.index({ program: 1, status: 1, createdAt: -1 });

export default mongoose.models.CustomerReward || mongoose.model("CustomerReward", customerRewardSchema);
