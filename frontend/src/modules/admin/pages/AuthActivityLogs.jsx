import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Pagination from "@shared/components/ui/Pagination";
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";
import {
  Activity,
  LogIn,
  LogOut,
  Search,
  RefreshCw,
  Monitor,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@shared/utils/formatDate";

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "customer", label: "Customer" },
  { value: "seller", label: "Seller" },
  { value: "delivery", label: "Delivery Partner" },
  { value: "admin", label: "Admin" },
  { value: "sub-admin", label: "Sub-Admin" },
];

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
];

const ROLE_BADGE_VARIANT = {
  customer: "info",
  seller: "warning",
  delivery: "success",
  admin: "gray",
  "sub-admin": "gray",
};

function shortenUserAgent(userAgent = "") {
  const text = String(userAgent || "").trim();
  if (!text) return "Unknown device";
  if (text.length <= 72) return text;
  return `${text.slice(0, 72)}...`;
}

const AuthActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchLogs = async (requestedPage = page, attempt = 0) => {
    setIsLoading(true);
    try {
      const params = {
        page: requestedPage,
        limit: pageSize,
        role: roleFilter,
        action: actionFilter,
      };

      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (fromDate) params.from = new Date(`${fromDate}T00:00:00`).toISOString();
      if (toDate) params.to = new Date(`${toDate}T23:59:59.999`).toISOString();

      const response = await adminApi.getAuthActivityLogs(params);
      const payload = response.data.result || {};
      setLogs(Array.isArray(payload.items) ? payload.items : []);
      setTotal(Number(payload.total || 0));
      setPage(Number(payload.page || requestedPage));
    } catch (error) {
      const status = error?.response?.status;
      if (status === 503 && attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return fetchLogs(requestedPage, attempt + 1);
      }
      console.error("Failed to fetch auth activity logs:", error);
      toast.error(
        status === 503
          ? "Server is reconnecting to the database. Please try again."
          : "Failed to load login activity"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(1);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, actionFilter, searchTerm, fromDate, toDate, pageSize]);

  const summary = useMemo(() => {
    const loginCount = logs.filter((item) => item.action === "login").length;
    const logoutCount = logs.filter((item) => item.action === "logout").length;
    return { loginCount, logoutCount };
  }, [logs]);

  return (
    <div className="ds-section-spacing animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Login Activity
            <div className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          </h1>
          <p className="ds-description mt-1">
            Track when users across all roles logged in or logged out on the platform.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(page)}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="ds-label mb-2">Total Records</p>
              <h3 className="ds-stat-medium">{total}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="ds-label mb-2">Logins (Current Page)</p>
              <h3 className="ds-stat-medium">{summary.loginCount}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600">
              <LogIn className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="ds-label mb-2">Logouts (Current Page)</p>
              <h3 className="ds-stat-medium">{summary.logoutCount}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600">
              <LogOut className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100 bg-white/50 backdrop-blur-xl">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, email, phone, IP..."
              className="w-full pl-11 pr-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-bold outline-none"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-bold outline-none"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-bold outline-none"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-bold outline-none"
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-xl ring-1 ring-slate-100">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">User</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Role</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">IP Address</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Device</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm font-bold text-slate-400">
                    Loading activity logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm font-bold text-slate-400">
                    No login or logout activity found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id || log._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 text-sm">{log.userName || "Unknown User"}</div>
                      <div className="text-[11px] text-slate-500 font-semibold mt-1">
                        {log.userEmail || log.userPhone || "No contact info"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={ROLE_BADGE_VARIANT[log.role] || "neutral"}>
                        {log.roleLabel || log.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div
                        className={cn(
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                          log.action === "login"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700",
                        )}
                      >
                        {log.action === "login" ? <LogIn className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
                        {log.action}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                        {log.ipAddress || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <div className="flex items-start gap-2 text-[11px] font-semibold text-slate-500">
                        <Monitor className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span title={log.userAgent || ""}>{shortenUserAgent(log.userAgent)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-700 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-center">
        <Pagination
          page={page}
          totalPages={Math.max(Math.ceil(total / pageSize), 1)}
          total={total}
          pageSize={pageSize}
          onPageChange={(nextPage) => fetchLogs(nextPage)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          loading={isLoading}
        />
      </div>
    </div>
  );
};

export default AuthActivityLogs;
