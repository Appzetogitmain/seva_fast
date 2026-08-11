import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import PageHeader from "@shared/components/ui/PageHeader";
import Badge from "@shared/components/ui/Badge";
import {
  DollarSign,
  Truck,
  Package,
  TrendingUp,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  Plus,
  Eye,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  HiOutlineTruck,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineBanknotes,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { formatDate } from "@shared/utils/formatDate";
import { useSellerOrders } from "../context/SellerOrdersContext";
import { getSellerOrderEarning, getSellerEarningBreakdown, getCustomerOrderBill } from "@/shared/utils/sellerOrderEarning";
import { getLegacyStatusFromOrder } from "@/shared/utils/orderStatus";
import { useLockBodyScroll, preventBackdropScroll } from "@/shared/hooks/useLockBodyScroll";

const Dashboard = () => {
  const navigate = useNavigate();
  const { orders: ordersFromContext, ordersLoading, refreshOrders } =
    useSellerOrders();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [promoStatus, setPromoStatus] = useState(null);

  useEffect(() => {
    const fetchSubStatus = async () => {
      try {
        const [subRes, promoRes] = await Promise.all([
          sellerApi.getSubscriptionStatus(),
          sellerApi.getStorePromotionStatus(),
        ]);
        if (subRes.data?.success) {
          setSubscriptionStatus(subRes.data.result);
        }
        if (promoRes.data?.success) {
          setPromoStatus(promoRes.data.result);
        }
      } catch (err) {
        console.error("Failed to fetch sub/promo status", err);
      }
    };
    fetchSubStatus();
  }, []);

  const fetchDeliveryBoys = async () => {
    try {
      const response = await sellerApi.getDeliveryPartners({ verified: 'true', status: 'online' });
      const payload = response.data.result || {};
      const list = Array.isArray(payload.items) ? payload.items : (response.data.results || []);
      setDeliveryBoys(list);
    } catch (error) {
      console.error("Failed to fetch delivery partners:", error);
    }
  };

  useEffect(() => {
    fetchDeliveryBoys();
  }, []);

  useLockBodyScroll(isOrderModalOpen);

  const fetchStats = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const statsRes = await sellerApi.getStats();
      if (statsRes.data.success) setStatsData(statsRes.data.result);
    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(true);
  }, [fetchStats]);

  useEffect(() => {
    if (!ordersLoading) {
      fetchStats(false);
    }
  }, [ordersLoading, ordersFromContext?.length, fetchStats]);

  const safeOrders = Array.isArray(ordersFromContext) ? ordersFromContext : [];
  const loadingOrStats = loading || ordersLoading;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const revenueChartData = React.useMemo(() => {
    const raw = statsData?.salesTrend ?? statsData?.chartData ?? [];
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length > 0) {
      return arr.map((d) => ({
        name: d.name ?? d.date ?? "—",
        sales: Number(d.sales ?? d.revenue ?? d.total ?? 0) || 0,
      }));
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { name: dayNames[d.getDay()], sales: 0 };
    });
  }, [statsData?.salesTrend, statsData?.chartData]);
  const revenueMax = Math.max(1, ...revenueChartData.map((d) => d.sales));

  const stats = [
    {
      label: "Total Revenue",
      value: statsData?.overview?.totalSales || "₹0",
      change: "+12.5%",
      changeType: "increase",
      icon: DollarSign,
      iconBg: "bg-brand-50",
      iconColor: "text-brand-600",
      description: "vs last month",
      path: "/seller/transactions",
    },
    {
      label: "Total Orders",
      value: statsData?.overview?.totalOrders || "0",
      change: "+8.2%",
      changeType: "increase",
      icon: ShoppingBag,
      iconBg: "bg-brand-50",
      iconColor: "text-brand-600",
      description: "vs last month",
      path: "/seller/orders",
    },
    {
      label: "Avg Order Value",
      value: statsData?.overview?.avgOrderValue || "₹0",
      change: "+2",
      changeType: "increase",
      icon: Package,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      description: "per order",
      path: "/seller/orders",
    },
    {
      label: "Pending Orders",
      value: safeOrders.filter(o => o.status === 'pending').length.toString(),
      change: "-3",
      changeType: "decrease",
      icon: Clock,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      description: "needs attention",
      path: "/seller/orders",
    },
  ];

  const quickActions = [
    {
      title: "Add New Product",
      description: "List a new item in your store",
      icon: Plus,
      path: "/seller/products/add",
      variant: "primary", // dark bg, white text
    },
    {
      title: "Process Orders",
      description: "View and manage pending orders",
      icon: Truck,
      path: "/seller/orders",
      variant: "outline", // white bg, border, primary accent
    },
    {
      title: "View Earnings",
      description: "Check your revenue and payouts",
      icon: DollarSign,
      path: "/seller/earnings",
      variant: "outline-emerald", // white bg, border, emerald accent
    },
  ];

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "pending":
        return "warning";
      case "processing":
      case "confirmed":
        return "info";
      case "packed":
        return "primary";
      case "shipped":
      case "out_for_delivery":
        return "secondary";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "secondary";
    }
  };

  const normalizeOrderForModal = (order) => {
    if (!order) return null;
    const addr = order.address;
    const addressStr = [
      addr?.line1,
      addr?.line2,
      addr?.city,
      addr?.state,
      addr?.pincode,
    ]
      .filter(Boolean)
      .join(", ");
    const items = (order.items || []).map((item) => ({
      name: item.name || item.productName || "Item",
      price:
        item.price ??
        (item.quantity
          ? Number(item.totalPrice ?? 0) / Number(item.quantity)
          : 0),
      qty: item.quantity ?? 1,
      image: item.image || "",
    }));
    return {
      id: order.orderId,
      customer: {
        name: order.customer?.name || "Customer",
        phone: order.customer?.phone || "",
      },
      address: addressStr || "—",
      items,
      total: getSellerOrderEarning(order),
      sellerEarning: getSellerOrderEarning(order),
      sellerEarningBreakdown: order.sellerEarningBreakdown || null,
      customerBill: order.customerBill || null,
      status: getLegacyStatusFromOrder(order),
      workflowStatus: order.workflowStatus,
      payment:
        order.payment?.method === "cash" || order.payment?.method === "cod"
          ? "Cash on Delivery"
          : "Online Paid",
      deliveryBoy: order.deliveryBoy || null,
    };
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    const normalizedStatus = String(newStatus || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_");
    const mappedStatus =
      normalizedStatus === "processing" || normalizedStatus === "process"
        ? "confirmed"
        : normalizedStatus;

    try {
      await sellerApi.updateOrderStatus(orderId, {
        status: mappedStatus,
      });
      toast.success(`Order status updated to ${mappedStatus.replace(/_/g, " ")}`);
      setSelectedOrder((prev) =>
        prev && prev.id === orderId ? { ...prev, status: mappedStatus } : prev
      );
      if (typeof refreshOrders === "function") refreshOrders();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(error?.response?.data?.message || "Failed to update status");
    }
  };

  const handleAssignDeliveryBoy = async (orderId, deliveryBoyId) => {
    const status = String(selectedOrder?.status || "").toLowerCase();
    if (status !== "packed" && status !== "out_for_delivery") {
      toast.error("Mark order as Packed before assigning a delivery partner");
      return;
    }
    try {
      await sellerApi.updateOrderStatus(orderId, { deliveryBoyId });
      toast.success("Delivery partner assigned successfully");
      if (typeof refreshOrders === "function") refreshOrders();

      // Update the selectedOrder details view dynamically
      if (selectedOrder && selectedOrder.id === orderId) {
        const assignedBoy = deliveryBoys.find(b => b._id === deliveryBoyId || b.id === deliveryBoyId);
        setSelectedOrder({
          ...selectedOrder,
          deliveryBoy: assignedBoy ? { _id: assignedBoy._id, name: assignedBoy.name, phone: assignedBoy.phone } : null
        });
      }
    } catch (error) {
      console.error("Failed to assign delivery partner:", error);
      const errMsg = error?.response?.data?.message || "Failed to assign delivery partner";
      toast.error(errMsg);
    }
  };

  if (loadingOrStats) {
    return <div className="flex items-center justify-center h-screen font-bold text-slate-600">Updating Dashboard...</div>;
  }

  return (
    <div className="ds-section-spacing relative">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your store today."
      />

      {/* 0% Commission Promotional Banner for Commission-Based Sellers */}
      {subscriptionStatus && (subscriptionStatus.status !== "active" || subscriptionStatus.commissionModel !== "PLAN_BASED") && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl shadow-xl border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden my-4"
        >
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
              <Sparkles size={22} className="text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black tracking-widest uppercase border border-emerald-500/30">
                  SPECIAL OFFER
                </span>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  Want 0% Order Commission?
                </h4>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Switch to a 0% Seller Pass &amp; keep 100% of your earnings! Zero hidden cuts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/seller/plans')}
            className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all shrink-0 cursor-pointer whitespace-nowrap z-10"
          >
            <Sparkles size={15} className="text-slate-950" />
            <span>Browse 0% Plans</span>
            <ArrowRight size={14} className="text-slate-950" />
          </button>
        </motion.div>
      )}

      {/* 🚀 Boost Your Store Banner (Only if seller has no active/pending promotion) */}
      {!promoStatus?.hasActivePromotion && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 via-purple-950 to-slate-900 text-white rounded-2xl shadow-xl border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden my-4"
        >
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="h-11 w-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 shadow-inner">
              <TrendingUp size={22} className="text-indigo-400 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[9px] font-black tracking-widest uppercase border border-indigo-500/30">
                  PROMOTION &amp; ADS
                </span>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  🚀 Boost Your Store Visibility &amp; Sales!
                </h4>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Get featured placement, top search rankings, and multi-fold customer reach.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/seller/promotions')}
            className="w-full sm:w-auto px-5 py-3 bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-white font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all shrink-0 cursor-pointer whitespace-nowrap z-10"
          >
            <span>🚀 Boost Your Store</span>
            <ArrowRight size={14} className="text-white" />
          </button>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => stat.path && navigate(stat.path)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-slate-600">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "text-xs font-semibold flex items-center gap-1",
                      stat.changeType === "increase" ? "text-brand-600" : "text-red-600"
                    )}
                  >
                    <TrendingUp className={cn("h-3 w-3", stat.changeType === "decrease" && "rotate-180")} />
                    {stat.change}
                  </span>
                  <span className="text-sm text-slate-600">{stat.description}</span>
                </div>
              </div>
              <div className={cn("p-3 rounded-lg", stat.iconBg)}>
                <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickActions.map((action) => {
          const isPrimary = action.variant === "primary";
          const isEmerald = action.variant === "outline-emerald";
          return (
            <button
              key={action.title}
              onClick={() => navigate(action.path)}
              className={cn(
                "p-6 rounded-xl text-left transition-all duration-200 shadow-sm hover:shadow-md border-2",
                isPrimary && "bg-primary border-primary text-white hover:bg-primary/90 hover:border-primary/90",
                action.variant === "outline" && "bg-white border-slate-200 text-slate-900 hover:border-primary hover:bg-primary/5",
                isEmerald && "bg-white border-slate-200 text-slate-900 hover:border-brand-500 hover:bg-brand-50"
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-lg",
                  isPrimary ? "bg-white/20" : isEmerald ? "bg-brand-50" : "bg-slate-100"
                )}>
                  <action.icon className={cn(
                    "h-5 w-5",
                    isPrimary ? "text-white" : isEmerald ? "text-brand-600" : "text-slate-700"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-semibold text-sm",
                    isPrimary ? "text-white" : "text-slate-900"
                  )}>
                    {action.title}
                  </h3>
                  <p className={cn(
                    "text-xs mt-1",
                    isPrimary ? "text-white/90" : "text-slate-600"
                  )}>
                    {action.description}
                  </p>
                </div>
                <ArrowUpRight className={cn(
                  "h-4 w-4 shrink-0",
                  isPrimary ? "text-white/70" : "text-slate-600"
                )} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card title="Revenue Overview" subtitle="Last 7 days performance" className="lg:col-span-2">
          <div className="h-[300px] min-h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => `₹${Number(value).toLocaleString()}`}
                  domain={[0, revenueMax]}
                  allowDataOverflow
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                  }}
                  formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Revenue"]}
                  labelFormatter={(label) => `Day: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Product Performance */}
        <Card title="Top Categories" subtitle="Sales by category">
          <div className="h-[300px] min-h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsData?.categoryMix || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="subject"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                  }}
                />
                <Bar dataKey="A" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card
        title="Recent Orders"
        subtitle="Latest transactions from your store"
        actions={
          <button
            onClick={() => navigate("/seller/orders")}
            className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1"
          >
            View All
            <ArrowUpRight className="h-4 w-4" />
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Your Earning
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {safeOrders.slice(0, 5).map((order) => (
                <tr key={order.orderId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm font-semibold text-slate-900">{order.orderId}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                        {order.customer?.name?.split(" ").map(n => n[0]).join("") || "C"}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{order.customer?.name || "Customer"}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm text-slate-600">{formatDate(order.createdAt)}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm font-semibold text-slate-900">₹{getSellerOrderEarning(order).toLocaleString('en-IN')}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <Badge variant={getStatusColor(order.status)} className="capitalize">
                      {order.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-center align-middle">
                    <button
                      onClick={() => {
                        setSelectedOrder(normalizeOrderForModal(order));
                        setIsOrderModalOpen(true);
                      }}
                      className="text-slate-600 hover:text-primary transition-colors p-1"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {createPortal(
        <AnimatePresence>
          {isOrderModalOpen && selectedOrder && (
            <div className="fixed inset-0 z-[250] flex items-stretch sm:items-center justify-center p-3 sm:p-6 lg:p-12 overflow-hidden overscroll-none">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
                onClick={() => setIsOrderModalOpen(false)}
                onWheel={preventBackdropScroll}
                onTouchMove={preventBackdropScroll}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-lg sm:max-w-2xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Modal Header - same as Orders */}
                <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                      <HiOutlineTruck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Order Details
                      </h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <Badge
                          variant={getStatusColor(selectedOrder.status)}
                          className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0"
                        >
                          {selectedOrder.status}
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                          #{selectedOrder.id}
                        </span>
                      </div>
                    </div>
                    {["packed", "out_for_delivery", "delivered"].includes(
                      String(selectedOrder.status || "").toLowerCase(),
                    ) ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <HiOutlineMapPin className="h-3 w-3 text-primary" />{" "}
                            Delivery Address
                          </h4>
                          <p className="text-xs font-bold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                            {selectedOrder.address}
                          </p>
                        </div>
                        <div>
                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <HiOutlinePhone className="h-3 w-3 text-brand-500" />{" "}
                          Contact Info
                        </h4>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                          <p className="text-xs font-bold text-slate-800">
                            {selectedOrder.customer.name}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                            {selectedOrder.customer.phone}
                          </p>
                        </div>
                      </div>
                      {selectedOrder.status.toLowerCase() !== 'pending' && selectedOrder.status.toLowerCase() !== 'cancelled' && (
                        <div>
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <HiOutlineTruck className="h-3 w-3 text-primary" /> Delivery Partner
                          </h4>
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                            {selectedOrder.deliveryBoy ? (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-xs font-bold text-slate-800">{selectedOrder.deliveryBoy.name}</p>
                                    <p className="text-[11px] font-semibold text-slate-600">{selectedOrder.deliveryBoy.phone}</p>
                                  </div>
                                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Assigned</span>
                                </div>
                                <div className="h-px bg-slate-200 my-1" />
                                <div className="relative">
                                  <select
                                    value={selectedOrder.deliveryBoy._id || selectedOrder.deliveryBoy.id || ''}
                                    onChange={(e) => handleAssignDeliveryBoy(selectedOrder.id, e.target.value)}
                                    className="w-full text-xs pl-3 pr-8 py-2 bg-white rounded-xl border border-slate-200 appearance-none cursor-pointer focus:ring-2 focus:ring-brand-200 outline-none shadow-sm font-semibold text-slate-800"
                                  >
                                    <option value="">Change Rider...</option>
                                    {deliveryBoys.map(boy => (
                                      <option key={boy._id} value={boy._id}>{boy.name} ({boy.phone})</option>
                                    ))}
                                  </select>
                                  <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
                                </div>
                              </div>
                            ) : (
                              <div className="relative">
                                <select
                                  value=""
                                  onChange={(e) => handleAssignDeliveryBoy(selectedOrder.id, e.target.value)}
                                  className="w-full text-xs pl-3 pr-8 py-2 bg-white rounded-xl border border-slate-200 appearance-none cursor-pointer focus:ring-2 focus:ring-brand-200 outline-none shadow-sm font-semibold text-slate-800"
                                >
                                  <option value="">Assign Rider...</option>
                                  {deliveryBoys.map(boy => (
                                    <option key={boy._id} value={boy._id}>{boy.name} ({boy.phone})</option>
                                  ))}
                                </select>
                                <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                    <div className="space-y-3 sm:space-y-4">
                      <div className="bg-slate-50 p-3 sm:p-4 rounded-3xl border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                          Order Amount (Customer)
                        </h4>
                        <p className="text-lg font-black text-slate-900">
                          ₹{getCustomerOrderBill(selectedOrder).grandTotal.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-primary/5 p-3 sm:p-4 rounded-3xl border border-primary/10">
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">
                          Your Earning
                        </h4>
                        <div className="space-y-2">
                          {(() => {
                            const { productEarning, deliveryShare, total } =
                              getSellerEarningBreakdown(selectedOrder);
                            return (
                              <>
                                <div className="flex justify-between text-xs">
                                  <span className="font-bold text-slate-600">Product</span>
                                  <span className="font-black text-slate-900">
                                    ₹{productEarning.toFixed(2)}
                                  </span>
                                </div>
                                {deliveryShare > 0 ? (
                                  <div className="flex justify-between text-xs">
                                    <span className="font-bold text-slate-600">
                                      Delivery (80%)
                                    </span>
                                    <span className="font-black text-brand-600">
                                      ₹{deliveryShare.toFixed(2)}
                                    </span>
                                  </div>
                                ) : null}
                                <div className="h-px bg-primary/10 my-2" />
                                <div className="flex justify-between text-sm">
                                  <span className="font-black text-slate-900">
                                    Your Earning
                                  </span>
                                  <span className="font-black text-primary">
                                    ₹{total.toFixed(2)}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-3 sm:p-4 rounded-3xl text-white shadow-xl shadow-slate-900/10">
                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                          Payment Status
                        </h4>
                        <div className="flex items-center gap-2">
                          <HiOutlineBanknotes className="h-5 w-5 text-brand-400" />
                          <span className="text-xs font-bold tracking-tight">
                            {selectedOrder.payment}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 sm:mb-4">
                    Items Ordered ({selectedOrder.items.length})
                  </h4>
                  <div className="space-y-3 max-h-52 sm:max-h-64 overflow-y-auto pr-1">
                    {selectedOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white ring-1 ring-slate-100 rounded-2xl group hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-slate-600 text-xs font-bold">
                                —
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-600 mt-0.5">
                              ₹{Number(item.price).toFixed(2)} × {item.qty}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-900">
                            ₹{(item.price * item.qty).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer - same as Orders */}
                <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center justify-end">
                  <div className="flex gap-2 items-center w-full justify-between sm:justify-end">
                    <button
                      onClick={() => setIsOrderModalOpen(false)}
                      className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                    >
                      CLOSE
                    </button>
                    {selectedOrder.status.toLowerCase() === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusUpdate(selectedOrder.id, 'cancelled')}
                          className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-700 hover:bg-rose-200 transition-all"
                        >
                          Reject Order
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(selectedOrder.id, 'confirmed')}
                          className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-brand-100 text-brand-700 hover:bg-brand-200 transition-all"
                        >
                          Accept Order
                        </button>
                      </div>
                    ) : (
                      <div className="relative inline-block w-40">
                        <select
                          value={selectedOrder.status.toLowerCase()}
                          onChange={(e) =>
                            handleStatusUpdate(selectedOrder.id, e.target.value)
                          }
                          className={cn(
                            "w-full text-xs pl-3 pr-8 py-2 rounded-xl font-black uppercase tracking-wider border appearance-none cursor-pointer focus:ring-2 focus:ring-offset-1 transition-all outline-none shadow-sm",
                            getStatusColor(selectedOrder.status) === "warning"
                              ? "bg-amber-100 text-amber-700 focus:ring-amber-200"
                              : getStatusColor(selectedOrder.status) === "info"
                                ? "bg-brand-100 text-brand-700 focus:ring-brand-200"
                                : getStatusColor(selectedOrder.status) === "primary"
                                  ? "bg-brand-100 text-brand-700 focus:ring-brand-200"
                                  : getStatusColor(selectedOrder.status) ===
                                    "secondary"
                                    ? "bg-purple-100 text-purple-700 focus:ring-purple-200"
                                    : getStatusColor(selectedOrder.status) ===
                                      "success"
                                      ? "bg-brand-100 text-brand-700 focus:ring-brand-200"
                                      : getStatusColor(selectedOrder.status) ===
                                        "error"
                                        ? "bg-rose-100 text-rose-700 focus:ring-rose-200"
                                        : "bg-slate-100 text-slate-700 focus:ring-slate-200"
                          )}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="packed">Packed</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    )}
                    {String(selectedOrder.status || "").toLowerCase() === "confirmed" && (
                      <div>
                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <HiOutlineTruck className="h-3 w-3 text-primary" /> Delivery Partner
                        </h4>
                        <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 shadow-sm">
                          <p className="text-[11px] text-amber-700 font-semibold">
                            Mark order as <span className="font-black">Packed</span> to assign a delivery partner.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
