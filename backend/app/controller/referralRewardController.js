import mongoose from "mongoose";
import ReferralReward from "../models/referralReward.js";
import handleResponse from "../utils/helper.js";
import {
  creditReferralReward,
  getReferralCashbackConfig,
} from "../services/referralCashbackService.js";

const STATUSES = ["processing", "credited", "flagged", "rejected", "ineligible", "failed"];

function toPage(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/* GET /api/admin/referral-rewards?status=flagged&page=1&limit=20 */
export const adminListReferralRewards = async (req, res) => {
  try {
    const { page, limit, skip } = toPage(req.query);
    const filter = {};
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const [items, total, statusCounts, creditedTotal] = await Promise.all([
      ReferralReward.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("referrer", "name phone referralCode")
        .populate("referredCustomer", "name phone")
        .lean(),
      ReferralReward.countDocuments(filter),
      ReferralReward.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      ReferralReward.aggregate([
        { $match: { status: "credited" } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
    ]);

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    statusCounts.forEach((row) => {
      counts[row._id] = row.count;
    });

    return handleResponse(res, 200, "Referral rewards fetched", {
      items,
      page,
      limit,
      total,
      counts,
      totalCreditedAmount: creditedTotal[0]?.amount || 0,
      config: await getReferralCashbackConfig(),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* PATCH /api/admin/referral-rewards/:id/approve — pay a flagged or failed reward */
export const adminApproveReferralReward = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return handleResponse(res, 400, "Invalid reward id");

    const reward = await creditReferralReward(id, {
      reviewedBy: req.user?.id || null,
      reviewNote: String(req.body?.note || "").slice(0, 500),
    });
    return handleResponse(res, 200, "Cashback credited to referrer's wallet", reward);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/* PATCH /api/admin/referral-rewards/:id/reject — refuse a flagged reward */
export const adminRejectReferralReward = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return handleResponse(res, 400, "Invalid reward id");

    const reward = await ReferralReward.findOneAndUpdate(
      { _id: id, status: { $in: ["flagged", "failed"] } },
      {
        $set: {
          status: "rejected",
          reviewedBy: req.user?.id || null,
          reviewedAt: new Date(),
          reviewNote: String(req.body?.note || "").slice(0, 500),
        },
      },
      { new: true },
    );
    if (!reward) return handleResponse(res, 409, "Only flagged or failed rewards can be rejected");
    return handleResponse(res, 200, "Referral reward rejected", reward);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* GET /api/customer/referrals/rewards — the logged-in customer's cashback history */
export const getMyReferralRewards = async (req, res) => {
  try {
    const items = await ReferralReward.find({ referrer: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("referredCustomer", "name")
      .select("referredCustomer orderAmount amount status creditedAt createdAt")
      .lean();

    // Customers only see "pending" for anything not yet decided — fraud
    // signals and internal reasons stay admin-only.
    const publicStatus = (status) =>
      status === "credited" ? "credited" : status === "processing" || status === "flagged" || status === "failed" ? "pending" : "not_eligible";

    const totalEarned = items
      .filter((r) => r.status === "credited")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    return handleResponse(res, 200, "Referral rewards fetched", {
      totalEarned,
      items: items.map((r) => ({
        _id: r._id,
        friendName: r.referredCustomer?.name || "Friend",
        amount: r.status === "credited" || publicStatus(r.status) === "pending" ? r.amount : 0,
        status: publicStatus(r.status),
        creditedAt: r.creditedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
