import Order from "../../models/order.js";
import { roundCurrency } from "../../utils/money.js";

export async function getAdminOrderEarnings({
  page = 1,
  limit = 25,
  search = "",
  paymentMode,
  fromDate,
  toDate,
} = {}) {
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const query = { status: "delivered" };

  if (paymentMode) query.paymentMode = paymentMode;

  if (fromDate || toDate) {
    query.deliveredAt = {};
    if (fromDate) query.deliveredAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.deliveredAt.$lte = end;
    }
  }

  const searchTerm = String(search || "").trim();
  if (searchTerm) {
    query.orderId = { $regex: searchTerm, $options: "i" };
  }

  const [orders, total, summaryAgg] = await Promise.all([
    Order.find(query)
      .sort({ deliveredAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("seller", "shopName name phone")
      .select(
        "orderId deliveredAt paymentMode paymentStatus paymentBreakdown settlementStatus financeFlags pricing createdAt seller couponCode",
      )
      .lean(),
    Order.countDocuments(query),
    Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          totalCustomerPaid: {
            $sum: { $ifNull: ["$paymentBreakdown.grandTotal", "$pricing.total"] },
          },
          totalProductSubtotal: {
            $sum: { $ifNull: ["$paymentBreakdown.productSubtotal", "$pricing.subtotal"] },
          },
          totalPlatformEarning: {
            $sum: { $ifNull: ["$paymentBreakdown.platformTotalEarning", 0] },
          },
          totalAdminCommission: {
            $sum: { $ifNull: ["$paymentBreakdown.adminProductCommissionTotal", 0] },
          },
          totalSellerPayout: {
            $sum: { $ifNull: ["$paymentBreakdown.sellerPayoutTotal", 0] },
          },
          totalRiderPayout: {
            $sum: { $ifNull: ["$paymentBreakdown.riderPayoutTotal", 0] },
          },
          totalDiscountGiven: {
            $sum: { $ifNull: ["$paymentBreakdown.discountTotal", "$pricing.discount"] },
          },
          totalWalletUsed: {
            $sum: { $ifNull: ["$paymentBreakdown.walletAmount", "$pricing.walletAmount"] },
          },
        },
      },
    ]),
  ]);

  const items = orders.map((order) => {
    const pb = order.paymentBreakdown || {};
    const comm = pb.commissionBreakdown || {};
    const settlement = order.settlementStatus || {};

    return {
      orderId: order.orderId,
      orderMongoId: order._id,
      deliveredAt: order.deliveredAt || order.createdAt,
      paymentMode: order.paymentMode || "COD",
      paymentStatus: order.paymentStatus || "PENDING",
      seller: order.seller
        ? {
            _id: order.seller._id,
            shopName: order.seller.shopName,
            name: order.seller.name,
          }
        : null,
      // Core amounts
      productSubtotal: roundCurrency(pb.productSubtotal ?? order.pricing?.subtotal ?? 0),
      customerPaid: roundCurrency(pb.grandTotal ?? order.pricing?.total ?? 0),
      platformEarning: roundCurrency(pb.platformTotalEarning ?? 0),
      adminCommission: roundCurrency(pb.adminProductCommissionTotal ?? 0),
      deliveryFee: roundCurrency(pb.deliveryFeeCharged ?? order.pricing?.deliveryFee ?? 0),
      handlingFee: roundCurrency(pb.handlingFeeCharged ?? 0),
      tip: roundCurrency(pb.tipTotal ?? pb.riderTipAmount ?? 0),
      sellerPayout: roundCurrency(pb.sellerPayoutTotal ?? 0),
      riderPayout: roundCurrency(pb.riderPayoutTotal ?? 0),

      // Discount & wallet
      discountTotal: roundCurrency(pb.discountTotal ?? order.pricing?.discount ?? 0),
      walletAmount: roundCurrency(pb.walletAmount ?? order.pricing?.walletAmount ?? 0),

      // Discount source attribution
      discountSources: {
        coupon: roundCurrency(
          (pb.discountTotal ?? 0) - (pb.membershipDiscountAmount ?? 0) - (pb.firstOrderDiscountAmount ?? 0),
        ),
        couponCode: order.couponCode || null,
        membership: roundCurrency(pb.membershipDiscountAmount ?? 0),
        membershipTier: comm.membershipTier || null,
        firstOrder: roundCurrency(pb.firstOrderDiscountAmount ?? 0),
      },

      // Admin subsidy — total discount admin bears (seller is NOT charged for this)
      adminDiscountSubsidy: roundCurrency(pb.discountTotal ?? order.pricing?.discount ?? 0),

      adminEarningCredited: Boolean(
        settlement.adminEarningCredited ?? order.financeFlags?.adminEarningCredited,
      ),
      settlement: {
        overall: settlement.overall || "PENDING",
        sellerPayout: settlement.sellerPayout || "PENDING",
        riderPayout: settlement.riderPayout || "PENDING",
        adminEarningCredited: Boolean(settlement.adminEarningCredited),
      },
      commissionSplits: {
        affiliate: roundCurrency(comm.affiliateMarketingAmount ?? 0),
        subAdmin: roundCurrency(comm.subAdminCommissionAmount ?? 0),
        fieldWorker: roundCurrency(comm.fieldWorkerCommissionAmount ?? 0),
        technical: roundCurrency(comm.technicalChargeAmount ?? 0),
        maintenance: roundCurrency(comm.otherMaintenanceAmount ?? 0),
        advertise: roundCurrency(comm.advertiseChargeAmount ?? 0),
      },
    };
  });

  const summaryRow = summaryAgg[0] || {};

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit) || 1,
    summary: {
      orderCount: Number(summaryRow.orderCount || 0),
      totalCustomerPaid: roundCurrency(summaryRow.totalCustomerPaid || 0),
      totalProductSubtotal: roundCurrency(summaryRow.totalProductSubtotal || 0),
      totalPlatformEarning: roundCurrency(summaryRow.totalPlatformEarning || 0),
      totalAdminCommission: roundCurrency(summaryRow.totalAdminCommission || 0),
      totalSellerPayout: roundCurrency(summaryRow.totalSellerPayout || 0),
      totalRiderPayout: roundCurrency(summaryRow.totalRiderPayout || 0),
      totalDiscountGiven: roundCurrency(summaryRow.totalDiscountGiven || 0),
      totalWalletUsed: roundCurrency(summaryRow.totalWalletUsed || 0),
    },
  };
}
