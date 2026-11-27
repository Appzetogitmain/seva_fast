import Order from "../../models/order.js";
import Admin from "../../models/admin.js";
import Wallet from "../../models/wallet.js";
import Transaction from "../../models/transaction.js";
import { OWNER_TYPE } from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";
import { getOrCreateWallet } from "./walletService.js";
import { getOrCreateFinanceSettings } from "./financeSettingsService.js";

// Orders that were returned / refunded are not earned revenue.
const RETURNED_STATUSES = [
  "returned",
  "qc_passed",
  "refund_completed",
  "return_approved",
  "return_in_transit",
  "return_drop_pending",
  "return_pickup_assigned",
];

// split key -> [amount field in commissionBreakdown, % setting key]
const SPLIT_FIELDS = {
  technical: ["technicalChargeAmount", "technicalChargePercent"],
  maintenance: ["otherMaintenanceAmount", "otherMaintenancePercent"],
  subAdmin: ["subAdminCommissionAmount", "subAdminCommissionPercent"],
  fieldWorker: ["fieldWorkerCommissionAmount", "fieldWorkerCommissionPercent"],
  affiliate: ["affiliateMarketingAmount", "affiliateMarketingPercent"],
  advertise: ["advertiseChargeAmount", "advertiseChargePercent"],
  siteCashback: ["siteCashbackAmount", "siteCashbackPercent"],
  directSlab: ["directSlabCommissionAmount", "directSlabCommissionPercent"],
};

/**
 * Commission Splits report — Admin Commission Sharing Model.
 *
 * Every split is a % of the ADMIN COMMISSION on delivered, non-returned
 * orders. Orders placed after the fix carry their own stored split
 * (splitBasis "admin_commission"); older orders never stored one, so their
 * split is ESTIMATED from the current rates and counted in `estimatedOrders`.
 */
export async function getCommissionSplitsReport({ fromDate, toDate } = {}) {
  const match = {
    status: "delivered",
    returnStatus: { $nin: RETURNED_STATUSES },
  };

  if (fromDate || toDate) {
    match.deliveredAt = {};
    if (fromDate) match.deliveredAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      match.deliveredAt.$lte = end;
    }
  }

  const [orders, financeSettings] = await Promise.all([
    Order.find(match)
      .select(
        "paymentBreakdown.productSubtotal paymentBreakdown.membershipDiscountAmount paymentBreakdown.adminProductCommissionTotal paymentBreakdown.grandTotal paymentBreakdown.sellerPayoutTotal paymentBreakdown.riderPayoutTotal paymentBreakdown.commissionBreakdown",
      )
      .lean(),
    getOrCreateFinanceSettings(),
  ]);
  const rates = Object.fromEntries(
    Object.entries(SPLIT_FIELDS).map(([key, [, pctKey]]) => [key, Number(financeSettings?.[pctKey] || 0)]),
  );

  const sums = {
    productBase: 0,
    adminCommission: 0,
    platformEarning: 0,
    membershipDiscount: 0,
    ...Object.fromEntries(Object.keys(SPLIT_FIELDS).map((k) => [k, 0])),
  };
  let estimatedOrders = 0;

  for (const order of orders) {
    const pb = order.paymentBreakdown || {};
    const adminCommission = Number(pb.adminProductCommissionTotal || 0);
    sums.productBase += Number(pb.productSubtotal || 0);
    sums.adminCommission += adminCommission;
    // Same definition as Order-wise Platform Earnings: customer paid minus
    // seller payout minus rider payout (net of discounts and rider extras).
    if (Number(pb.grandTotal || 0) > 0) {
      sums.platformEarning +=
        Number(pb.grandTotal || 0) - Number(pb.sellerPayoutTotal || 0) - Number(pb.riderPayoutTotal || 0);
    }

    const cb = pb.commissionBreakdown;
    const stored = cb && cb.splitBasis === "admin_commission";
    if (!stored) estimatedOrders += 1;
    for (const [key, [amountField]] of Object.entries(SPLIT_FIELDS)) {
      sums[key] += stored ? Number(cb[amountField] || 0) : (adminCommission * rates[key]) / 100;
    }
    // Stored at the top of paymentBreakdown (not inside commissionBreakdown).
    sums.membershipDiscount += Number(pb.membershipDiscountAmount ?? cb?.membershipDiscountAmount ?? 0);
  }

  const splitTotal = Object.keys(SPLIT_FIELDS).reduce((s, k) => s + sums[k], 0);
  const totals = {
    orderCount: orders.length,
    estimatedOrders,
    splitBasis: "admin_commission",
    productBase: roundCurrency(sums.productBase),
    adminCommission: roundCurrency(sums.adminCommission),
    platformEarning: roundCurrency(sums.platformEarning),
    distributedTotal: roundCurrency(splitTotal),
    platformRetained: roundCurrency(sums.adminCommission - splitTotal),
    membershipDiscount: roundCurrency(sums.membershipDiscount),
    ...Object.fromEntries(Object.keys(SPLIT_FIELDS).map((k) => [k, roundCurrency(sums[k])])),
  };
  const ratePct = (key) => rates[key];

  const splits = [
    {
      key: "technical",
      label: "Technical Charge",
      group: "platform",
      ratePercent: ratePct("technical"),
      amount: totals.technical,
      creditedTo: "Internal allocation (tracked, not separate wallet)",
      status: "tracked",
    },
    {
      key: "maintenance",
      label: "Other Maintenance",
      group: "platform",
      ratePercent: ratePct("maintenance"),
      amount: totals.maintenance,
      creditedTo: "Internal allocation (tracked, not separate wallet)",
      status: "tracked",
    },
    {
      key: "platformRetained",
      label: "Kept by Platform",
      group: "platform",
      ratePercent: roundCurrency(100 - Object.values(rates).reduce((s, v) => s + v, 0)),
      amount: totals.platformRetained,
      creditedTo: "Remainder of admin commission after all splits",
      status: "retained",
    },
    {
      key: "subAdmin",
      label: "Sub Admin",
      group: "operations",
      ratePercent: ratePct("subAdmin"),
      amount: totals.subAdmin,
      creditedTo: "Sub-Admin wallets (by seller zone)",
      status: "credited",
    },
    {
      key: "fieldWorker",
      label: "Field Worker",
      group: "operations",
      ratePercent: ratePct("fieldWorker"),
      amount: totals.fieldWorker,
      creditedTo: "Onboarder customer wallet",
      status: "credited",
    },
    {
      key: "affiliate",
      label: "Affiliate Marketing",
      group: "operations",
      ratePercent: ratePct("affiliate"),
      amount: totals.affiliate,
      creditedTo: "Customer referrer wallet",
      status: "credited",
    },
    {
      key: "advertise",
      label: "Advertise",
      group: "operations",
      ratePercent: ratePct("advertise"),
      amount: totals.advertise,
      creditedTo: "Internal allocation (tracked, not separate wallet)",
      status: "tracked",
    },
    {
      key: "siteCashback",
      label: "Site Cashback",
      group: "incentives",
      ratePercent: ratePct("siteCashback"),
      amount: totals.siteCashback,
      creditedTo: "Internal allocation (tracked)",
      status: "tracked",
    },
    {
      key: "directSlab",
      label: "Direct Customer Buy Slab",
      group: "incentives",
      ratePercent: ratePct("directSlab"),
      amount: totals.directSlab,
      creditedTo: "Internal allocation (tracked)",
      status: "tracked",
    },
    {
      key: "membershipDiscount",
      label: "Club Membership Discounts",
      group: "discounts",
      amount: totals.membershipDiscount,
      creditedTo: "Customer bill discount (not a charge)",
      status: "discount",
    },
  ];

  const subAdmins = await Admin.find({ role: "sub-admin" })
    .select("name email phone assignedZones")
    .populate("assignedZones", "name")
    .lean();

  const subAdminWallets = await Promise.all(
    subAdmins.map(async (sa) => {
      const wallet = await getOrCreateWallet(OWNER_TYPE.SUB_ADMIN, sa._id);
      const recentTxns = await Transaction.find({
        user: sa._id,
        userModel: "Admin",
        type: "Commission",
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("amount reference status createdAt meta")
        .lean();

      return {
        _id: sa._id,
        name: sa.name,
        email: sa.email,
        phone: sa.phone,
        zones: (sa.assignedZones || []).map((z) => z?.name || z).filter(Boolean),
        availableBalance: roundCurrency(wallet.availableBalance || 0),
        pendingBalance: roundCurrency(wallet.pendingBalance || 0),
        totalCredited: roundCurrency(wallet.totalCredited || 0),
        recentCommissions: recentTxns.map((t) => ({
          amount: t.amount,
          reference: t.reference,
          status: t.status,
          date: t.createdAt,
          description: t.meta?.description || "Sub-admin commission",
        })),
      };
    }),
  );

  const creditedTxns = await Transaction.find({
    type: { $in: ["Commission", "Incentive"] },
    reference: { $regex: /^(SA-COMM-|FW-COMM-|AFF-COMM-)/ },
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { $gte: new Date(fromDate) } : {}),
            ...(toDate
              ? {
                  $lte: (() => {
                    const end = new Date(toDate);
                    end.setHours(23, 59, 59, 999);
                    return end;
                  })(),
                }
              : {}),
          },
        }
      : {}),
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("user", "name phone email shopName")
    .lean();

  return {
    totals,
    splits,
    subAdminWallets,
    recentCredits: creditedTxns.map((t) => ({
      id: t._id,
      type: t.reference?.startsWith("SA-COMM")
        ? "Sub Admin"
        : t.reference?.startsWith("FW-COMM")
          ? "Field Worker"
          : t.reference?.startsWith("AFF-COMM")
            ? "Affiliate"
            : t.type,
      amount: t.amount,
      reference: t.reference,
      status: t.status,
      userModel: t.userModel,
      userName: t.user?.name || t.user?.shopName || "—",
      userPhone: t.user?.phone || "",
      date: t.createdAt,
      description: t.meta?.description || t.type,
    })),
  };
}

export async function ensureSubAdminWallet(subAdminId) {
  return getOrCreateWallet(OWNER_TYPE.SUB_ADMIN, subAdminId);
}
