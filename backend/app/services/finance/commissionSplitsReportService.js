import Order from "../../models/order.js";
import Admin from "../../models/admin.js";
import Wallet from "../../models/wallet.js";
import Transaction from "../../models/transaction.js";
import { OWNER_TYPE } from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";
import { getOrCreateWallet } from "./walletService.js";

/**
 * Aggregate billing-split amounts from delivered orders + live sub-admin wallets.
 */
export async function getCommissionSplitsReport({ fromDate, toDate } = {}) {
  const match = {
    status: "delivered",
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

  const [agg] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        orderCount: { $sum: 1 },
        productBase: { $sum: { $ifNull: ["$paymentBreakdown.productSubtotal", 0] } },
        adminCommission: {
          $sum: { $ifNull: ["$paymentBreakdown.adminProductCommissionTotal", 0] },
        },
        platformEarning: {
          $sum: { $ifNull: ["$paymentBreakdown.platformTotalEarning", 0] },
        },
        technical: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.technicalChargeAmount", 0] },
        },
        maintenance: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.otherMaintenanceAmount", 0] },
        },
        subAdmin: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.subAdminCommissionAmount", 0] },
        },
        fieldWorker: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.fieldWorkerCommissionAmount", 0] },
        },
        affiliate: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.affiliateMarketingAmount", 0] },
        },
        advertise: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.advertiseChargeAmount", 0] },
        },
        siteCashback: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.siteCashbackAmount", 0] },
        },
        directSlab: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.directSlabCommissionAmount", 0] },
        },
        membershipDiscount: {
          $sum: { $ifNull: ["$paymentBreakdown.commissionBreakdown.membershipDiscountAmount", 0] },
        },
      },
    },
  ]);

  const totals = {
    orderCount: Number(agg?.orderCount || 0),
    productBase: roundCurrency(agg?.productBase || 0),
    adminCommission: roundCurrency(agg?.adminCommission || 0),
    platformEarning: roundCurrency(agg?.platformEarning || 0),
    technical: roundCurrency(agg?.technical || 0),
    maintenance: roundCurrency(agg?.maintenance || 0),
    subAdmin: roundCurrency(agg?.subAdmin || 0),
    fieldWorker: roundCurrency(agg?.fieldWorker || 0),
    affiliate: roundCurrency(agg?.affiliate || 0),
    advertise: roundCurrency(agg?.advertise || 0),
    siteCashback: roundCurrency(agg?.siteCashback || 0),
    directSlab: roundCurrency(agg?.directSlab || 0),
    membershipDiscount: roundCurrency(agg?.membershipDiscount || 0),
  };

  const splits = [
    {
      key: "adminCommission",
      label: "Admin Commission",
      group: "platform",
      amount: totals.adminCommission,
      creditedTo: "Platform wallet (inside Platform Earning)",
      status: "credited",
    },
    {
      key: "technical",
      label: "Technical Charge",
      group: "platform",
      amount: totals.technical,
      creditedTo: "Internal allocation (tracked, not separate wallet)",
      status: "tracked",
    },
    {
      key: "maintenance",
      label: "Other Maintenance",
      group: "platform",
      amount: totals.maintenance,
      creditedTo: "Internal allocation (tracked, not separate wallet)",
      status: "tracked",
    },
    {
      key: "subAdmin",
      label: "Sub Admin",
      group: "operations",
      amount: totals.subAdmin,
      creditedTo: "Sub-Admin wallets (by seller zone)",
      status: "credited",
    },
    {
      key: "fieldWorker",
      label: "Field Worker",
      group: "operations",
      amount: totals.fieldWorker,
      creditedTo: "Onboarder customer wallet",
      status: "credited",
    },
    {
      key: "affiliate",
      label: "Affiliate Marketing",
      group: "operations",
      amount: totals.affiliate,
      creditedTo: "Customer referrer wallet",
      status: "credited",
    },
    {
      key: "advertise",
      label: "Advertise",
      group: "operations",
      amount: totals.advertise,
      creditedTo: "Internal allocation (tracked, not separate wallet)",
      status: "tracked",
    },
    {
      key: "siteCashback",
      label: "Site Cashback",
      group: "incentives",
      amount: totals.siteCashback,
      creditedTo: "Internal allocation (tracked)",
      status: "tracked",
    },
    {
      key: "directSlab",
      label: "Direct Customer Buy Slab",
      group: "incentives",
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
