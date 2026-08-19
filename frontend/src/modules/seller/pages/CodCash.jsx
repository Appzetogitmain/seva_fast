import React from "react";
import { motion } from "framer-motion";
import { IndianRupee, RotateCw } from "lucide-react";
import { toast } from "sonner";
import Card from "@/shared/components/ui/Card";
import Button from "@/shared/components/ui/Button";
import { sellerApi } from "../services/sellerApi";
import { formatDate } from "@shared/utils/formatDate";

const RUPEE = "\u20B9";

function safeMoney(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

const CodCash = () => {
  const [loading, setLoading] = React.useState(true);
  const [paying, setPaying] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState("");
  const [data, setData] = React.useState({
    cashInHand: 0,
    totalPending: 0,
    totalSettled: 0,
    pendingOrders: [],
    heldByRider: [],
    totalHeldByRiders: 0,
    owedByAdmin: [],
    totalOwedByAdmin: 0,
  });

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await sellerApi.getCodCashSummary();
      const result = res.data?.result || {};
      const pendingOrders = Array.isArray(result.pendingOrders) ? result.pendingOrders : [];
      const totalPending = safeMoney(result.totalPending);
      setData({
        cashInHand: safeMoney(result.cashInHand),
        totalPending,
        totalSettled: safeMoney(result.totalSettled),
        pendingOrders,
        heldByRider: Array.isArray(result.heldByRider) ? result.heldByRider : [],
        totalHeldByRiders: safeMoney(result.totalHeldByRiders),
        owedByAdmin: Array.isArray(result.owedByAdmin) ? result.owedByAdmin : [],
        totalOwedByAdmin: safeMoney(result.totalOwedByAdmin),
      });
      setPayAmount(totalPending > 0 ? String(totalPending) : "");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load COD cash");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enteredPayAmount = safeMoney(payAmount);

  const handlePayNow = async () => {
    if (paying) return;
    if (enteredPayAmount <= 0) {
      toast.error("Enter an amount to pay");
      return;
    }
    if (enteredPayAmount > data.totalPending) {
      toast.error(
        `You can pay up to ${RUPEE}${safeMoney(data.totalPending).toLocaleString()}`,
      );
      return;
    }

    try {
      setPaying(true);
      const res = await sellerApi.payCodCashToAdmin({ amount: enteredPayAmount });
      const result = res.data?.result || {};
      toast.success(
        `Remitted ${RUPEE}${safeMoney(result.totalSubmitted).toLocaleString()} to admin`,
      );
      await fetchSummary();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to remit COD cash");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">COD Cash &amp; Payouts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Who owes you, who you owe — riders, admin, and your product payouts, all in one place.
          </p>
        </div>
        <Button variant="ghost" size="icon" disabled={loading} onClick={fetchSummary}>
          <RotateCw size={18} className={loading ? "animate-spin text-slate-400" : ""} />
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <Card className="p-6">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Owed By Riders</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-2">
            {RUPEE}
            {safeMoney(data.totalHeldByRiders).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Cash they collected, not handed over yet</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cash In Hand</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {RUPEE}
            {safeMoney(data.cashInHand).toLocaleString()}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">You Owe Admin</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {RUPEE}
            {safeMoney(data.totalPending).toLocaleString()}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Remitted So Far</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-2">
            {RUPEE}
            {safeMoney(data.totalSettled).toLocaleString()}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold text-purple-600 uppercase tracking-wide">Admin Owes You</p>
          <p className="text-2xl font-extrabold text-purple-600 mt-2">
            {RUPEE}
            {safeMoney(data.totalOwedByAdmin).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Your product payout, pending release</p>
        </Card>
      </motion.div>

      <Card className="p-6">
        <h3 className="font-bold text-slate-900 mb-1">Cash With Riders</h3>
        <p className="text-xs text-slate-500 mb-4">
          Collected from customers, not handed over to you yet — this is what each rider currently owes you.
        </p>
        <div className="space-y-2">
          {data.heldByRider.slice(0, 50).map((row) => (
            <div
              key={row.orderId}
              className="rounded-xl border border-blue-100 bg-blue-50/40 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-900">Order #{row.orderId}</p>
                <p className="text-xs font-bold text-blue-700">{row.riderName}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Total COD</p>
                  <p className="text-sm font-extrabold text-slate-900">
                    {RUPEE}{safeMoney(row.amountGross).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-emerald-600 uppercase">Rider Earning</p>
                  <p className="text-sm font-extrabold text-emerald-600">
                    {RUPEE}{safeMoney(row.riderCommission).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-blue-600 uppercase">Owed To You</p>
                  <p className="text-sm font-extrabold text-blue-700">
                    {RUPEE}{safeMoney(row.amountOwedBySeller).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {data.heldByRider.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              No rider is currently holding COD cash for you.
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold text-slate-900">Pay To Admin</h3>
            <p className="text-xs text-slate-500 mt-1">
              Remitting credits admin wallet and settles seller/rider commissions.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              Amount
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900">{RUPEE}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                disabled={paying}
                className="w-full bg-transparent outline-none text-lg font-bold text-slate-900"
              />
            </div>
          </div>
          <Button onClick={handlePayNow} disabled={paying || enteredPayAmount <= 0}>
            {paying ? "Paying..." : "Pay Admin"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-bold text-slate-900 mb-1">Cash With You</h3>
        <p className="text-xs text-slate-500 mb-4">Handed over by riders, awaiting your remittance to admin.</p>
        <div className="space-y-2">
          {data.pendingOrders.slice(0, 50).map((row) => (
            <div
              key={row.orderId}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
            >
              <p className="text-sm font-bold text-slate-900 mb-2">Order #{row.orderId}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Total COD</p>
                  <p className="text-sm font-extrabold text-slate-900">
                    {RUPEE}{safeMoney(row.amountGross).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-emerald-600 uppercase">Rider Earning</p>
                  <p className="text-sm font-extrabold text-emerald-600">
                    {RUPEE}{safeMoney(row.riderCommission).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Pending To Admin</p>
                  <p className="text-sm font-extrabold text-slate-900">
                    {RUPEE}{safeMoney(row.amountNetPending).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {data.pendingOrders.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              No COD cash pending.
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-bold text-slate-900 mb-1">Owed To You By Admin</h3>
        <p className="text-xs text-slate-500 mb-4">
          Your product payout per order, pending release — separate from COD cash flow.
        </p>
        <div className="space-y-2">
          {data.owedByAdmin.slice(0, 50).map((row) => (
            <div
              key={row.orderId}
              className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50/40 p-3"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">Order #{row.orderId}</p>
                <p className="text-xs text-slate-500">
                  {row.createdAt ? formatDate(row.createdAt) : ""} · Pending
                </p>
              </div>
              <p className="text-sm font-extrabold text-purple-700">
                {RUPEE}{safeMoney(row.amount).toLocaleString()}
              </p>
            </div>
          ))}
          {data.owedByAdmin.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              Nothing pending from admin right now.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CodCash;
