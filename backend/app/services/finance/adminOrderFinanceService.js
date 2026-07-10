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
        "orderId deliveredAt paymentMode paymentStatus paymentBreakdown settlementStatus financeFlags pricing createdAt seller",
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
      customerPaid: roundCurrency(pb.grandTotal ?? order.pricing?.total ?? 0),
      platformEarning: roundCurrency(pb.platformTotalEarning ?? 0),
      adminCommission: roundCurrency(pb.adminProductCommissionTotal ?? 0),
      deliveryFee: roundCurrency(pb.deliveryFeeCharged ?? order.pricing?.deliveryFee ?? 0),
      handlingFee: roundCurrency(pb.handlingFeeCharged ?? 0),
      tip: roundCurrency(pb.tipTotal ?? pb.riderTipAmount ?? 0),
      sellerPayout: roundCurrency(pb.sellerPayoutTotal ?? 0),
      riderPayout: roundCurrency(pb.riderPayoutTotal ?? 0),
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
      totalPlatformEarning: roundCurrency(summaryRow.totalPlatformEarning || 0),
      totalAdminCommission: roundCurrency(summaryRow.totalAdminCommission || 0),
      totalSellerPayout: roundCurrency(summaryRow.totalSellerPayout || 0),
      totalRiderPayout: roundCurrency(summaryRow.totalRiderPayout || 0),
    },
  };
}
