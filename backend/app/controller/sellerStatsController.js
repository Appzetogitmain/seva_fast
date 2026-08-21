import Order from "../models/order.js";
import Transaction from "../models/transaction.js";
import Product from "../models/product.js";
import Seller from "../models/seller.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import Wallet from "../models/wallet.js";
import {
  sellerDeliveredOrderMatch,
  sellerOrderEarningAmount,
  sellerOrderRevenueAmount,
  sellerOrderCostAmount,
  sellerOrderProfitAmount,
  sellerOrderSellingPriceAmount,
  sellerOrderCommissionAmount,
  sellerOrderDeliveryEarningAmount,
  sellerOrderCommissionExemptFlag,
} from "../utils/sellerRevenue.js";
import { releaseExpiredHeldSellerPayouts } from "../services/finance/orderFinanceService.js";
import { formatDate, formatTime } from "../utils/formatDate.js";

/* ===============================
   GET SELLER DASHBOARD STATS
================================ */
export const getSellerStats = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const sellerOid = new mongoose.Types.ObjectId(sellerId);

        // Date boundaries
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        // Sales Trend date range
        const { range = 'daily' } = req.query;
        let trendStartDate = new Date();
        let aggregationFormat = "%Y-%m-%d";

        if (range === 'monthly') {
            trendStartDate.setMonth(trendStartDate.getMonth() - 6);
            aggregationFormat = "%Y-%m";
        } else if (range === 'weekly') {
            trendStartDate.setDate(trendStartDate.getDate() - 28);
            aggregationFormat = "%Y-%U";
        } else {
            trendStartDate.setDate(trendStartDate.getDate() - 7);
        }

        // Single aggregation pipeline with $facet — replaces 5 separate DB queries
        const [statsResult] = await Order.aggregate([
            {
                $match: sellerDeliveredOrderMatch(sellerOid),
            },
            {
                $addFields: {
                    revenueDate: {
                        $ifNull: [
                            "$deliveredAt",
                            { $ifNull: ["$updatedAt", "$createdAt"] },
                        ],
                    },
                },
            },
            {
                $facet: {
                    // Overview totals — delivered orders only
                    overview: [
                        {
                            $group: {
                                _id: null,
                                totalSales: { $sum: sellerOrderRevenueAmount() },
                                totalEarnings: { $sum: sellerOrderEarningAmount() },
                                totalCostPrice: { $sum: sellerOrderCostAmount() },
                                totalNetProfit: { $sum: sellerOrderProfitAmount() },
                                totalOrders: { $sum: 1 },
                            }
                        }
                    ],
                    // Current week stats (by delivery date)
                    currentWeek: [
                        { $match: { revenueDate: { $gte: sevenDaysAgo } } },
                        {
                            $group: {
                                _id: null,
                                sales: { $sum: sellerOrderRevenueAmount() },
                                count: { $sum: 1 },
                            }
                        }
                    ],
                    // Previous week stats
                    prevWeek: [
                        { $match: { revenueDate: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
                        {
                            $group: {
                                _id: null,
                                sales: { $sum: sellerOrderRevenueAmount() },
                                count: { $sum: 1 },
                            }
                        }
                    ],
                    // Sales trend chart data
                    salesTrend: [
                        { $match: { revenueDate: { $gte: trendStartDate } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: aggregationFormat, date: "$revenueDate" } },
                                sales: { $sum: sellerOrderRevenueAmount() },
                                profit: { $sum: sellerOrderProfitAmount() },
                                orders: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    // Insights: top cities + peak hours
                    topCities: [
                        { $group: { _id: "$address.city", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 1 }
                    ],
                    peakHours: [
                        { $project: { hour: { $hour: "$createdAt" } } },
                        { $group: { _id: "$hour", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 1 }
                    ],
                    // Top products with trends (current + prev week via sub-facet)
                    topProductsCurrent: [
                        { $match: { revenueDate: { $gte: sevenDaysAgo } } },
                        { $unwind: "$items" },
                        {
                            $group: {
                                _id: "$items.product",
                                name: { $first: "$items.name" },
                                sales: { $sum: "$items.quantity" },
                                revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                            }
                        },
                        { $sort: { sales: -1 } },
                        { $limit: 10 }
                    ],
                    topProductsPrev: [
                        { $match: { revenueDate: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
                        { $unwind: "$items" },
                        {
                            $group: {
                                _id: "$items.product",
                                sales: { $sum: "$items.quantity" }
                            }
                        }
                    ],
                    // Traffic sources & devices
                    trafficSources: [
                        { $group: { _id: "$trafficSource", value: { $sum: 1 } } },
                        { $project: { name: "$_id", value: 1, _id: 0 } }
                    ],
                    devices: [
                        { $group: { _id: "$deviceType", count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ],
                }
            }
        ]);

        // Extract facet results
        const overviewRaw = statsResult.overview[0] || { totalSales: 0, totalOrders: 0, totalCostPrice: 0, totalNetProfit: 0 };
        const totalSales = overviewRaw.totalSales;
        const totalOrders = overviewRaw.totalOrders;
        const totalCostPrice = overviewRaw.totalCostPrice || 0;
        const totalNetProfit = overviewRaw.totalNetProfit || 0;
        const avgOrderValue = totalOrders > 0 ? (totalSales / totalOrders) : 0;
        const netProfitMargin = totalSales > 0 ? Number(((totalNetProfit / totalSales) * 100).toFixed(1)) : 0;

        const currentSales = statsResult.currentWeek[0]?.sales || 0;
        const prevSalesVal = statsResult.prevWeek[0]?.sales || 0;
        const salesTrendPerc = prevSalesVal === 0 ? (currentSales > 0 ? 100 : 0) : (((currentSales - prevSalesVal) / prevSalesVal) * 100).toFixed(1);

        const currentOrdersCount = statsResult.currentWeek[0]?.count || 0;
        const prevOrdersCount = statsResult.prevWeek[0]?.count || 0;
        const ordersTrendPerc = prevOrdersCount === 0 ? (currentOrdersCount > 0 ? 100 : 0) : (((currentOrdersCount - prevOrdersCount) / prevOrdersCount) * 100).toFixed(1);

        // Format chart data
        const salesTrend = statsResult.salesTrend;
        let chartData = [];
        if (range === 'monthly') {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const dateStr = d.toISOString().slice(0, 7);
                const data = salesTrend.find(item => item._id === dateStr);
                chartData.push({
                    name: monthNames[d.getMonth()],
                    sales: data ? data.sales : 0,
                    profit: data ? data.profit : 0,
                    orders: data ? data.orders : 0,
                    traffic: 0
                });
            }
        } else if (range === 'weekly') {
            chartData = salesTrend.map((item, idx) => ({
                name: `Week ${idx + 1}`,
                sales: item.sales,
                profit: item.profit,
                orders: item.orders,
                traffic: 0
            })).slice(-4);
        } else {
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const data = salesTrend.find(item => item._id === dateStr);
                chartData.push({
                    name: dayNames[d.getDay()],
                    sales: data ? data.sales : 0,
                    profit: data ? data.profit : 0,
                    orders: data ? data.orders : 0,
                    traffic: 0
                });
            }
        }

        // Category distribution (separate pipeline — different collection)
        const categoryData = await Product.aggregate([
            { $match: { sellerId: sellerOid } },
            {
                $lookup: {
                    from: "categories",
                    localField: "categoryId",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $group: {
                    _id: "$category.name",
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    subject: "$_id",
                    A: "$count",
                    fullMark: 100
                }
            }
        ]);

        // Format insights
        const topCity = statsResult.topCities[0]?._id || "N/A";
        const peakHour = statsResult.peakHours[0]?._id;
        const peakTime = peakHour !== undefined ? `${peakHour}:00 - ${peakHour + 2}:00` : "N/A";

        // Format top products with trends
        const currentItems = statsResult.topProductsCurrent;
        const prevItems = statsResult.topProductsPrev;

        const formattedTopProducts = currentItems.map(item => {
            const prevItem = prevItems.find(p => p._id.toString() === item._id.toString());
            const currSales = item.sales;
            const pSales = prevItem ? prevItem.sales : 0;

            let trend = 0;
            if (pSales === 0) {
                trend = currSales > 0 ? 100 : 0;
            } else {
                trend = Math.round(((currSales - pSales) / pSales) * 100);
            }

            return {
                name: item.name,
                sales: currSales,
                revenue: `₹${item.revenue.toLocaleString()}`,
                trend: trend
            };
        }).slice(0, 5);

        // Format traffic sources
        const sourceColors = {
            "Direct": "#3b82f6",
            "Search": "#10b981",
            "Social": "#f59e0b",
            "Referral": "#8b5cf6"
        };

        const finalTrafficSources = (statsResult.trafficSources || []).map(s => ({
            ...s,
            color: sourceColors[s.name] || "#CBD5E1"
        }));

        if (finalTrafficSources.length === 0 && totalOrders > 0) {
            finalTrafficSources.push({ name: "Direct", value: totalOrders, color: "#3b82f6" });
        }

        const topDeviceType = statsResult.devices[0]?._id || "Mobile";
        const topDeviceCount = statsResult.devices[0]?.count || 0;
        const devicePerc = totalOrders > 0 ? Math.round((topDeviceCount / totalOrders) * 100) : 0;

        return handleResponse(res, 200, "Stats fetched successfully", {
            overview: {
                totalSales: `₹${totalSales.toLocaleString()}`,
                totalOrders: totalOrders.toLocaleString(),
                totalNetProfit: `₹${totalNetProfit.toLocaleString()}`,
                totalCostPrice: `₹${totalCostPrice.toLocaleString()}`,
                netProfitMargin: `${netProfitMargin}%`,
                avgOrderValue: `₹${Math.round(avgOrderValue).toLocaleString()}`,
                conversionRate: totalOrders > 0 ? "4.2%" : "0%",
                salesTrend: `${salesTrendPerc > 0 ? '+' : ''}${salesTrendPerc}%`,
                ordersTrend: `${ordersTrendPerc > 0 ? '+' : ''}${ordersTrendPerc}%`
            },
            salesTrend: chartData,
            categoryMix: categoryData,
            topProducts: formattedTopProducts,
            trafficSources: finalTrafficSources,
            insights: {
                topCity: topCity,
                peakTime: peakTime,
                topDevice: totalOrders > 0 ? `${devicePerc}% ${topDeviceType}` : "N/A"
            }
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET SELLER EARNINGS / TRANSACTIONS
================================ */
export const getSellerEarnings = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const sellerOid = new mongoose.Types.ObjectId(sellerId);

        await releaseExpiredHeldSellerPayouts({ sellerId });

        const transactions = await Transaction.find({ user: sellerId, userModel: 'Seller' })
            .sort({ createdAt: -1 })
            .populate("order", "orderId");

        const pendingOrderEarnings = transactions
            .filter((t) => t.type === "Order Payment" && t.status === "Pending")
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const pendingPayouts = transactions
            .filter(t => t.type === 'Withdrawal' && (t.status === 'Pending' || t.status === 'Processing'))
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);

        const wallet = await Wallet.findOne({ ownerType: 'SELLER', ownerId: sellerId });
        const availableBalance = Number(wallet?.availableBalance || 0);
        const onHoldBalance = Number(wallet?.pendingBalance || 0);
        const totalWalletBalance = availableBalance + onHoldBalance;
        const withdrawableBalance = Math.max(0, availableBalance);

        // Total revenue, cost, profit = sum of delivered order amounts only
        const [orderRevenueAgg] = await Order.aggregate([
            {
                $match: sellerDeliveredOrderMatch(sellerOid),
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: sellerOrderRevenueAmount() },
                    totalCostPrice: { $sum: sellerOrderCostAmount() },
                    totalNetProfit: { $sum: sellerOrderProfitAmount() },
                },
            },
        ]);
        const totalRevenue = Number(orderRevenueAgg?.totalRevenue || 0);
        const totalCostPrice = Number(orderRevenueAgg?.totalCostPrice || 0);
        const totalNetProfit = Number(orderRevenueAgg?.totalNetProfit || 0);
        const netProfitMargin = totalRevenue > 0 ? Number(((totalNetProfit / totalRevenue) * 100).toFixed(1)) : 0;

        const totalWithdrawn = transactions
            .filter(t => t.type === 'Withdrawal' && t.status === 'Settled')
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);

        // Monthly Revenue Aggregation (Last 6 Months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyAggregation = await Order.aggregate([
            {
                $match: {
                    ...sellerDeliveredOrderMatch(sellerOid),
                    deliveredAt: { $gte: sixMonthsAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$deliveredAt" } },
                    revenue: { $sum: sellerOrderEarningAmount() },
                    profit: { $sum: sellerOrderProfitAmount() },
                },
            },
            { $sort: { _id: 1 } }
        ]);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const dateStr = d.toISOString().slice(0, 7);
            const data = monthlyAggregation.find(m => m._id === dateStr);
            chartData.push({
                name: monthNames[d.getMonth()],
                revenue: data ? data.revenue : 0,
                profit: data ? data.profit : 0
            });
        }

        return handleResponse(res, 200, "Earnings fetched successfully", {
            balances: {
                settledBalance: totalWalletBalance,
                pendingPayouts: pendingPayouts,
                onHoldBalance,
                availableBalance: withdrawableBalance,
                pendingOrderEarnings,
                totalWalletBalance,
                totalRevenue: totalRevenue,
                totalCostPrice: totalCostPrice,
                totalNetProfit: totalNetProfit,
                netProfitMargin: netProfitMargin,
                totalWithdrawn: totalWithdrawn
            },
            monthlyChart: chartData,
            ledger: transactions.map(t => ({
                id: (t.reference || t._id).toString(),
                type: t.type,
                amount: t.amount,
                status: t.status,
                date: formatDate(t.createdAt),
                time: formatTime(t.createdAt),
                customer: t.type === 'Withdrawal' ? 'Bank Transfer' : 'Customer',
                ref: t.order ? `#${t.order.orderId}` : t.reference || t._id
            }))
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const emptyProfitBucket = () => ({
    orderCount: 0,
    sellingPrice: 0,
    purchaseCost: 0,
    commission: 0,
    deliveryEarning: 0,
    totalDeduction: 0,
    netProfit: 0,
    payout: 0,
});

function normalizeProfitBucket(raw) {
    if (!raw) return emptyProfitBucket();
    const sellingPrice = roundMoney(raw.sellingPrice);
    const purchaseCost = roundMoney(raw.purchaseCost);
    const commission = roundMoney(raw.commission);
    const deliveryEarning = roundMoney(raw.deliveryEarning);
    return {
        orderCount: Number(raw.orderCount || 0),
        sellingPrice,
        purchaseCost,
        commission,
        deliveryEarning,
        totalDeduction: roundMoney(purchaseCost + commission),
        netProfit: roundMoney(raw.netProfit),
        payout: roundMoney(raw.payout),
    };
}

function divideBucket(bucket, count) {
    if (!count) return emptyProfitBucket();
    return {
        orderCount: 1,
        sellingPrice: roundMoney(bucket.sellingPrice / count),
        purchaseCost: roundMoney(bucket.purchaseCost / count),
        commission: roundMoney(bucket.commission / count),
        deliveryEarning: roundMoney(bucket.deliveryEarning / count),
        totalDeduction: roundMoney(bucket.totalDeduction / count),
        netProfit: roundMoney(bucket.netProfit / count),
        payout: roundMoney(bucket.payout / count),
    };
}

/* ===============================
   GET SELLER PROFIT SUMMARY (per-order + day/month/year)
================================ */
export const getSellerProfitSummary = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const sellerOid = new mongoose.Types.ObjectId(sellerId);

        const seller = await Seller.findById(sellerId)
            .select("commissionModel subscription oneTimeChargePaid")
            .lean();

        const now = new Date();
        const isSubscriptionActive =
            seller?.commissionModel === "PLAN_BASED" &&
            seller?.subscription?.status === "active" &&
            seller?.subscription?.expiresAt &&
            new Date(seller.subscription.expiresAt) > now;
        const isExempt =
            isSubscriptionActive ||
            (seller?.commissionModel === "ONE_TIME" && seller?.oneTimeChargePaid);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
        const startOfYear = new Date(startOfToday.getFullYear(), 0, 1);

        const groupStage = {
            $group: {
                _id: null,
                orderCount: { $sum: 1 },
                sellingPrice: { $sum: sellerOrderSellingPriceAmount() },
                purchaseCost: { $sum: sellerOrderCostAmount() },
                commission: { $sum: sellerOrderCommissionAmount() },
                deliveryEarning: { $sum: sellerOrderDeliveryEarningAmount() },
                netProfit: { $sum: sellerOrderProfitAmount() },
                payout: { $sum: sellerOrderEarningAmount() },
            },
        };
        const dateBucket = (startDate) =>
            startDate
                ? [{ $match: { deliveredAt: { $gte: startDate } } }, groupStage]
                : [groupStage];

        const [result] = await Order.aggregate([
            { $match: sellerDeliveredOrderMatch(sellerOid) },
            {
                $facet: {
                    today: dateBucket(startOfToday),
                    thisMonth: dateBucket(startOfMonth),
                    thisYear: dateBucket(startOfYear),
                    allTime: dateBucket(null),
                    recentOrders: [
                        { $sort: { deliveredAt: -1 } },
                        { $limit: 25 },
                        {
                            $project: {
                                _id: 0,
                                orderId: 1,
                                deliveredAt: 1,
                                payoutStatus: { $ifNull: ["$settlementStatus.sellerPayout", "PENDING"] },
                                commissionExempt: sellerOrderCommissionExemptFlag(),
                                sellingPrice: sellerOrderSellingPriceAmount(),
                                purchaseCost: sellerOrderCostAmount(),
                                commission: sellerOrderCommissionAmount(),
                                deliveryEarning: sellerOrderDeliveryEarningAmount(),
                                netProfit: sellerOrderProfitAmount(),
                                payout: sellerOrderEarningAmount(),
                            },
                        },
                    ],
                },
            },
        ]);

        const allTimeBucket = normalizeProfitBucket(result?.allTime?.[0]);

        return handleResponse(res, 200, "Profit summary fetched successfully", {
            planStatus: {
                commissionModel: seller?.commissionModel || "CATEGORY_WISE",
                isExempt,
                planName: seller?.subscription?.planName || null,
                expiresAt: seller?.subscription?.expiresAt || null,
            },
            summary: {
                perOrderAvg: divideBucket(allTimeBucket, allTimeBucket.orderCount),
                today: normalizeProfitBucket(result?.today?.[0]),
                thisMonth: normalizeProfitBucket(result?.thisMonth?.[0]),
                thisYear: normalizeProfitBucket(result?.thisYear?.[0]),
                allTime: allTimeBucket,
            },
            recentOrders: (result?.recentOrders || []).map((order) => ({
                orderId: order.orderId,
                deliveredAt: order.deliveredAt,
                payoutStatus: order.payoutStatus,
                commissionExempt: order.commissionExempt,
                sellingPrice: roundMoney(order.sellingPrice),
                purchaseCost: roundMoney(order.purchaseCost),
                commission: roundMoney(order.commission),
                deliveryEarning: roundMoney(order.deliveryEarning),
                netProfit: roundMoney(order.netProfit),
                payout: roundMoney(order.payout),
            })),
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
