import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Pagination from "@shared/components/ui/Pagination";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineCalendarDays,
  HiOutlineArrowTrendingUp,
  HiOutlineMapPin,
  HiOutlineXMark,
  HiOutlineEye,
  HiOutlineClock,
  HiOutlineArrowPath,
  HiOutlineDocumentText,
  HiOutlineCloudArrowUp,
  HiOutlineArrowTopRightOnSquare,
} from "react-icons/hi2";
import { Store, Sparkles, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { adminApi } from "../services/adminApi";
import { formatDate, formatTime } from "@shared/utils/formatDate";
import { useLockBodyScroll } from "@/shared/hooks/useLockBodyScroll";

const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Shop name A-Z" },
  { value: "name_desc", label: "Shop name Z-A" },
  { value: "revenue_desc", label: "Highest revenue" },
  { value: "orders_desc", label: "Most orders" },
  { value: "products_desc", label: "Most products" },
];

const currency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const statClass = {
  blue: "bg-brand-50 text-brand-600",
  emerald: "bg-brand-50 text-brand-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
};

const emptyStats = {
  totalActiveSellers: 0,
  totalOrders: 0,
  totalRevenue: 0,
  newThisMonth: 0,
  highVolume: 0,
  averageRevenuePerSeller: 0,
  averageOrdersPerSeller: 0,
};

const normalizeSeller = (seller) => {
  const joinedAt = seller.joinedAt || seller.createdAt || null;

  return {
    ...seller,
    totalOrders: safeNumber(seller.totalOrders),
    deliveredOrders: safeNumber(seller.deliveredOrders),
    pendingOrders: safeNumber(seller.pendingOrders),
    totalRevenue: safeNumber(seller.totalRevenue),
    productCount: safeNumber(seller.productCount),
    avgOrderValue: safeNumber(seller.avgOrderValue),
    fulfillmentRate: safeNumber(seller.fulfillmentRate),
    serviceRadius: safeNumber(seller.serviceRadius) || 5,
    joinedDate: joinedAt ? formatDate(joinedAt) : "N/A",
    lastOrderLabel: seller.lastOrderAt
      ? formatDate(seller.lastOrderAt)
      : "No orders yet",
    location: seller.location || "Location not set",
    avatar:
      seller.avatar ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        seller.shopName || seller.ownerName || seller.email || "seller",
      )}`,
  };
};

const ActiveSellers = () => {
  const requestSeq = useRef(0);

  const [sellers, setSellers] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all"); // 'all', 'subscription', 'commission'
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [isUploadingKyc, setIsUploadingKyc] = useState(false);

  const handleKycFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSeller) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF document only.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size exceeds 2 MB limit. Please select a smaller PDF document.');
      return;
    }
    const formData = new FormData();
    formData.append('kycDocument', file);

    setIsUploadingKyc(true);
    try {
      const res = await adminApi.uploadSellerKycDocument(selectedSeller.id || selectedSeller._id, formData);
      const updated = res.data?.result || res.data;
      setSelectedSeller((prev) => ({
        ...prev,
        officialKycDocumentUrl: updated.officialKycDocumentUrl || updated.officialKycDocumentUrl,
        kycUploadedAt: updated.kycUploadedAt
      }));
      toast.success('Official KYC Document PDF uploaded successfully! Seller notified.');
      setRefreshTick((t) => t + 1);
    } catch (err) {
      console.error('Failed to upload KYC document', err);
      toast.error(err.response?.data?.message || 'Failed to upload KYC document');
    } finally {
      setIsUploadingKyc(false);
    }
  };
  const [headerCategories, setHeaderCategories] = useState([]);

  useEffect(() => {
    const loadHeaders = async () => {
      try {
        const response = await adminApi.getCategories({ type: 'header' });
        const categories = response.data?.results || response.data?.result || response.data?.items || [];
        setHeaderCategories(Array.isArray(categories) ? categories : []);
      } catch (err) {
        console.error("Failed to load header categories", err);
      }
    };
    loadHeaders();
  }, []);

  useLockBodyScroll(!!selectedSeller);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, sortBy, pageSize]);

  useEffect(() => {
    const currentSeq = ++requestSeq.current;

    const loadSellers = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await adminApi.getActiveSellers({
          q: debouncedSearch || undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          joinedFrom: dateFrom || undefined,
          joinedTo: dateTo || undefined,
          sort: sortBy,
          page,
          limit: pageSize,
        });

        if (currentSeq !== requestSeq.current) return;

        const payload = response.data?.result || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        const normalizedItems = items.map(normalizeSeller);

        setSellers(normalizedItems);
        setStats({
          ...emptyStats,
          ...payload.stats,
        });
        setCategories(
          Array.isArray(payload.filters?.categories) ? payload.filters.categories : [],
        );
        setTotal(safeNumber(payload.total) || safeNumber(payload.count) || normalizedItems.length);
        setTotalPages(
            safeNumber(payload.totalPages) ||
            Math.ceil((safeNumber(payload.total) || safeNumber(payload.count) || normalizedItems.length) / pageSize) ||
            1
        );
        setLastSyncAt(new Date());

        if (safeNumber(payload.totalPages) > 0 && page > payload.totalPages) {
          setPage(payload.totalPages);
        }
      } catch (err) {
        if (currentSeq !== requestSeq.current) return;
        console.error("Failed to load active sellers", err);
        const message =
          err.response?.data?.message || "Failed to load active sellers";
        setError(message);
        toast.error(message);
      } finally {
        if (currentSeq === requestSeq.current) {
          setLoading(false);
        }
      }
    };

    loadSellers();
  }, [debouncedSearch, categoryFilter, dateFrom, dateTo, sortBy, page, pageSize, refreshTick]);

  const displayedSellers = useMemo(() => {
    if (modelFilter === "subscription") {
      return sellers.filter(
        (s) =>
          s.commissionModel === "PLAN_BASED" &&
          s.subscription?.expiresAt &&
          new Date(s.subscription.expiresAt) > new Date(),
      );
    }
    if (modelFilter === "commission") {
      return sellers.filter(
        (s) =>
          s.commissionModel !== "PLAN_BASED" ||
          !s.subscription?.expiresAt ||
          new Date(s.subscription.expiresAt) <= new Date(),
      );
    }
    return sellers;
  }, [sellers, modelFilter]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Active Sellers",
        value: stats.totalActiveSellers.toLocaleString("en-IN"),
        icon: Store,
        color: "blue",
        note: "Verified and live",
      },
      {
        label: "Gross Revenue",
        value: currency(stats.totalRevenue),
        icon: HiOutlineArrowTrendingUp,
        color: "emerald",
        note: "Delivered order value",
      },
      {
        label: "Total Orders",
        value: stats.totalOrders.toLocaleString("en-IN"),
        icon: HiOutlineDocumentText,
        color: "amber",
        note: "Lifetime order volume",
      },
      {
        label: "New This Month",
        value: stats.newThisMonth.toLocaleString("en-IN"),
        icon: HiOutlineCalendarDays,
        color: "rose",
        note: "Recently approved",
      },
    ],
    [stats],
  );

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="ds-h1 flex items-center gap-2">
            Active Sellers
            <Badge
              variant="success"
              className="admin-tiny px-1.5 py-0 font-bold uppercase tracking-wider"
            >
              Live
            </Badge>
          </h1>
          <p className="ds-description mt-0.5">
            Review every verified seller, their performance, and current store health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl ring-1 ring-slate-100">
            <HiOutlineClock className="h-4 w-4 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              {lastSyncAt
                ? `Synced ${formatTime(lastSyncAt)}`
                : "Sync pending"}
            </span>
          </div>
          <button
            onClick={() => setRefreshTick((value) => value + 1)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xl hover:bg-slate-800 transition-all"
          >
            <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-none shadow-sm ring-1 ring-slate-100 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="ds-label">{card.label}</p>
                <h4 className="ds-stat-medium mt-1">{card.value}</h4>
                <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">
                  {card.note}
                </p>
              </div>
              <div
                className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center",
                  statClass[card.color],
                )}
              >
                <card.icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 p-4 bg-white/80 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by store name, owner, email, phone or location..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold outline-none ring-1 ring-transparent focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="px-4 py-3 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={modelFilter}
              onChange={(event) => setModelFilter(event.target.value)}
              className="px-4 py-3 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Charging Models</option>
              <option value="subscription">Subscription Based (0% Comm)</option>
              <option value="commission">Commission Based (%)</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="px-4 py-3 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-3 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none w-full sm:w-auto"
                title="Joined From"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-3 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none w-full sm:w-auto"
                title="Joined To"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="ds-table-header-cell px-6">Store Entity</th>
                <th className="ds-table-header-cell px-6">Performance</th>
                <th className="ds-table-header-cell px-6">Business Intel</th>
                <th className="ds-table-header-cell px-6">Status</th>
                <th className="ds-table-header-cell px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <HiOutlineArrowPath className="h-8 w-8 text-slate-300 animate-spin" />
                      <p className="text-slate-500 font-bold text-sm">
                        Loading active sellers...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-rose-50 flex items-center justify-center">
                        <HiOutlineXMark className="h-8 w-8 text-rose-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">{error}</p>
                      <button
                        onClick={() => setRefreshTick((value) => value + 1)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : displayedSellers.length > 0 ? (
                displayedSellers.map((seller) => (
                  <tr key={seller.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-slate-100 ring-2 ring-slate-100 flex items-center justify-center">
                          <img
                            src={seller.avatar}
                            alt={seller.shopName}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">
                              {seller.shopName}
                            </p>
                            {seller.isPromoted && (
                              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-indigo-500/20 shrink-0">
                                <Rocket className="h-3 w-3 animate-bounce" />
                                PROMOTED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-semibold text-slate-400">
                              {seller.ownerName}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                              {seller.category || "General"}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            {seller.isPromoted && (
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                                <Rocket className="h-3 w-3 text-indigo-600 shrink-0" />
                                Ads: {seller.promotedPlanName || 'Active Boost'}
                              </span>
                            )}
                            {seller.commissionModel === 'PLAN_BASED' && seller.subscription?.expiresAt && new Date(seller.subscription.expiresAt) > new Date() ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                                <Sparkles className="h-3 w-3 text-emerald-500 shrink-0" />
                                0% Pass: {seller.subscription?.planName || 'Active'}
                              </span>
                            ) : seller.commissionModel === 'PLAN_BASED' ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black uppercase tracking-wider">
                                Plan Expired (%)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-black uppercase tracking-wider">
                                Commission Based (%)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-900">
                            {(seller.totalOrders || 0).toLocaleString("en-IN")} Orders
                          </span>
                          <span className="text-[10px] font-bold text-brand-600">
                            {currency(seller.totalRevenue)}
                          </span>
                        </div>
                        <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{
                              width: `${Math.min(100, seller.fulfillmentRate || 0)}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {(seller.fulfillmentRate || 0)}% fulfillment
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-slate-700">
                          <HiOutlineDocumentText className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[10px] font-bold">
                            {(seller.productCount || 0).toLocaleString("en-IN")} products
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <HiOutlineMapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[10px] font-bold truncate max-w-[260px]">
                            {seller.location || "Location not set"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <HiOutlineCalendarDays className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold">
                            Joined {seller.joinedDate || "N/A"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <Badge
                          variant="success"
                          className="w-fit text-[8px] font-black uppercase tracking-widest"
                        >
                          Active
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Last order: {seller.lastOrderLabel || "No orders yet"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedSeller(seller)}
                          className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
                        >
                          <HiOutlineEye className="h-3.5 w-3.5" />
                          VIEW PROFILE
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <HiOutlineBuildingOffice2 className="h-8 w-8 text-slate-200" />
                      </div>
                      <p className="text-slate-500 font-bold text-sm">
                        No active sellers found.
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Try a different search or filter.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={loading}
        />
      </div>

      <AnimatePresence>
        {selectedSeller && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6" data-lenis-prevent="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
              onClick={() => setSelectedSeller(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              className="relative z-10 w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: '85vh' }}
            >
              <div className="flex items-start justify-between p-5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl overflow-hidden bg-slate-100 ring-4 ring-white shadow-lg">
                    <img
                      src={selectedSeller.avatar}
                      alt={selectedSeller.shopName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">
                      {selectedSeller.shopName}
                    </h3>
                    <p className="text-sm font-semibold text-slate-500">
                      Owned by {selectedSeller.ownerName}
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="success"
                        className="text-[8px] font-black uppercase tracking-widest"
                      >
                        Active
                      </Badge>
                      <Badge
                        variant="primary"
                        className="text-[8px] font-black uppercase tracking-widest"
                      >
                        {selectedSeller.category || "General"}
                      </Badge>
                      {selectedSeller.isPromoted && (
                        <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                          <Rocket className="h-3 w-3 animate-bounce" />
                          🚀 PROMOTED ({selectedSeller.promotedPlanName || 'Active Boost'})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSeller(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <HiOutlineXMark className="h-6 w-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white min-h-0 overscroll-contain">
                <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full">
                <div className="lg:col-span-4 bg-slate-50 p-5 border-r border-slate-100">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        Contact
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-slate-700">
                          <HiOutlineEnvelope className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-semibold break-all">
                            {selectedSeller.email || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                          <HiOutlinePhone className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-semibold">
                            {selectedSeller.phone || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                          <HiOutlineMapPin className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-semibold leading-relaxed">
                            {selectedSeller.location || "Location not set"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        KYC & Registration
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">Business Type</span>
                          <span className="text-xs font-bold text-slate-700 capitalize">{selectedSeller.businessType || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">Seller Type</span>
                          <span className="text-xs font-bold text-slate-700 capitalize">{selectedSeller.sellerType || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">WhatsApp</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.whatsappNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">PAN Number</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.panNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">Aadhaar Number</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.aadhaarNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">GSTIN</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.gstinNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">Udyam No.</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.udyamNumber || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        Bank Account Details
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">Bank Name</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.bankDetails?.bankName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">Account No.</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.bankDetails?.accountNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">IFSC Code</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.bankDetails?.ifscCode || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs text-slate-500">Branch</span>
                          <span className="text-xs font-bold text-slate-700">{selectedSeller.bankDetails?.branch || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Official Seller KYC PDF Upload Section */}
                    <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-3 shadow-lg">
                      <div className="flex items-center gap-2">
                        <HiOutlineCloudArrowUp className="h-5 w-5 text-brand-400" />
                        <span className="text-xs font-black uppercase tracking-wider">Official KYC Form (PDF)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                        Upload or replace the verified 2-page KYC document (max 2 MB). The seller can view it anytime from their profile.
                      </p>
                      <div className="space-y-2">
                        {selectedSeller.officialKycDocumentUrl && (
                          <button
                            type="button"
                            onClick={() => window.open(selectedSeller.officialKycDocumentUrl, '_blank', 'noopener,noreferrer')}
                            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 ring-1 ring-white/10"
                          >
                            <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5 text-brand-400" />
                            <span>View Uploaded KYC PDF</span>
                          </button>
                        )}
                        <label className="cursor-pointer w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2">
                          {isUploadingKyc ? (
                            <>
                              <HiOutlineArrowPath className="h-3.5 w-3.5 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <HiOutlineCloudArrowUp className="h-3.5 w-3.5" />
                              <span>{selectedSeller.officialKycDocumentUrl ? 'Replace KYC PDF' : 'Upload KYC PDF'}</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleKycFileUpload}
                            disabled={isUploadingKyc}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        Store Health
                      </p>
                      <div className="p-4 bg-white rounded-2xl ring-1 ring-slate-100">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                          <span>Verification</span>
                          <span className="text-brand-600">Verified</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 mt-3">
                          <span>Joined</span>
                          <span>{selectedSeller.joinedDate || "N/A"}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 mt-3">
                          <span>Service radius</span>
                          <span>{selectedSeller.serviceRadius || 5} km</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 mt-3">
                          <span>Last order</span>
                          <span>{selectedSeller.lastOrderLabel || "No orders yet"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        Custom Photo Orders
                      </p>
                      <div className="p-4 bg-white rounded-2xl ring-1 ring-slate-100 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                          <span>Accepts Photo Orders</span>
                          <span className={selectedSeller.acceptsPhotoOrders ? "text-emerald-600" : "text-slate-400"}>
                            {selectedSeller.acceptsPhotoOrders ? "Yes" : "No"}
                          </span>
                        </div>
                        <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-200">
                            <button 
                                onClick={async () => {
                                  try {
                                    await adminApi.updateSellerDetails(selectedSeller.id || selectedSeller._id, { acceptsPhotoOrders: true });
                                    setSelectedSeller(prev => ({ ...prev, acceptsPhotoOrders: true }));
                                    toast.success("Seller enabled for custom photo orders");
                                    setRefreshTick(t => t + 1);
                                  } catch (e) {
                                    toast.error("Failed to update status");
                                  }
                                }}
                                className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all", selectedSeller.acceptsPhotoOrders ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200")}
                            >
                                Enable
                            </button>
                            <button 
                                onClick={async () => {
                                  try {
                                    await adminApi.updateSellerDetails(selectedSeller.id || selectedSeller._id, { acceptsPhotoOrders: false });
                                    setSelectedSeller(prev => ({ ...prev, acceptsPhotoOrders: false }));
                                    toast.success("Seller disabled for custom photo orders");
                                    setRefreshTick(t => t + 1);
                                  } catch (e) {
                                    toast.error("Failed to update status");
                                  }
                                }}
                                className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all", !selectedSeller.acceptsPhotoOrders ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200")}
                            >
                                Disable
                            </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 p-5 bg-white">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {[
                      {
                        label: "Orders",
                        value: (selectedSeller.totalOrders || 0).toLocaleString("en-IN"),
                      },
                      { label: "Revenue", value: currency(selectedSeller.totalRevenue) },
                      {
                        label: "Products",
                        value: (selectedSeller.productCount || 0).toLocaleString("en-IN"),
                      },
                      {
                        label: "Delivered",
                        value: (selectedSeller.deliveredOrders || 0).toLocaleString("en-IN"),
                      },
                      {
                        label: "Pending",
                        value: (selectedSeller.pendingOrders || 0).toLocaleString("en-IN"),
                      },
                      {
                        label: "Fulfillment",
                        value: `${selectedSeller.fulfillmentRate || 0}%`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-100"
                      >
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          {item.label}
                        </p>
                        <p className="text-lg font-black text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-brand-50 border border-brand-100">
                      <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">
                        Performance
                      </p>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                        {(selectedSeller.fulfillmentRate || 0)}% of the orders for this seller have been completed successfully.
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        Average order value
                      </p>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                        {currency(selectedSeller.avgOrderValue)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <h4 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-widest">Financial Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Commission Model</label>
                        <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-200">
                            <button 
                                onClick={async () => {
                                  try {
                                    await adminApi.updateSellerDetails(selectedSeller.id || selectedSeller._id, { commissionModel: 'CATEGORY_WISE' });
                                    setSelectedSeller(prev => ({ ...prev, commissionModel: 'CATEGORY_WISE' }));
                                    toast.success("Updated to Category Wise Commission");
                                    setRefreshTick(t => t + 1);
                                  } catch (e) {
                                    toast.error("Failed to update commission model");
                                  }
                                }}
                                className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", selectedSeller.commissionModel === 'CATEGORY_WISE' ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200")}
                            >
                                Category Wise (%)
                            </button>
                            <button 
                                onClick={async () => {
                                  try {
                                    await adminApi.updateSellerDetails(selectedSeller.id || selectedSeller._id, { commissionModel: 'PLAN_BASED' });
                                    setSelectedSeller(prev => ({ ...prev, commissionModel: 'PLAN_BASED' }));
                                    toast.success("Updated to Subscription Plan Model");
                                    setRefreshTick(t => t + 1);
                                  } catch (e) {
                                    toast.error("Failed to update commission model");
                                  }
                                }}
                                className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", selectedSeller.commissionModel === 'PLAN_BASED' ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200")}
                            >
                                Subscription Plan
                            </button>
                        </div>
                      </div>
                      
                      {selectedSeller.commissionModel === 'PLAN_BASED' && (
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Subscription Details</label>
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-2 font-['Outfit']">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-900">{selectedSeller.subscription?.planName || 'Plan Active'}</span>
                              <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full ${
                                selectedSeller.subscription?.expiresAt && new Date(selectedSeller.subscription.expiresAt) > new Date()
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-rose-500 text-white'
                              }`}>
                                {selectedSeller.subscription?.expiresAt && new Date(selectedSeller.subscription.expiresAt) > new Date() ? 'ACTIVE 0% COMM' : 'EXPIRED'}
                              </span>
                            </div>
                            {selectedSeller.subscription?.expiresAt && (
                              <p className="text-[11px] font-bold text-slate-600">
                                Expires At: <span className="text-slate-900 font-mono">{new Date(selectedSeller.subscription.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              </p>
                            )}
                            {selectedSeller.subscription?.purchasedAt && (
                              <p className="text-[10px] text-slate-400 font-medium">
                                Purchased: {new Date(selectedSeller.subscription.purchasedAt).toLocaleDateString('en-IN')} | Ref: {selectedSeller.subscription?.paymentReference || 'N/A'}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {selectedSeller.commissionModel !== 'ONE_TIME' && headerCategories.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Custom Category Overrides (%)</label>
                        <p className="text-xs text-slate-500 mb-4 leading-relaxed">Leave blank to use the global category commission. Set a number to override it for this specific seller.</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {headerCategories.map(cat => {
                            const overrides = selectedSeller.categoryCommissionOverrides || {};
                            const currentVal = overrides[cat._id] !== undefined ? overrides[cat._id] : '';
                            return (
                              <div key={cat._id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <p className="text-[10px] font-bold text-slate-700 truncate mb-2">{cat.name}</p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Global"
                                    defaultValue={currentVal}
                                    onBlur={async (e) => {
                                      const val = e.target.value;
                                      const numVal = val === '' ? null : Math.max(0, Number(val));
                                      if (currentVal === val || (currentVal === '' && numVal === null)) return;
                                      
                                      try {
                                        const updatedOverrides = { ...overrides };
                                        if (numVal === null) {
                                          delete updatedOverrides[cat._id];
                                        } else {
                                          updatedOverrides[cat._id] = numVal;
                                        }
                                        await adminApi.updateSellerDetails(selectedSeller.id || selectedSeller._id, { categoryCommissionOverrides: updatedOverrides });
                                        setSelectedSeller(prev => ({ ...prev, categoryCommissionOverrides: updatedOverrides }));
                                        toast.success(`${cat.name} override saved!`);
                                        setRefreshTick(t => t + 1);
                                      } catch (err) {
                                        toast.error("Failed to save override");
                                      }
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                  />
                                  <span className="text-xs font-bold text-slate-400">%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setSelectedSeller(null)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                    >
                      Close
                    </button>
                  </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-red-50/30 flex justify-end">
                <button
                  onClick={async () => {
                    const shopName = selectedSeller.shopName || selectedSeller.ownerName;
                    const confirmText = prompt(`Are you sure you want to permanently delete this store? Type "${shopName}" to confirm:`);
                    if (confirmText === shopName) {
                      try {
                        await adminApi.deleteSeller(selectedSeller.id || selectedSeller._id);
                        toast.success("Store deleted successfully.");
                        setSelectedSeller(null);
                        setRefreshTick((v) => v + 1);
                      } catch (error) {
                        toast.error("Failed to delete store.");
                      }
                    } else if (confirmText !== null) {
                      toast.error("Shop name did not match. Deletion cancelled.");
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                >
                  Delete Store
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActiveSellers;
