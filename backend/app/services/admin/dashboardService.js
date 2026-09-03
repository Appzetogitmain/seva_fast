import User from "../../models/customer.js";
import Seller from "../../models/seller.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import { formatDate, formatDateTime } from "../../utils/formatDate.js";

const DASHBOARD_CATEGORY_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444"];

const ANALYTICS_RANGES = {
  "24h": { bucket: "hour", count: 24 },
  "7d": { bucket: "day", count: 7 },
  "30d": { bucket: "day", count: 30 },
  "90d": { bucket: "day", count: 90 },
};

function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatTrend(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

/**
 * Real revenue/order analytics for the admin "Business Intel" panel.
 * Mirrors getAdminDashboardStats' definitions so the two pages never disagree:
 * "revenue" = sum of pricing.total for delivered orders (gross order value,
 * not seller payout / platform commission), "orders" = all orders placed in
 * the window regardless of status, "active sellers" = verified sellers.
 */
export async function getAdminAnalyticsOverview({ range = "7d", assignedZones } = {}) {
  const config = ANALYTICS_RANGES[range] || ANALYTICS_RANGES["7d"];
  const hasZones = Array.isArray(assignedZones) && assignedZones.length > 0;
  const zoneFilter = hasZones ? { zoneId: { $in: assignedZones } } : {};

  const now = new Date();
  const msPerBucket = config.bucket === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const rangeStart = new Date(now.getTime() - config.count * msPerBucket);
  const prevRangeStart = new Date(rangeStart.getTime() - config.count * msPerBucket);

  const [currentOrders, previousOrders, activeSellers, prevActiveSellers] = await Promise.all([
    Order.find({ ...zoneFilter, createdAt: { $gte: rangeStart } })
      .select("pricing.total status createdAt")
      .lean(),
    Order.find({ ...zoneFilter, createdAt: { $gte: prevRangeStart, $lt: rangeStart } })
      .select("pricing.total status createdAt")
      .lean(),
    Seller.countDocuments({ ...zoneFilter, isVerified: true }),
    Seller.countDocuments({ ...zoneFilter, isVerified: true, createdAt: { $lt: rangeStart } }),
  ]);

  const sumDeliveredRevenue = (orders) =>
    orders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + (o.pricing?.total || 0), 0);
  const countDeliveredOrders = (orders) => orders.filter((o) => o.status === "delivered").length;

  const grossRevenue = sumDeliveredRevenue(currentOrders);
  const prevGrossRevenue = sumDeliveredRevenue(previousOrders);
  const totalOrders = currentOrders.length;
  const prevTotalOrders = previousOrders.length;
  const deliveredCount = countDeliveredOrders(currentOrders);
  const avgOrderValue = deliveredCount > 0 ? grossRevenue / deliveredCount : 0;
  const prevDeliveredCount = countDeliveredOrders(previousOrders);
  const prevAvgOrderValue = prevDeliveredCount > 0 ? prevGrossRevenue / prevDeliveredCount : 0;

  // Bucket delivered revenue + order counts across the window for the trend chart.
  const buckets = [];
  for (let i = config.count - 1; i >= 0; i--) {
    const bucketEnd = new Date(now.getTime() - i * msPerBucket);
    const bucketStart = new Date(bucketEnd.getTime() - msPerBucket);
    const label =
      config.bucket === "hour"
        ? `${String(bucketEnd.getHours()).padStart(2, "0")}:00`
        : bucketEnd.toLocaleDateString("en-US", { weekday: config.count <= 7 ? "short" : undefined, day: config.count > 7 ? "2-digit" : undefined, month: config.count > 7 ? "short" : undefined });
    buckets.push({ start: bucketStart, end: bucketEnd, name: label, revenue: 0, orders: 0 });
  }

  for (const order of currentOrders) {
    const createdAt = new Date(order.createdAt);
    const bucket = buckets.find((b) => createdAt >= b.start && createdAt < b.end) || buckets[buckets.length - 1];
    bucket.orders += 1;
    if (order.status === "delivered") {
      bucket.revenue += order.pricing?.total || 0;
    }
  }

  return {
    goals: {
      grossRevenue,
      grossRevenueTrend: formatTrend(pctChange(grossRevenue, prevGrossRevenue)),
      totalOrders,
      totalOrdersTrend: formatTrend(pctChange(totalOrders, prevTotalOrders)),
      activeSellers,
      activeSellersTrend: `${activeSellers - prevActiveSellers >= 0 ? "+" : ""}${activeSellers - prevActiveSellers}`,
      avgOrderValue,
      avgOrderValueTrend: formatTrend(pctChange(avgOrderValue, prevAvgOrderValue)),
    },
    salesData: buckets.map((b) => ({ name: b.name, revenue: Math.round(b.revenue), orders: b.orders })),
  };
}

export async function getAdminDashboardStats(assignedZones) {
  const hasZones = Array.isArray(assignedZones) && assignedZones.length > 0;

  const activeSellerQuery = hasZones ? { isVerified: true, zoneId: { $in: assignedZones } } : { isVerified: true };
  const orderQuery = hasZones ? { zoneId: { $in: assignedZones } } : {};

  let sellerIds = [];
  if (hasZones) {
    const sellersInZones = await Seller.find({ zoneId: { $in: assignedZones } }).select("_id").lean();
    sellerIds = sellersInZones.map(s => s._id);
  }

  const [totalCustomers, totalOrders] = await Promise.all([
    User.countDocuments({ role: { $in: ["user", "customer"] } }),
    Order.countDocuments(orderQuery),
  ]);
  const activeSellers = await Seller.countDocuments(activeSellerQuery);

  const revenueMatch = hasZones 
    ? { status: "delivered", zoneId: { $in: assignedZones } } 
    : { status: "delivered" };

  const revenueData = await Order.aggregate([
    { $match: revenueMatch },
    { $group: { _id: null, total: { $sum: "$pricing.total" } } },
  ]);
  const totalRevenue = revenueData[0]?.total || 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const historyMatch = hasZones
    ? { createdAt: { $gte: thirtyDaysAgo }, status: "delivered", zoneId: { $in: assignedZones } }
    : { createdAt: { $gte: thirtyDaysAgo }, status: "delivered" };

  const historyAggregation = await Order.aggregate([
    { $match: historyMatch },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        revenue: { $sum: "$pricing.total" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Create a map of existing revenue data
  const revenueMap = new Map(historyAggregation.map(item => [item._id, item.revenue]));
  
  // Fill in the last 30 days with 0 where no data exists
  const revenueHistory = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    revenueHistory.push({
      name: formatDate(d),
      revenue: revenueMap.get(dateStr) || 0,
      fullDate: dateStr
    });
  }

  const recentOrders = await Order.find(orderQuery)
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("customer", "name");

  const productMatchPipeline = hasZones 
    ? [{ $match: { sellerId: { $in: sellerIds } } }] 
    : [];

  const categoryData = await Product.aggregate([
    ...productMatchPipeline,
    { $group: { _id: "$headerId", count: { $sum: 1 } } },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    { $project: { name: "$category.name", value: "$count" } },
    { $limit: 4 },
  ]);

  const topProductsMatch = hasZones
    ? [{ $match: { zoneId: { $in: assignedZones } } }]
    : [];

  const topProducts = await Order.aggregate([
    ...topProductsMatch,
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        sales: { $sum: "$items.quantity" },
        revenue: {
          $sum: { $multiply: ["$items.quantity", "$items.price"] },
        },
      },
    },
    { $sort: { sales: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        name: "$product.name",
        sales: 1,
        rev: "$revenue",
        image: "$product.mainImage",
      },
    },
  ]);

  return {
    overview: {
      totalUsers: totalCustomers,
      activeSellers,
      totalOrders,
      totalRevenue,
    },
    revenueHistory,
    recentOrders: recentOrders.map((order) => ({
      id: order.orderId,
      customer: order.customer?.name || "Guest",
      statusText: order.status,
      status:
        order.status === "delivered"
          ? "success"
          : order.status === "cancelled"
            ? "error"
            : "warning",
      amount: `\u20B9${order.pricing.total}`,
      createdAt: order.createdAt,
      time: formatDateTime(order.createdAt),
    })),
    categoryData: categoryData.map((category, index) => ({
      ...category,
      color: DASHBOARD_CATEGORY_COLORS[index % DASHBOARD_CATEGORY_COLORS.length],
    })),
    topProducts: topProducts.map((product) => ({
      name: product.name,
      sales: product.sales,
      rev: `\u20B9${product.rev.toFixed(2)}`,
      trend: "+5%",
      cat: "Product",
      image: product.image,
      icon: "\u{1F4E6}", // Fallback package icon
      color: "bg-blue-50 text-blue-600",
    })),
  };
}
