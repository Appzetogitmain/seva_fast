import Wallet from "../../models/wallet.js";
import Payout from "../../models/payout.js";
import Order from "../../models/order.js";
import Customer from "../../models/customer.js";
import Seller from "../../models/seller.js";
import Delivery from "../../models/delivery.js";
import {
  ORDER_PAYMENT_STATUS,
  OWNER_TYPE,
  PAYOUT_STATUS,
  PAYOUT_TYPE,
  WALLET_STATUS,
} from "../../constants/finance.js";
import { addMoney, clampMoney, roundCurrency } from "../../utils/money.js";

function normalizeOwnerId(ownerType, ownerId) {
  // Platform admin wallet is a single shared wallet (ownerId null).
  // Sub-admin wallets are per Admin document.
  if (ownerType === OWNER_TYPE.ADMIN) return null;
  return ownerId || null;
}

function assertPositiveAmount(amount) {
  const normalized = roundCurrency(amount);
  if (normalized <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  return normalized;
}

export async function getOrCreateWallet(ownerType, ownerId, { session } = {}) {
  const normalizedOwnerId = normalizeOwnerId(ownerType, ownerId);
  const query = {
    ownerType,
    ownerId: normalizedOwnerId,
  };
  const options = {};
  if (session) options.session = session;

  let wallet = await Wallet.findOne(query, null, options);
  if (!wallet) {
    wallet = await Wallet.create(
      [
        {
          ownerType,
          ownerId: normalizedOwnerId,
          availableBalance: 0,
          pendingBalance: 0,
          cashInHand: 0,
          totalCredited: 0,
          totalDebited: 0,
          status: WALLET_STATUS.ACTIVE,
        },
      ],
      options,
    );
    wallet = wallet[0];
  }
  return wallet;
}

export async function creditWallet({
  ownerType,
  ownerId,
  amount,
  bucket = "available",
  session,
}) {
  const normalizedAmount = assertPositiveAmount(amount);
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });

  if (wallet.status !== WALLET_STATUS.ACTIVE) {
    throw new Error("Wallet is not active");
  }

  const before = wallet[`${bucket}Balance`];
  wallet[`${bucket}Balance`] = addMoney(before, normalizedAmount);
  wallet.totalCredited = addMoney(wallet.totalCredited, normalizedAmount);

  await wallet.save({ session });
  return {
    wallet,
    amount: normalizedAmount,
    before: roundCurrency(before),
    after: roundCurrency(wallet[`${bucket}Balance`]),
    bucket,
  };
}

export async function debitWallet({
  ownerType,
  ownerId,
  amount,
  bucket = "available",
  session,
}) {
  const normalizedAmount = assertPositiveAmount(amount);
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });

  if (wallet.status !== WALLET_STATUS.ACTIVE) {
    throw new Error("Wallet is not active");
  }

  const field = `${bucket}Balance`;
  const before = roundCurrency(wallet[field] || 0);
  if (before < normalizedAmount) {
    throw new Error(`Insufficient ${bucket} balance`);
  }

  wallet[field] = roundCurrency(before - normalizedAmount);
  wallet.totalDebited = addMoney(wallet.totalDebited, normalizedAmount);
  await wallet.save({ session });

  return {
    wallet,
    amount: normalizedAmount,
    before,
    after: roundCurrency(wallet[field]),
    bucket,
  };
}

export async function movePendingToAvailable({
  ownerType,
  ownerId,
  amount,
  session,
}) {
  const normalizedAmount = assertPositiveAmount(amount);
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });

  if (wallet.pendingBalance < normalizedAmount) {
    throw new Error("Insufficient pending balance");
  }

  const pendingBefore = roundCurrency(wallet.pendingBalance);
  const availableBefore = roundCurrency(wallet.availableBalance);

  wallet.pendingBalance = roundCurrency(wallet.pendingBalance - normalizedAmount);
  wallet.availableBalance = roundCurrency(wallet.availableBalance + normalizedAmount);
  await wallet.save({ session });

  return {
    wallet,
    amount: normalizedAmount,
    pendingBefore,
    pendingAfter: roundCurrency(wallet.pendingBalance),
    availableBefore,
    availableAfter: roundCurrency(wallet.availableBalance),
  };
}

export async function updateCashInHand({
  ownerType,
  ownerId,
  deltaAmount,
  session,
}) {
  const wallet = await getOrCreateWallet(ownerType, ownerId, { session });
  const delta = roundCurrency(deltaAmount || 0);
  if (delta === 0) {
    return {
      wallet,
      before: roundCurrency(wallet.cashInHand || 0),
      after: roundCurrency(wallet.cashInHand || 0),
      delta: 0,
    };
  }

  const before = roundCurrency(wallet.cashInHand || 0);
  wallet.cashInHand = clampMoney(before + delta, 0);
  await wallet.save({ session });

  return {
    wallet,
    before,
    after: roundCurrency(wallet.cashInHand),
    delta,
  };
}

export async function getAdminFinanceSummary() {
  const adminWallet = await getOrCreateWallet(OWNER_TYPE.ADMIN, null);

  const [
    onlineCollection,
    codReconciled,
    adminEarning,
    pendingPayouts,
    systemFloatCOD,
    platformGross,
  ] =
    await Promise.all([
      Order.aggregate([
        {
          $match: {
            paymentMode: "ONLINE",
            paymentStatus: ORDER_PAYMENT_STATUS.PAID,
          },
        },
        { $group: { _id: null, amount: { $sum: "$paymentBreakdown.grandTotal" } } },
      ]),
      Order.aggregate([
        { $match: { paymentMode: "COD" } },
        { $group: { _id: null, amount: { $sum: "$paymentBreakdown.codRemittedAmount" } } },
      ]),
      Order.aggregate([
        // Requirement: Total Admin Earning should not include COD orders.
        { $match: { status: "delivered", paymentMode: "ONLINE" } },
        { $group: { _id: null, amount: { $sum: "$paymentBreakdown.platformTotalEarning" } } },
      ]),
      Payout.aggregate([
        { $match: { status: { $in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING] } } },
        { $group: { _id: "$payoutType", amount: { $sum: "$amount" } } },
      ]),
      // System Float (COD): only after delivery. Undelivered COD must not move any wallet/float numbers.
      // - After cash is marked collected, use persisted `codPendingAmount` (net of remittances).
      // - After delivery but before collection, estimate: grandTotal - riderPayoutTotal.
      Order.aggregate([
        {
          $match: {
            paymentMode: "COD",
            status: "delivered",
          },
        },
        {
          $group: {
            _id: null,
            amount: {
              $sum: {
                $let: {
                  vars: {
                    collected: {
                      $ifNull: ["$financeFlags.codMarkedCollected", false],
                    },
                    pending: {
                      $ifNull: ["$paymentBreakdown.codPendingAmount", 0],
                    },
                    gross: { $ifNull: ["$paymentBreakdown.grandTotal", 0] },
                    rider: { $ifNull: ["$paymentBreakdown.riderPayoutTotal", 0] },
                  },
                  in: {
                    $cond: [
                      "$$collected",
                      "$$pending",
                      {
                        $max: [{ $subtract: ["$$gross", "$$rider"] }, 0],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      ]),
      // Total money collected / available-balance base:
      // - ONLINE: only paid/captured orders
      // - COD: only delivered orders (no wallet impact before delivery)
      Order.aggregate([
        {
          $match: {
            status: { $ne: "cancelled" },
            orderStatus: { $ne: "cancelled" },
            $or: [
              {
                paymentMode: "ONLINE",
                paymentStatus: ORDER_PAYMENT_STATUS.PAID,
              },
              {
                paymentMode: "COD",
                status: "delivered",
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            amount: {
              $sum: {
                $ifNull: ["$paymentBreakdown.grandTotal", "$pricing.total"],
              },
            },
          },
        },
      ]),
    ]);

  const sellerPendingPayouts =
    pendingPayouts.find((row) => row._id === PAYOUT_TYPE.SELLER)?.amount || 0;
  const riderPendingPayouts =
    pendingPayouts.find((row) => row._id === PAYOUT_TYPE.DELIVERY_PARTNER)?.amount || 0;

  const totalPlatformEarning = roundCurrency(platformGross[0]?.amount || 0);
  // Available Balance = recognized checkout value minus pending payout liabilities.
  // COD is recognized only after delivery, so undelivered COD cannot inflate this.
  const availableBalanceVirtual = roundCurrency(
    Math.max(
      totalPlatformEarning - roundCurrency(sellerPendingPayouts) - roundCurrency(riderPendingPayouts),
      0,
    ),
  );

  const adminReferralUser = await Customer.findOne({ role: "admin", referralCode: "SEVAFAST" }).lean();
  const adminReferralEarnings = roundCurrency(adminReferralUser?.walletBalance || 0);

  return {
    totalPlatformEarning,
    totalAdminEarning: roundCurrency(adminEarning[0]?.amount || 0),
    availableBalance: availableBalanceVirtual,
    walletAvailableBalance: roundCurrency(adminWallet.availableBalance || 0),
    systemFloatCOD: roundCurrency(systemFloatCOD[0]?.amount || 0),
    sellerPendingPayouts: roundCurrency(sellerPendingPayouts),
    deliveryPendingPayouts: roundCurrency(riderPendingPayouts),
    reconciledOnlineInflows: roundCurrency(onlineCollection[0]?.amount || 0),
    reconciledCODInflows: roundCurrency(codReconciled[0]?.amount || 0),
    adminReferralEarnings,
  };
}

function aggregateToAmountMap(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row._id == null) continue;
    map.set(String(row._id), roundCurrency(row.amount || 0));
  }
  return map;
}

/**
 * Per-rider and per-seller COD cash tracking for the admin dashboard:
 * cash currently held, cash already handed over/remitted onward, cash still
 * pending, and (for sellers) the product payout admin still owes them.
 */
export async function getCodPartnerBreakdown() {
  const [
    riderWallets,
    sellerWallets,
    riderPendingOrders,
    sellerPendingOrders,
    riderSettledRows,
    sellerSettledRows,
    sellerPayoutRows,
  ] = await Promise.all([
    Wallet.find({ ownerType: OWNER_TYPE.DELIVERY_PARTNER, ownerId: { $ne: null } })
      .select("ownerId cashInHand")
      .lean(),
    Wallet.find({ ownerType: OWNER_TYPE.SELLER, ownerId: { $ne: null } })
      .select("ownerId cashInHand")
      .lean(),
    // Raw orders (not just grouped sums) so we can show, per rider, exactly
    // which seller and which order each pending amount belongs to.
    Order.find({
      paymentMode: "COD",
      "financeFlags.codCashWithRider": true,
      "paymentBreakdown.codPendingAmount": { $gt: 0 },
    })
      .select("orderId deliveryBoy seller deliveredAt createdAt paymentBreakdown.codPendingAmount")
      .populate("seller", "shopName name")
      .sort({ createdAt: -1 })
      .lean(),
    // Same idea for sellers: which rider handed them how much, per order.
    Order.find({
      paymentMode: "COD",
      "financeFlags.codCashWithSeller": true,
      "paymentBreakdown.codPendingAmount": { $gt: 0 },
    })
      .select("orderId deliveryBoy seller deliveredAt createdAt paymentBreakdown.codPendingAmount")
      .populate("deliveryBoy", "name phone")
      .sort({ createdAt: -1 })
      .lean(),
    Order.aggregate([
      { $match: { paymentMode: "COD", deliveryBoy: { $ne: null }, "paymentBreakdown.codRemittedAmount": { $gt: 0 } } },
      { $group: { _id: "$deliveryBoy", amount: { $sum: "$paymentBreakdown.codRemittedAmount" } } },
    ]),
    Order.aggregate([
      { $match: { paymentMode: "COD", seller: { $ne: null }, "paymentBreakdown.codRemittedAmount": { $gt: 0 } } },
      { $group: { _id: "$seller", amount: { $sum: "$paymentBreakdown.codRemittedAmount" } } },
    ]),
    Payout.aggregate([
      {
        $match: {
          payoutType: PAYOUT_TYPE.SELLER,
          status: { $in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING] },
        },
      },
      { $group: { _id: "$beneficiaryId", amount: { $sum: "$amount" } } },
    ]),
  ]);

  const riderCashMap = new Map(riderWallets.map((w) => [String(w.ownerId), roundCurrency(w.cashInHand || 0)]));
  const sellerCashMap = new Map(sellerWallets.map((w) => [String(w.ownerId), roundCurrency(w.cashInHand || 0)]));
  const riderSettledMap = aggregateToAmountMap(riderSettledRows);
  const sellerSettledMap = aggregateToAmountMap(sellerSettledRows);
  const sellerPayoutMap = aggregateToAmountMap(sellerPayoutRows);

  // Group each rider's pending orders, tagging which seller each one is owed to.
  const riderPendingByRider = new Map();
  for (const order of riderPendingOrders) {
    if (!order.deliveryBoy) continue;
    const riderId = String(order.deliveryBoy);
    const amount = roundCurrency(order.paymentBreakdown?.codPendingAmount || 0);
    if (amount <= 0) continue;
    if (!riderPendingByRider.has(riderId)) {
      riderPendingByRider.set(riderId, { amount: 0, orders: [] });
    }
    const bucket = riderPendingByRider.get(riderId);
    bucket.amount = roundCurrency(bucket.amount + amount);
    bucket.orders.push({
      orderId: order.orderId,
      sellerId: order.seller?._id ? String(order.seller._id) : null,
      sellerName: order.seller?.shopName || order.seller?.name || "Unknown Seller",
      amount,
      deliveredAt: order.deliveredAt || order.createdAt || null,
    });
  }

  // Group each seller's pending orders, tagging which rider is holding each one.
  const sellerPendingBySeller = new Map();
  for (const order of sellerPendingOrders) {
    if (!order.seller) continue;
    const sellerId = String(order.seller);
    const amount = roundCurrency(order.paymentBreakdown?.codPendingAmount || 0);
    if (amount <= 0) continue;
    if (!sellerPendingBySeller.has(sellerId)) {
      sellerPendingBySeller.set(sellerId, { amount: 0, orders: [] });
    }
    const bucket = sellerPendingBySeller.get(sellerId);
    bucket.amount = roundCurrency(bucket.amount + amount);
    bucket.orders.push({
      orderId: order.orderId,
      riderId: order.deliveryBoy?._id ? String(order.deliveryBoy._id) : null,
      riderName: order.deliveryBoy?.name || "Unknown Rider",
      amount,
      deliveredAt: order.deliveredAt || order.createdAt || null,
    });
  }

  const riderIds = new Set([
    ...riderCashMap.keys(),
    ...riderPendingByRider.keys(),
    ...riderSettledMap.keys(),
  ]);
  const sellerIds = new Set([
    ...sellerCashMap.keys(),
    ...sellerPendingBySeller.keys(),
    ...sellerSettledMap.keys(),
    ...sellerPayoutMap.keys(),
  ]);

  const [riderDocs, sellerDocs] = await Promise.all([
    Delivery.find({ _id: { $in: [...riderIds] } }).select("name phone").lean(),
    Seller.find({ _id: { $in: [...sellerIds] } }).select("shopName name phone").lean(),
  ]);
  const riderNameMap = new Map(riderDocs.map((d) => [String(d._id), d]));
  const sellerNameMap = new Map(sellerDocs.map((d) => [String(d._id), d]));

  const riders = [...riderIds]
    .map((id) => {
      const cashInHand = riderCashMap.get(id) || 0;
      const pending = riderPendingByRider.get(id) || { amount: 0, orders: [] };
      const totalSettled = riderSettledMap.get(id) || 0;
      if (cashInHand <= 0 && pending.amount <= 0 && totalSettled <= 0) return null;
      const doc = riderNameMap.get(id);
      return {
        riderId: id,
        name: doc?.name || "Unknown Rider",
        phone: doc?.phone || "",
        cashInHand,
        pendingHandoff: pending.amount,
        totalSettled,
        // Which seller(s) and order(s) make up pendingHandoff.
        pendingOrders: pending.orders,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.cashInHand - a.cashInHand);

  const sellers = [...sellerIds]
    .map((id) => {
      const cashInHand = sellerCashMap.get(id) || 0;
      const pending = sellerPendingBySeller.get(id) || { amount: 0, orders: [] };
      const totalSettled = sellerSettledMap.get(id) || 0;
      const payoutOwedByAdmin = sellerPayoutMap.get(id) || 0;
      if (cashInHand <= 0 && pending.amount <= 0 && totalSettled <= 0 && payoutOwedByAdmin <= 0) return null;
      const doc = sellerNameMap.get(id);
      return {
        sellerId: id,
        name: doc?.shopName || doc?.name || "Unknown Seller",
        phone: doc?.phone || "",
        cashInHand,
        pendingRemit: pending.amount,
        totalSettled,
        payoutOwedByAdmin,
        // Which rider(s) and order(s) make up pendingRemit.
        pendingOrders: pending.orders,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.cashInHand - a.cashInHand);

  return { riders, sellers };
}
