import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, BellRing, ArrowRight, X, Volume2, VolumeX, MapPin, CreditCard } from "lucide-react";
import { useAuth } from "@core/context/AuthContext";
import { getOrderSocket, onSellerOrderNew } from "@core/services/orderSocket";
import { notificationSound } from "@core/utils/notificationSound";

export default function SellerOrderAlertModal() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [newOrder, setNewOrder] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "seller" || !token) return;

    const cleanupListener = onSellerOrderNew(() => token, (data) => {
      console.log("[SellerOrderAlertModal] New order event received:", data);

      const orderInfo = data?.order || data;
      setNewOrder(orderInfo);
      setIsMuted(false);
      notificationSound.startRepeatingOrderAlert();
    });

    return () => {
      cleanupListener();
      notificationSound.stopRepeatingAlert();
    };
  }, [user, token]);

  const handleDismiss = () => {
    notificationSound.stopRepeatingAlert();
    setNewOrder(null);
  };

  const handleViewOrders = () => {
    notificationSound.stopRepeatingAlert();
    setNewOrder(null);
    navigate("/seller/orders");
  };

  const toggleMute = () => {
    if (isMuted) {
      notificationSound.startRepeatingOrderAlert();
      setIsMuted(false);
    } else {
      notificationSound.stopRepeatingAlert();
      setIsMuted(true);
    }
  };

  if (!newOrder) return null;

  const orderId = newOrder.orderId || newOrder._id || "NEW";
  const amount = newOrder.grandTotal || newOrder.pricing?.grandTotal || newOrder.totalAmount || 0;
  const paymentMode = newOrder.paymentMode || "COD";
  const address = newOrder.shippingAddress?.address || newOrder.address?.address || "Customer Address";
  const itemsCount = newOrder.items?.length || 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-indigo-500/30"
        >
          {/* Top glowing header */}
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl animate-bounce">
                  <BellRing className="h-6 w-6 text-yellow-300" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-indigo-200">
                    REAL-TIME ALERT
                  </span>
                  <h3 className="text-xl font-black tracking-tight">NEW ORDER RECEIVED!</h3>
                </div>
              </div>
              <button
                onClick={toggleMute}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
                title={isMuted ? "Unmute sound" : "Mute sound"}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5 animate-pulse" />}
              </button>
            </div>
          </div>

          {/* Order Details Body */}
          <div className="p-6 space-y-5">
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Order ID</p>
                <p className="text-base font-black text-slate-900 font-mono">#{String(orderId).slice(-10)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Amount</p>
                <p className="text-xl font-black text-emerald-600">₹{Number(amount).toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-600 font-bold">
                  <ShoppingBag className="h-4 w-4 text-indigo-500" />
                  <span>Total Items</span>
                </div>
                <span className="font-extrabold text-slate-900">{itemsCount} {itemsCount === 1 ? "Item" : "Items"}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-600 font-bold">
                  <CreditCard className="h-4 w-4 text-indigo-500" />
                  <span>Payment Mode</span>
                </div>
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase">
                  {paymentMode}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-slate-500 font-bold">
                  <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Delivery Address</span>
                </div>
                <p className="text-slate-800 font-bold leading-relaxed line-clamp-2 pl-6">{address}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleDismiss}
                className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-all"
              >
                Dismiss
              </button>
              <button
                onClick={handleViewOrders}
                className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <span>VIEW ORDER</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
