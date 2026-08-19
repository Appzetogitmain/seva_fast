import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, BellRing, ArrowRight, X, Volume2, VolumeX, MapPin, DollarSign, Package } from "lucide-react";
import { useAuth } from "@core/context/AuthContext";
import { getOrderSocket, onDeliveryBroadcast } from "@core/services/orderSocket";
import { notificationSound } from "@core/utils/notificationSound";

export default function DeliveryOrderAlertModal() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [newOrder, setNewOrder] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "delivery" || !token) return;

    const cleanupListener = onDeliveryBroadcast(() => token, (data) => {
      console.log("[DeliveryOrderAlertModal] Delivery broadcast event received:", data);

      const payload = data?.preview || data;
      setNewOrder(payload);
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

  const handleViewDetails = () => {
    notificationSound.stopRepeatingAlert();
    const orderId = newOrder?.orderId || newOrder?._id;
    setNewOrder(null);
    if (orderId) {
      navigate(`/delivery/order-details/${orderId}`);
    } else {
      navigate("/delivery/dashboard");
    }
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
  const sellerName = newOrder.sellerName || "Partner Store";
  const pickupAddress = newOrder.pickupAddress || "Store Pickup Location";
  const deliveryAddress = newOrder.deliveryAddress || newOrder.shippingAddress?.address || "Customer Delivery Address";
  const itemsCount = newOrder.itemsCount || 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-emerald-500/30"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl animate-bounce">
                  <Truck className="h-6 w-6 text-yellow-300" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-emerald-200">
                    NEW RIDER TASK
                  </span>
                  <h3 className="text-xl font-black tracking-tight">DELIVERY REQUEST!</h3>
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

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Order Reference</p>
                <p className="text-base font-black text-slate-900 font-mono">#{String(orderId).slice(-10)}</p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                  {itemsCount} {itemsCount === 1 ? "Item" : "Items"}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-slate-500 font-bold">
                  <Package className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Pickup From ({sellerName})</span>
                </div>
                <p className="text-slate-800 font-bold leading-relaxed line-clamp-2 pl-6">{pickupAddress}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-slate-500 font-bold">
                  <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Deliver To</span>
                </div>
                <p className="text-slate-800 font-bold leading-relaxed line-clamp-2 pl-6">{deliveryAddress}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleDismiss}
                className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-all"
              >
                Decline
              </button>
              <button
                onClick={handleViewDetails}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                <span>ACCEPT TASK</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
