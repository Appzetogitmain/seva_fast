import mongoose from "mongoose";
import Order from "../models/order.js";
import Coupon from "../models/coupon.js";

const EXCLUDED_STATUSES = ["cancelled", "declined"];

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return null;
}

function buildCouponMatch(coupon) {
  const or = [];
  const id = toObjectId(coupon?._id || coupon?.id || coupon?.couponId);
  if (id) or.push({ couponId: id });
  const code = coupon?.code ? String(coupon.code).trim().toUpperCase() : "";
  if (code) or.push({ couponCode: code });
  return or.length ? { $or: or } : null;
}

/**
 * Count coupon redemptions at checkout-group level (multi-seller checkout = 1 use).
 */
export async function countCouponRedemptions({
  coupon,
  customerId = null,
  session = null,
} = {}) {
  const couponMatch = buildCouponMatch(coupon);
  if (!couponMatch) return 0;

  const match = {
    ...couponMatch,
    status: { $nin: EXCLUDED_STATUSES },
  };

  const customerOid = toObjectId(customerId);
  if (customerId) {
    if (!customerOid) return 0;
    match.customer = customerOid;
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          $ifNull: ["$checkoutGroupId", { $toString: "$_id" }],
        },
      },
    },
    { $count: "count" },
  ];

  const agg = Order.aggregate(pipeline);
  if (session) agg.session(session);
  const rows = await agg;
  return Number(rows[0]?.count || 0);
}

/**
 * Map of couponId string / coupon code -> redemption count for admin list.
 */
export async function getCouponRedemptionCounts(coupons = []) {
  if (!Array.isArray(coupons) || coupons.length === 0) {
    return { byId: {}, byCode: {} };
  }

  const ids = coupons.map((c) => toObjectId(c._id)).filter(Boolean);
  const codes = coupons
    .map((c) => String(c.code || "").trim().toUpperCase())
    .filter(Boolean);

  const or = [];
  if (ids.length) or.push({ couponId: { $in: ids } });
  if (codes.length) or.push({ couponCode: { $in: codes } });
  if (!or.length) return { byId: {}, byCode: {} };

  const rows = await Order.aggregate([
    {
      $match: {
        status: { $nin: EXCLUDED_STATUSES },
        $or: or,
      },
    },
    {
      $addFields: {
        redemptionKey: {
          $ifNull: ["$checkoutGroupId", { $toString: "$_id" }],
        },
        idKey: {
          $cond: [
            { $ifNull: ["$couponId", false] },
            { $toString: "$couponId" },
            null,
          ],
        },
        codeKey: {
          $cond: [
            {
              $and: [
                { $ne: ["$couponCode", null] },
                { $ne: ["$couponCode", ""] },
              ],
            },
            { $toUpper: "$couponCode" },
            null,
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          redemptionKey: "$redemptionKey",
          idKey: "$idKey",
          codeKey: "$codeKey",
        },
      },
    },
    {
      $group: {
        _id: null,
        items: {
          $push: {
            idKey: "$_id.idKey",
            codeKey: "$_id.codeKey",
          },
        },
      },
    },
  ]);

  const byId = {};
  const byCode = {};
  const items = rows[0]?.items || [];
  for (const item of items) {
    if (item.idKey) {
      byId[item.idKey] = (byId[item.idKey] || 0) + 1;
    }
    if (item.codeKey) {
      byCode[item.codeKey] = (byCode[item.codeKey] || 0) + 1;
    }
  }
  return { byId, byCode };
}

export function resolveUsedCount(coupon, counts) {
  const idCount = counts?.byId?.[String(coupon._id)];
  const codeCount = counts?.byCode?.[String(coupon.code || "").toUpperCase()];
  if (Number.isFinite(idCount)) return idCount;
  if (Number.isFinite(codeCount)) return codeCount;
  return Number(coupon.usedCount || 0);
}

/**
 * Validate coupon is still usable for this customer; returns coupon doc.
 */
export async function assertCouponUsable({
  couponId,
  customerId,
  session = null,
} = {}) {
  if (!couponId) return null;

  let query = Coupon.findById(couponId);
  if (session) query = query.session(session);
  const coupon = await query;
  if (!coupon) {
    throw new Error("Invalid coupon");
  }

  const now = new Date();
  if (!coupon.isActive || coupon.validFrom > now || coupon.validTill < now) {
    throw new Error("This coupon is not active");
  }

  const totalUsed = await countCouponRedemptions({ coupon, session });
  if (coupon.usageLimit && totalUsed >= coupon.usageLimit) {
    throw new Error("This coupon has reached its usage limit");
  }

  if (customerId && coupon.perUserLimit) {
    const userUsed = await countCouponRedemptions({
      coupon,
      customerId,
      session,
    });
    if (userUsed >= coupon.perUserLimit) {
      throw new Error(
        `You can use this coupon only ${coupon.perUserLimit} time${coupon.perUserLimit > 1 ? "s" : ""}`
      );
    }
  }

  return coupon;
}

export async function syncCouponUsedCount(couponId, couponCode = null) {
  if (!couponId) return;
  const usedCount = await countCouponRedemptions({
    coupon: { _id: couponId, code: couponCode },
  });
  await Coupon.findByIdAndUpdate(couponId, { usedCount }).catch(() => {});
  return usedCount;
}
