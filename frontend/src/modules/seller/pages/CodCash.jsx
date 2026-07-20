import React from "react";
import { motion } from "framer-motion";
import { IndianRupee, RotateCw } from "lucide-react";
import { toast } from "sonner";
import Card from "@/shared/components/ui/Card";
import Button from "@/shared/components/ui/Button";
import { sellerApi } from "../services/sellerApi";

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
    pendingOrders: [],
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
        pendingOrders,
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
          <h1 className="text-2xl font-bold text-slate-900">COD Cash</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cash received from riders — remit to admin to settle wallets.
          </p>
        </div>
        <Button variant="ghost" size="icon" disabled={loading} onClick={fetchSummary}>
          <RotateCw size={18} className={loading ? "animate-spin text-slate-400" : ""} />
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <Card className="p-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cash In Hand</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            {RUPEE}
            {safeMoney(data.cashInHand).toLocaleString()}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pending To Admin</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            {RUPEE}
            {safeMoney(data.totalPending).toLocaleString()}
          </p>
        </Card>
      </motion.div>

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
        <h3 className="font-bold text-slate-900 mb-1">Pending Orders</h3>
        <p className="text-xs text-slate-500 mb-4">Cash handed over by riders, awaiting remittance.</p>
        <div className="space-y-2">
          {data.pendingOrders.slice(0, 50).map((row) => (
            <div
              key={row.orderId}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">Order #{row.orderId}</p>
                <p className="text-xs text-slate-500">
                  Gross {RUPEE}
                  {safeMoney(row.amountGross).toLocaleString()}
                </p>
              </div>
              <p className="text-sm font-extrabold text-slate-900">
                {RUPEE}
                {safeMoney(row.amountNetPending).toLocaleString()}
              </p>
            </div>
          ))}
          {data.pendingOrders.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              No COD cash pending.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CodCash;
