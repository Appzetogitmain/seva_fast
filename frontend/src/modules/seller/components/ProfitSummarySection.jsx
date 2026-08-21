import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  BadgePercent,
  Receipt,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { formatDate } from "@shared/utils/formatDate";
import { sellerApi } from "../services/sellerApi";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const PAYOUT_STATUS_META = {
  COMPLETED: { label: "Credited to Wallet", variant: "success" },
  PENDING: { label: "Pending", variant: "warning" },
  HOLD: { label: "On Hold", variant: "warning" },
  PROCESSING: { label: "Processing", variant: "warning" },
  FAILED: { label: "Failed", variant: "error" },
  CANCELLED: { label: "Cancelled", variant: "error" },
  NOT_APPLICABLE: { label: "N/A", variant: "gray" },
};

const SUMMARY_COLUMNS = [
  { key: "perOrderAvg", label: "Per Order (Avg)" },
  { key: "today", label: "Today" },
  { key: "thisMonth", label: "This Month" },
  { key: "thisYear", label: "This Year" },
];

const SUMMARY_ROWS = [
  { key: "sellingPrice", label: "Selling Price", tone: "default" },
  { key: "purchaseCost", label: "Purchase Cost", tone: "deduction" },
  { key: "commission", label: "Commission Charged", tone: "deduction" },
  { key: "deliveryEarning", label: "Delivery Fee Earned", tone: "credit" },
  { key: "totalDeduction", label: "Total Deduction", tone: "deduction-strong" },
  { key: "netProfit", label: "Net Profit (Your Earning)", tone: "profit" },
];

const toneClass = {
  default: "text-slate-800 font-semibold",
  deduction: "text-red-600 font-semibold",
  credit: "text-emerald-600 font-semibold",
  "deduction-strong": "text-red-700 font-bold",
  profit: "text-emerald-700 font-black",
};

const ProfitSummarySection = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await sellerApi.getProfitSummary();
        if (!cancelled && res.data?.success) {
          setData(res.data.result);
          setError(false);
        }
      } catch (err) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card className="p-6 border-none shadow-md bg-white">
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm font-bold">
          Loading profit summary...
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6 border-none shadow-md bg-white">
        <div className="h-24 flex items-center justify-center text-slate-400 text-sm font-medium">
          Couldn't load your profit summary right now.
        </div>
      </Card>
    );
  }

  const { planStatus, summary, recentOrders } = data;
  const isExempt = Boolean(planStatus?.isExempt);

  return (
    <div className="space-y-6">
      {/* Commission / Plan status banner */}
      <BlurFade delay={0.35}>
        <div
          className={
            "rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border shadow-sm " +
            (isExempt
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200")
          }
        >
          <div className="flex items-start gap-3">
            <div className={"p-2.5 rounded-xl " + (isExempt ? "bg-emerald-100" : "bg-amber-100")}>
              {isExempt ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ) : (
                <BadgePercent className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div>
              <p className={"font-black text-sm " + (isExempt ? "text-emerald-800" : "text-amber-800")}>
                {isExempt
                  ? `You're on ${planStatus?.planName || "a Seller Plan"} — 0% Commission`
                  : "You're on Category-wise Commission"}
              </p>
              <p className={"text-xs font-medium mt-0.5 " + (isExempt ? "text-emerald-700" : "text-amber-700")}>
                {isExempt
                  ? `No commission is deducted from your orders${planStatus?.expiresAt ? ` until ${formatDate(planStatus.expiresAt)}` : ""}.`
                  : "Admin commission is deducted per order based on product category. Buy a plan to pay 0% commission."}
              </p>
            </div>
          </div>
          {!isExempt && (
            <button
              onClick={() => navigate("/seller/plans")}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-colors shrink-0"
            >
              View Plans <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </BlurFade>

      {/* Profit Summary table */}
      <BlurFade delay={0.4}>
        <Card className="border-none shadow-md bg-white overflow-hidden" contentClassName="p-0">
          <div className="px-6 py-4 bg-slate-900 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-white" />
            <h3 className="text-sm font-black text-white uppercase tracking-wide">
              Profit Summary
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-3 font-black text-slate-600 text-xs uppercase tracking-wide">
                    Particulars
                  </th>
                  {SUMMARY_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="text-right px-6 py-3 font-black text-slate-600 text-xs uppercase tracking-wide"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SUMMARY_ROWS.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3 font-bold text-slate-700">{row.label}</td>
                    {SUMMARY_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={"px-6 py-3 text-right " + toneClass[row.tone]}
                      >
                        {row.key === "deliveryEarning" && summary?.[col.key]?.[row.key] > 0 ? "+" : ""}
                        {money(summary?.[col.key]?.[row.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="px-6 py-2.5 font-bold text-slate-500 text-xs">Orders Counted</td>
                  {SUMMARY_COLUMNS.map((col) => (
                    <td key={col.key} className="px-6 py-2.5 text-right font-bold text-slate-500 text-xs">
                      {summary?.[col.key]?.orderCount ?? 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </BlurFade>

      {/* Recent orders profit breakdown */}
      <BlurFade delay={0.45}>
        <Card className="border-none shadow-md bg-white overflow-hidden" contentClassName="p-0">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Recent Orders — Profit Breakdown
            </h3>
          </div>
          {(!recentOrders || recentOrders.length === 0) ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-sm font-medium">
              No delivered orders yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-600 uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Order</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-right px-4 py-3">Selling Price</th>
                    <th className="text-right px-4 py-3">Purchase Cost</th>
                    <th className="text-right px-4 py-3">Commission</th>
                    <th className="text-right px-4 py-3">Delivery Earning</th>
                    <th className="text-right px-4 py-3">Net Profit</th>
                    <th className="text-right px-6 py-3">Wallet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.map((order) => {
                    const statusMeta =
                      PAYOUT_STATUS_META[order.payoutStatus] || PAYOUT_STATUS_META.PENDING;
                    return (
                      <tr key={order.orderId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3 font-bold text-slate-800">#{order.orderId}</td>
                        <td className="px-4 py-3 text-slate-500 font-medium">
                          {formatDate(order.deliveredAt)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {money(order.sellingPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {money(order.purchaseCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {order.commissionExempt ? (
                            <span className="text-emerald-600 text-xs font-bold">Exempt (Plan)</span>
                          ) : (
                            <span className="text-red-600">{money(order.commission)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                          {order.deliveryEarning > 0 ? `+${money(order.deliveryEarning)}` : money(order.deliveryEarning)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700">
                          {money(order.netProfit)}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </BlurFade>
    </div>
  );
};

export default ProfitSummarySection;
