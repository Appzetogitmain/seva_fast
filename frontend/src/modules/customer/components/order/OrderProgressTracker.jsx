import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, Clock, Truck, Home, XCircle, Package, Calendar } from "lucide-react";
import { getLegacyStatusFromOrder } from "@/shared/utils/orderStatus";

const LOCAL_STEPS = [
  {
    id: "confirmed",
    label: "Order Confirmed",
    icon: CheckCircle,
  },
  {
    id: "out_for_delivery",
    label: "Out for delivery",
    icon: Truck,
  },
  {
    id: "delivered",
    label: "Delivered",
    icon: Home,
  },
];

const SCHEDULED_STEPS = [
  {
    id: "confirmed",
    label: "Order Confirmed",
    icon: CheckCircle,
  },
  {
    id: "packed",
    label: "Packed & Pickup Scheduled",
    icon: Package,
  },
  {
    id: "in_transit",
    label: "In Transit with Courier",
    icon: Truck,
  },
  {
    id: "out_for_delivery",
    label: "Out for Delivery",
    icon: Truck,
  },
  {
    id: "delivered",
    label: "Delivered",
    icon: Home,
  },
];

const OrderProgressTracker = ({
  order,
  estimatedArrivalText = "12:45 PM",
  arrivingInText = "8 mins",
  totalDistanceText = "—",
  shippingTracking = null,
}) => {
  const status = getLegacyStatusFromOrder(order);
  const workflowStatus = String(order?.workflowStatus || "").toUpperCase();
  const isScheduled = order?.deliveryType === "scheduled" || order?.shipmentDetails?.provider === "shiprocket";

  const getScheduledStepStatus = (stepId) => {
    if (status === "cancelled" || workflowStatus === "CANCELLED") return "cancelled";
    if (status === "delivered" || workflowStatus === "DELIVERED") return "completed";

    const hasAwb = Boolean(order?.shipmentDetails?.awbCode || shippingTracking?.awbCode);
    const trackingStatus = String(shippingTracking?.currentStatus || order?.shipmentDetails?.lastSyncedStatus || "").toUpperCase();

    const isOutForDelivery =
      trackingStatus.includes("OUT FOR DELIVERY") ||
      workflowStatus === "OUT_FOR_DELIVERY" ||
      status === "out_for_delivery";

    const isInTransit =
      trackingStatus.includes("IN TRANSIT") ||
      trackingStatus.includes("SHIPPED") ||
      trackingStatus.includes("PICKED UP") ||
      trackingStatus.includes("REACHED") ||
      hasAwb;

    const isPacked =
      order?.pickupReadyAt ||
      workflowStatus === "PICKUP_READY" ||
      workflowStatus === "SELLER_ACCEPTED" ||
      order?.shipmentDetails?.shiprocketOrderId ||
      isInTransit ||
      isOutForDelivery;

    if (stepId === "confirmed") {
      return "completed";
    }

    if (stepId === "packed") {
      if (isInTransit || isOutForDelivery) return "completed";
      if (isPacked) return "active";
      return status === "pending" ? "pending" : "active";
    }

    if (stepId === "in_transit") {
      if (isOutForDelivery) return "completed";
      if (isInTransit) return "active";
      return "pending";
    }

    if (stepId === "out_for_delivery") {
      if (isOutForDelivery) return "active";
      return "pending";
    }

    if (stepId === "delivered") {
      return status === "delivered" ? "completed" : "pending";
    }

    return "pending";
  };

  const getLocalStepStatus = (stepId) => {
    if (status === "cancelled") return "cancelled";

    if (stepId === "confirmed") {
      if (status === "pending") return "active";
      return "completed";
    }

    if (stepId === "out_for_delivery") {
      if (status === "delivered") return "completed";
      if (status === "out_for_delivery" || workflowStatus === "OUT_FOR_DELIVERY") return "active";
      return "pending";
    }

    if (stepId === "delivered") {
      return status === "delivered" ? "completed" : "pending";
    }

    return "pending";
  };

  if (status === "cancelled" || workflowStatus === "CANCELLED") {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <XCircle size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-rose-900 leading-tight">Order Cancelled</h3>
            <p className="text-xs text-rose-600 mt-0.5 leading-snug">
              {order?.cancelReason || order?.cancelledReason || "This order has been cancelled."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const steps = isScheduled ? SCHEDULED_STEPS : LOCAL_STEPS;
  const getStepStatus = isScheduled ? getScheduledStepStatus : getLocalStepStatus;

  // Format expected delivery date for scheduled shipping
  const rawEdd =
    shippingTracking?.expectedDeliveryDate ||
    order?.deliveryEta?.estimatedDeliveryDate;

  let formattedEdd = null;
  if (rawEdd) {
    const d = new Date(rawEdd);
    if (!isNaN(d.getTime())) {
      formattedEdd = d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    }
  }

  const etaDays =
    shippingTracking?.shiprocketEtaDays ||
    order?.deliveryEta?.shiprocketEtaDays;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4">
        {steps.map((step, index) => {
          const stepStatus = getStepStatus(step.id);
          const Icon = step.icon;
          const isCompleted = stepStatus === "completed";
          const isActive = stepStatus === "active";

          return (
            <div
              key={step.id}
              className="relative transition-opacity duration-200">
              <div className="flex items-center gap-4">
                {/* Icon Circle */}
                <div
                  className={`relative z-10 h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isCompleted
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : isActive
                        ? "bg-amber-100 text-amber-600 border-2 border-amber-400 animate-pulse"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle size={22} className="fill-current" />
                  ) : isActive ? (
                    <Icon size={20} />
                  ) : (
                    <Circle size={20} />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-bold ${
                      isCompleted
                        ? "text-slate-900"
                        : isActive
                          ? "text-amber-800"
                          : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  {isActive && (
                    <p className="text-xs text-amber-600 font-medium mt-0.5">
                      {isScheduled && step.id === "in_transit"
                        ? `With ${shippingTracking?.courierName || order?.shipmentDetails?.courierName || "Courier Partner"}`
                        : "In progress..."}
                    </p>
                  )}
                </div>

                {/* Status Indicator */}
                {isCompleted && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center transition-opacity duration-200">
                    <CheckCircle size={14} className="text-primary" />
                  </div>
                )}
              </div>

              {/* Connecting Line */}
              {index < steps.length - 1 && (
                <div className="absolute left-[21px] top-11 bottom-0 w-0.5 -mb-4">
                  <div
                    className={`h-full w-full ${
                      isCompleted ? "bg-primary" : "bg-slate-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* ETA Display for Scheduled Shiprocket Delivery */}
      {isScheduled && status !== "delivered" && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between bg-indigo-50/80 rounded-2xl p-3.5 gap-3 border border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                <Calendar size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider leading-none mb-1">
                  Expected Delivery Date
                </p>
                <p className="text-sm font-black text-slate-900 leading-none">
                  {formattedEdd || (etaDays ? `In ~${etaDays} days` : "4-6 business days")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-800">
                {shippingTracking?.courierName || order?.shipmentDetails?.courierName || "Shiprocket"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ETA Display for Local Delivery */}
      {!isScheduled && status !== "delivered" && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between bg-amber-50 rounded-xl p-3 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                <Clock size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider leading-none mb-1">
                  Estimated Time
                </p>
                <p className="text-sm font-black text-amber-900 leading-none">{estimatedArrivalText}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <div>
                <p className="text-[10px] text-amber-600 font-semibold leading-none mb-1">Arriving in</p>
                <p className="text-lg font-black text-amber-900 leading-none">{arrivingInText}</p>
              </div>
              <div className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-amber-700 ring-1 ring-amber-200">
                Total distance: {totalDistanceText}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderProgressTracker;
