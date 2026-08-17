import mongoose from "mongoose";
import User from "../../models/customer.js";
import Order from "../../models/order.js";
import { emitNotificationEvent } from "../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";

export async function getUsersData({ page, limit, skip }) {
  const pipeline = [
    { $match: { role: { $in: ["user", "customer"] } } },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "customer",
        as: "userOrders",
      },
    },
    {
      $lookup: {
        from: "plans",
        localField: "currentPlan",
        foreignField: "_id",
        as: "planDetails",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "referredBy",
        foreignField: "_id",
        as: "referrerDetails",
      },
    },
    {
      $project: {
        id: { $toString: "$_id" },
        name: { $ifNull: ["$name", "Unnamed Customer"] },
        email: 1,
        phone: 1,
        joinedDate: "$createdAt",
        status: {
          $cond: [{ $eq: ["$isActive", false] }, "inactive", "active"],
        },
        totalOrders: { $size: "$userOrders" },
        monthlyOrders: {
          $size: {
            $filter: {
              input: "$userOrders",
              as: "order",
              cond: {
                $and: [
                  { $gte: ["$$order.createdAt", new Date(new Date().getFullYear(), new Date().getMonth(), 1)] },
                  { $not: { $in: ["$$order.status", ["cancelled", "declined"]] } }
                ]
              }
            }
          }
        },
        totalSpent: { $sum: "$userOrders.pricing.total" },
        lastOrderDate: { $max: "$userOrders.createdAt" },
        currentPlan: { $arrayElemAt: ["$planDetails", 0] },
        planExpiry: 1,
        referredBy: {
          $let: {
            vars: { referrer: { $arrayElemAt: ["$referrerDetails", 0] } },
            in: {
              $cond: {
                if: { $ne: ["$$referrer", null] },
                then: {
                  id: { $toString: "$$referrer._id" },
                  name: "$$referrer.name",
                  phone: "$$referrer.phone"
                },
                else: null
              }
            }
          }
        },
        avatar: {
          $concat: [
            "https://api.dicebear.com/7.x/avataaars/svg?seed=",
            { $ifNull: ["$name", "Customer"] },
          ],
        },
      },
    },
    { $sort: { totalOrders: -1 } },
  ];

  const [result] = await User.aggregate([
    ...pipeline,
    {
      $facet: {
        totalCount: [{ $count: "count" }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ]);

  const total = result?.totalCount?.[0]?.count ?? 0;
  const items = result?.items ?? [];

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getUserByIdData(id) {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
        role: { $in: ["user", "customer"] },
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "customer",
        as: "userOrders",
      },
    },
    {
      $project: {
        id: { $toString: "$_id" },
        name: { $ifNull: ["$name", "Unnamed Customer"] },
        email: 1,
        phone: 1,
        walletBalance: { $ifNull: ["$walletBalance", 0] },
        joinedDate: "$createdAt",
        status: {
          $cond: [{ $eq: ["$isActive", false] }, "inactive", "active"],
        },
        totalOrders: { $size: "$userOrders" },
        totalSpent: { $sum: "$userOrders.pricing.total" },
        lastOrderDate: { $max: "$userOrders.createdAt" },
        avatar: {
          $concat: [
            "https://api.dicebear.com/7.x/avataaars/svg?seed=",
            { $ifNull: ["$name", "Customer"] },
          ],
        },
        addresses: { $ifNull: ["$addresses", []] },
      },
    },
  ]);

  if (!user || user.length === 0) {
    return null;
  }

  const recentOrders = await Order.find({ customer: id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("items.product", "name mainImage");

  const selectedUser = user[0];
  const addresses = Array.isArray(selectedUser.addresses)
    ? selectedUser.addresses
    : [];

  return {
    ...selectedUser,
    addresses,
    recentOrders: recentOrders.map((order) => ({
      id: order.orderId,
      _id: order._id,
      itemsCount: order.items.length,
      amount: order.pricing.total,
      date: order.createdAt,
      status: order.status,
    })),
  };
}

export async function updateUserWalletData(id, amount, action, reason) {
  const user = await User.findById(id);
  if (!user) throw new Error("Customer not found");

  const amountNum = Number(amount);
  if (isNaN(amountNum) || amountNum <= 0) throw new Error("Invalid amount");

  let previousBalance = user.walletBalance || 0;
  if (action === "deduct" && previousBalance < amountNum) {
    throw new Error("Insufficient wallet balance");
  }

  if (action === "add") {
    user.walletBalance = previousBalance + amountNum;
  } else if (action === "deduct") {
    user.walletBalance = previousBalance - amountNum;
  } else {
    throw new Error("Invalid action");
  }

  await user.save();

  const Transaction = (await import("../../models/transaction.js")).default;
  await Transaction.create({
    user: user._id,
    userModel: "User",
    type: action === "add" ? "Admin Credit" : "Admin Debit",
    amount: amountNum,
    status: "Settled",
    reference: `ADMIN-${Date.now()}`,
    meta: { reason: reason || "Admin adjustment" },
  });

  emitNotificationEvent(NOTIFICATION_EVENTS.WALLET_UPDATED, {
    customerId: user._id,
    userId: user._id,
    data: {
      amount: amountNum,
      direction: action === "add" ? "credited" : "debited",
      reason: reason || "Admin wallet adjustment",
      balance: user.walletBalance,
      dedupeKey: `wallet:admin:${user._id}:${Date.now()}`,
    },
  });

  return {
    walletBalance: user.walletBalance,
    previousBalance,
  };
}
