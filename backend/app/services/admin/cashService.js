import Delivery from "../../models/delivery.js";
import Transaction from "../../models/transaction.js";
import Notification from "../../models/notification.js";
import { formatTime } from "../../utils/formatDate.js";

export async function getDeliveryCashBalancesData({ page, limit, skip }) {
  const ridersPipeline = [
    {
      $lookup: {
        from: "transactions",
        localField: "_id",
        foreignField: "user",
        as: "allTransactions",
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "deliveryBoy",
        as: "allOrders",
      },
    },
    {
      $project: {
        name: 1,
        phone: 1,
        avatar: 1,
        limit: { $ifNull: ["$limit", 5000] },
        documents: 1,
        currentCash: {
          $reduce: {
            input: {
              $filter: {
                input: "$allTransactions",
                as: "transaction",
                cond: {
                  $in: [
                    "$$transaction.type",
                    ["Cash Collection", "Cash Settlement"],
                  ],
                },
              },
            },
            initialValue: 0,
            in: {
              $cond: [
                { $eq: ["$$this.type", "Cash Collection"] },
                { $add: ["$$value", "$$this.amount"] },
                {
                  $subtract: ["$$value", { $abs: "$$this.amount" }],
                },
              ],
            },
          },
        },
        pendingOrders: {
          $size: {
            $filter: {
              input: "$allOrders",
              as: "order",
              cond: {
                $and: [
                  {
                    $in: [
                      "$$order.status",
                      ["confirmed", "packed", "picked_up", "out_for_delivery"],
                    ],
                  },
                  { $in: ["$$order.payment.method", ["cash", "cod"]] },
                ],
              },
            },
          },
        },
        totalOrders: {
          $size: {
            $filter: {
              input: "$allOrders",
              as: "order",
              cond: { $eq: ["$$order.status", "delivered"] },
            },
          },
        },
        lastSettlementTxn: {
          $arrayElemAt: [
            {
              $sortArray: {
                input: {
                  $filter: {
                    input: "$allTransactions",
                    as: "transaction",
                    cond: {
                      $eq: ["$$transaction.type", "Cash Settlement"],
                    },
                  },
                },
                sortBy: { createdAt: -1 },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        id: "$_id",
        name: 1,
        phone: 1,
        avatar: {
          $cond: [
            { $ifNull: ["$documents.profileImage", false] },
            "$documents.profileImage",
            {
              $concat: [
                "https://api.dicebear.com/7.x/avataaars/svg?seed=",
                "$name",
              ],
            },
          ],
        },
        currentCash: 1,
        limit: 1,
        status: {
          $cond: [
            { $gt: ["$currentCash", 4500] },
            "critical",
            {
              $cond: [
                { $gt: ["$currentCash", 3000] },
                "warning",
                "safe",
              ],
            },
          ],
        },
        pendingOrders: 1,
        totalOrders: 1,
        lastSettlement: {
          $ifNull: ["$lastSettlementTxn.createdAt", "Never"],
        },
      },
    },
    {
      $facet: {
        meta: [{ $count: "total" }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const [aggregateResult] = await Delivery.aggregate(ridersPipeline);
  const meta = aggregateResult?.meta?.[0];
  const riders = aggregateResult?.items ?? [];
  const total = meta?.total ?? 0;

  const totalInHand = riders.reduce(
    (accumulator, rider) => accumulator + (rider.currentCash || 0),
    0,
  );
  const overLimitCount = riders.filter(
    (rider) => (rider.currentCash || 0) >= (rider.limit || 5000),
  ).length;

  return {
    items: riders,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalInHand,
      overLimitCount,
      avgBalance: riders.length ? totalInHand / riders.length : 0,
    },
  };
}

export async function settleRiderCashEntry({ riderId, amount, method }) {
  if (!riderId || !amount || amount <= 0) {
    throw new Error("Missing riderId or invalid amount");
  }

  const rider = await Delivery.findById(riderId);
  if (!rider) {
    return null;
  }

  const settlement = await Transaction.create({
    user: riderId,
    userModel: "Delivery",
    type: "Cash Settlement",
    amount: -Math.abs(amount),
    status: "Settled",
    reference: `CSH-SET-${Date.now()}`,
    notes: `Method: ${method || "Cash"}`,
  });

  await Notification.create({
    recipient: riderId,
    recipientModel: "Delivery",
    title: "Cash Settled",
    message: `Admin has collected \u20B9${amount} cash from you. Your balance is updated.`,
    type: "payment",
    data: { transactionId: settlement._id },
  });

  return settlement;
}

export async function getRiderCashDetailsData(riderId) {
  const transactions = await Transaction.find({
    user: riderId,
    userModel: "Delivery",
    type: "Cash Collection",
  })
    .populate("order", "orderId pricing createdAt")
    .sort({ createdAt: -1 })
    .limit(20);

  return transactions.map((transaction) => ({
    id: transaction.order?.orderId || transaction.reference || "N/A",
    amount: transaction.amount,
    time: formatTime(transaction.createdAt),
    date: transaction.createdAt,
  }));
}

/**
 * Riders' payable earnings balance — same "available balance" formula the
 * rider app itself uses for withdrawal requests (Settled, non-legacy-cash
 * transactions minus any withdrawal already pending). Under the new COD
 * flow this includes COD delivery earnings too, since riders no longer
 * keep any cash out of what they collect — admin pays this out at EOD.
 */
export async function getRiderPayableBalancesData({ page, limit, skip, search = "" }) {
  const matchStage = search
    ? { $or: [{ name: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }] }
    : {};

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "transactions",
        localField: "_id",
        foreignField: "user",
        as: "txns",
      },
    },
    {
      $addFields: {
        settledBalance: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$txns",
                  as: "t",
                  cond: {
                    $and: [
                      { $eq: ["$$t.status", "Settled"] },
                      { $ne: ["$$t.meta.settledViaCash", true] },
                    ],
                  },
                },
              },
              as: "t",
              in: "$$t.amount",
            },
          },
        },
        pendingWithdrawals: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$txns",
                  as: "t",
                  cond: {
                    $and: [
                      { $in: ["$$t.status", ["Pending", "Processing"]] },
                      { $eq: ["$$t.type", "Withdrawal"] },
                    ],
                  },
                },
              },
              as: "t",
              in: { $abs: "$$t.amount" },
            },
          },
        },
      },
    },
    {
      $addFields: {
        availableBalance: {
          $max: [{ $subtract: ["$settledBalance", "$pendingWithdrawals"] }, 0],
        },
      },
    },
    { $match: { availableBalance: { $gt: 0 } } },
    {
      $project: {
        name: 1,
        phone: 1,
        avatar: "$documents.profileImage",
        availableBalance: 1,
        pendingWithdrawals: 1,
      },
    },
    { $sort: { availableBalance: -1 } },
    {
      $facet: {
        meta: [{ $count: "total" }],
        totals: [{ $group: { _id: null, totalPayable: { $sum: "$availableBalance" } } }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const [aggregateResult] = await Delivery.aggregate(pipeline);
  const meta = aggregateResult?.meta?.[0];
  const totals = aggregateResult?.totals?.[0];
  const riders = (aggregateResult?.items ?? []).map((rider) => ({
    id: rider._id,
    name: rider.name,
    phone: rider.phone,
    avatar: rider.avatar || "",
    availableBalance: rider.availableBalance || 0,
    pendingWithdrawals: rider.pendingWithdrawals || 0,
  }));
  const total = meta?.total ?? 0;

  return {
    items: riders,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalPayable: totals?.totalPayable ?? 0,
      riderCount: total,
    },
  };
}

/**
 * Admin pays a rider's payable earning balance at end of day, fronting it
 * from admin's own funds — independent of when/whether the seller has
 * remitted the underlying COD cash back to admin. Recorded the same way a
 * rider-requested withdrawal would be once approved, so it folds into the
 * rider's existing balance/history calculations without any parallel
 * bookkeeping.
 */
export async function payRiderEod({ riderId, amount, method, note, actorId }) {
  if (!riderId || !amount || amount <= 0) {
    throw new Error("Missing riderId or invalid amount");
  }

  const rider = await Delivery.findById(riderId);
  if (!rider) {
    return null;
  }

  const transactions = await Transaction.find({ user: riderId, userModel: "Delivery" }).lean();
  const settledBalance = transactions
    .filter((t) => t.status === "Settled" && !t.meta?.settledViaCash)
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const pendingWithdrawals = transactions
    .filter((t) => (t.status === "Pending" || t.status === "Processing") && t.type === "Withdrawal")
    .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);
  const availableBalance = Math.max(settledBalance - pendingWithdrawals, 0);

  const requested = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
  if (requested > availableBalance) {
    throw new Error(`Amount exceeds rider's payable balance (₹${availableBalance})`);
  }

  const payout = await Transaction.create({
    user: riderId,
    userModel: "Delivery",
    type: "Withdrawal",
    amount: -Math.abs(requested),
    status: "Settled",
    reference: `EOD-${riderId}-${Date.now()}`,
    notes: method ? `Method: ${method}` : "EOD payout by admin",
    meta: {
      source: "admin_eod_rider_payout",
      method: method || "Cash",
      note: note || "",
      paidBy: actorId || null,
    },
  });

  await Notification.create({
    recipient: riderId,
    recipientModel: "Delivery",
    title: "Earnings Paid",
    message: `Admin has paid your delivery earnings of ₹${requested}.`,
    type: "payment",
    data: { transactionId: payout._id },
  });

  return {
    payout,
    remainingBalance: Math.max(availableBalance - requested, 0),
  };
}

export async function getCashSettlementHistoryData({ page, limit, skip }) {
  const query = { userModel: "Delivery", type: "Cash Settlement" };

  const [history, total] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  const items = history.map((entry) => ({
    id: (entry.reference || entry._id).toString(),
    rider: entry.user?.name || "Unknown Rider",
    amount: Math.abs(entry.amount),
    date: entry.createdAt,
    method: entry.notes?.replace("Method: ", "") || "Cash Submission",
    status: "completed",
  }));

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
