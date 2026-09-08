import React from "react";
import {
  IndianRupee,
  RotateCw,
  Store,
  Phone,
  CheckCircle2,
  HelpCircle,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import Button from "@/shared/components/ui/Button";
import { deliveryApi } from "../services/deliveryApi";
import { formatDate } from "@shared/utils/formatDate";

const RUPEE = "\u20B9";

function safeMoney(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

const CodCash = () => {
  const [loading, setLoading] = React.useState(true);
  const [handoffLoadingId, setHandoffLoadingId] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState("pending"); // 'pending' | 'history' | 'guide'

  const [data, setData] = React.useState({
    systemFloatCOD: 0,
    cashInHand: 0,
    totalCodEarnings: 0,
    totalCollected: 0,
    totalSettled: 0,
    toCollect: [],
    toHandoff: [],
    settledHistory: [],
  });

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await deliveryApi.getCodCashSummary();
      if (res.data?.success && res.data?.result) {
        const result = res.data.result;
        const nextToHandoff = Array.isArray(result.toHandoff)
          ? result.toHandoff
          : Array.isArray(result.toRemit)
            ? result.toRemit
            : [];
        const floatCOD = safeMoney(result.systemFloatCOD || result.cashInHand);
        setData({
          systemFloatCOD: floatCOD,
          cashInHand: safeMoney(result.cashInHand || floatCOD),
          totalCodEarnings: safeMoney(result.totalCodEarnings),
          totalCollected: safeMoney(result.totalCollected),
          totalSettled: safeMoney(result.totalSettled),
          toCollect: Array.isArray(result.toCollect) ? result.toCollect : [],
          toHandoff: nextToHandoff,
          settledHistory: Array.isArray(result.settledHistory) ? result.settledHistory : [],
        });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load COD cash");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSummary();
  }, []);

  // Handover single specific order to its specific store
  const handleHandoffSingleOrder = async (orderId, amount, sellerName) => {
    try {
      setHandoffLoadingId(orderId);
      await deliveryApi.handoffCodCashToSeller(orderId);
      toast.success(`Handed over ${RUPEE}${safeMoney(amount)} for Order #${orderId} to ${sellerName || "Store"}!`);
      await fetchSummary();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to confirm handover");
    } finally {
      setHandoffLoadingId(null);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Top Sticky Header */}
      <div className="bg-white shadow-sm p-4 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-lg font-black text-gray-900">COD Cash Management</h1>
            <p className="text-xs text-gray-500">
              Store-wise handover &amp; settlement history
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={loading}
            onClick={fetchSummary}
            aria-label="Refresh COD summary"
          >
            <RotateCw size={18} className={loading ? "animate-spin text-gray-400" : "text-gray-600"} />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 max-w-lg mx-auto mt-3 border-t border-gray-100 pt-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === "pending"
                ? "bg-orange-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            To Hand Over ({data.toHandoff.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === "history"
                ? "bg-orange-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            History ({data.settledHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "guide"
                ? "bg-orange-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <HelpCircle size={15} /> How it Works
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Top Cash In Hand Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Cash In Hand (To Hand Over)
              </p>
              <p className="text-3xl font-extrabold text-gray-900 mt-0.5">
                {RUPEE}
                {safeMoney(data.systemFloatCOD).toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 leading-tight">
                Net physical cash in your pocket after keeping your delivery earnings.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 text-orange-600 shrink-0">
              <IndianRupee size={24} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3.5">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5">
              <p className="text-[10px] font-bold text-emerald-700 uppercase">Your Earning (Kept)</p>
              <p className="text-base font-extrabold text-emerald-700">
                {RUPEE}
                {safeMoney(data.totalCodEarnings).toLocaleString()}
              </p>
              <p className="text-[9px] text-emerald-600">In your pocket</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-2.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Total Settled So Far</p>
              <p className="text-base font-extrabold text-gray-900">
                {RUPEE}
                {safeMoney(data.totalSettled).toLocaleString()}
              </p>
              <p className="text-[9px] text-gray-400">Handed over to stores</p>
            </div>
          </div>
        </div>

        {/* TAB 1: PENDING HANDOVERS (STORE-SPECIFIC CARDS) */}
        {activeTab === "pending" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  <Store size={16} className="text-orange-600" />
                  Store-Specific Cash Handovers
                </h3>
                <span className="text-xs font-bold text-gray-500">
                  {data.toHandoff.length} Order(s)
                </span>
              </div>

              {data.toHandoff.map((row) => (
                <div
                  key={`handoff-${row.orderId}`}
                  className="p-4 bg-white rounded-2xl border border-orange-200 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                        Order #{row.orderId}
                      </span>
                      <p className="text-sm font-black text-gray-900 mt-1 flex items-center gap-1">
                        🏪 {row.sellerName}
                      </p>
                    </div>
                    {row.sellerPhone && (
                      <a
                        href={`tel:${row.sellerPhone}`}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-100 text-gray-800 text-xs font-bold flex items-center gap-1 hover:bg-gray-200"
                      >
                        <Phone size={13} /> Call Store
                      </a>
                    )}
                  </div>

                  {/* 3-Step Math Calculation */}
                  <div className="grid grid-cols-3 gap-1.5 text-center bg-orange-50/50 rounded-xl p-2.5 border border-orange-100 text-xs">
                    <div>
                      <p className="text-[9px] font-bold text-gray-500 uppercase">Customer Paid</p>
                      <p className="font-extrabold text-gray-900">
                        {RUPEE}{safeMoney(row.amountGross).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-emerald-700 uppercase">Keep in Pocket</p>
                      <p className="font-black text-emerald-700">
                        - {RUPEE}{safeMoney(row.riderCommission).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-orange-700 uppercase">Give to Store</p>
                      <p className="font-black text-orange-700 text-sm">
                        {RUPEE}{safeMoney(row.amountNetPending).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Action Button: I have handed over to this specific seller */}
                  <Button
                    onClick={() =>
                      handleHandoffSingleOrder(row.orderId, row.amountNetPending, row.sellerName)
                    }
                    disabled={handoffLoadingId === row.orderId}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm text-xs"
                  >
                    {handoffLoadingId === row.orderId ? (
                      <>
                        <RotateCw size={14} className="animate-spin" /> Updating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} /> Hand Over {RUPEE}
                        {safeMoney(row.amountNetPending).toLocaleString()} to {row.sellerName}
                      </>
                    )}
                  </Button>
                </div>
              ))}

              {data.toHandoff.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400 space-y-1">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                  <p className="font-bold text-gray-700">All COD cash is cleared!</p>
                  <p className="text-gray-400">You have no pending cash to hand over to stores.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SETTLEMENT HISTORY */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
              <Clock size={16} className="text-emerald-600" />
              Settlement History
            </h3>

            <div className="space-y-2.5">
              {data.settledHistory.map((row) => (
                <div
                  key={`hist-${row.orderId}`}
                  className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 space-y-1.5"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                        #{row.orderId}
                      </span>
                      <p className="text-xs font-bold text-gray-900 mt-0.5">
                        🏪 {row.sellerName}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Handed Over
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200/60">
                    <span className="text-[10px] text-gray-500">
                      {row.deliveredAt || row.createdAt ? formatDate(row.deliveredAt || row.createdAt) : "Delivered"}
                    </span>
                    <span className="font-bold text-gray-900">
                      Amount Handed Over:{" "}
                      <span className="text-emerald-700 font-black">
                        {RUPEE}{safeMoney(row.amountNetRemitted || row.amountNetPending).toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>
              ))}

              {data.settledHistory.length === 0 && (
                <div className="p-6 text-center text-xs text-gray-400">
                  No past settled COD orders yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: HOW COD WORKS GUIDE */}
        {activeTab === "guide" && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-orange-100 text-orange-700">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">How Does COD Cash Flow Work?</h3>
                <p className="text-xs text-gray-500">3 simple steps for delivery partners:</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-100 space-y-1">
                <div className="flex items-center gap-2 font-bold text-orange-900">
                  <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center text-[10px]">1</span>
                  Collect Cash from Customer
                </div>
                <p className="text-gray-600 pl-7">
                  Collect the full Gross Order Total (e.g., ₹520) in cash upon delivery.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[10px]">2</span>
                  Keep Your Delivery Earning in Pocket
                </div>
                <p className="text-gray-600 pl-7">
                  You don't need to transfer your delivery commission (e.g., ₹30) — you keep this cash immediately in your pocket.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 space-y-1">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px]">3</span>
                  Hand Over Remaining Cash to Store
                </div>
                <p className="text-gray-600 pl-7">
                  Hand over the remaining amount (₹520 - ₹30 = ₹490) to the specific merchant store and click <strong>"Hand Over to Store"</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-500 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>Confirming handover for a store only clears that specific store's cash. Other stores remain unaffected.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodCash;
