import React from "react";
import { CheckCircle2, Sparkles, Clock, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * CheckoutOrderSuccess
 *
 * Props:
 *   orderId – string order ID (last 6-8 chars shown)
 *   show    – boolean — controls visibility via AnimatePresence
 */
const CheckoutOrderSuccess = React.memo(function CheckoutOrderSuccess({ orderId, show }) {
  const shortId = orderId ? String(orderId).slice(-6).toUpperCase() : "SUCCESS";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none"
        >
          {/* Ambient Glows */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-brand-500/15 rounded-full blur-[90px] pointer-events-none" />

          {/* Success Card Modal */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 max-w-sm w-full bg-slate-900/90 border border-slate-700/60 rounded-3xl p-7 shadow-2xl text-white backdrop-blur-md overflow-hidden"
          >
            {/* Top Shine Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-brand-400 to-teal-400" />

            {/* Glowing Icon */}
            <div className="relative mx-auto w-20 h-20 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl animate-ping" />
              <div className="relative w-20 h-20 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 border-2 border-white/20">
                <CheckCircle2 size={44} className="text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Heading & Badge */}
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-emerald-400 text-xs font-black uppercase tracking-wider mb-3">
              <Sparkles size={12} />
              <span>Payment & Order Confirmed</span>
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight mb-1">
              Order Placed!
            </h2>

            <p className="text-sm font-mono font-bold text-amber-400 mb-4 tracking-wider">
              #{shortId}
            </p>

            <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/50 mb-6 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Clock size={13} className="text-emerald-400" /> Estimated Delivery
                </span>
                <span className="text-white font-bold">12-15 Mins</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-700/40 pt-2">
                Waiting for the nearest store to accept. You can live track your order status in real-time.
              </p>
            </div>

            {/* Animated Redirect Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Redirecting to order...</span>
                <span className="flex items-center gap-0.5 text-emerald-400">
                  Live View <ArrowRight size={10} />
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/40">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.8, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default CheckoutOrderSuccess;
