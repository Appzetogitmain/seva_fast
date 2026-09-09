import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bike, CheckCircle2, Clock3, ShieldAlert, RotateCw, Sparkles } from "lucide-react";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { onDeliveryApprovalStatus } from "@core/services/orderSocket";
import { toast } from "sonner";

const ApplicationPending = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role, user, isLoading, refreshUser, token } = useAuth();
  const { settings } = useSettings();
  const [isChecking, setIsChecking] = useState(false);

  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl || "";

  const isVerified = Boolean(user?.isVerified);
  const applicationStatus =
    user?.isVerified
      ? "approved"
      : location.state?.applicationStatus || "pending";

  // If already verified, immediately redirect to dashboard
  if (!isLoading && isAuthenticated && role === "delivery" && isVerified) {
    return <Navigate to="/delivery/dashboard" replace />;
  }

  const isRejected = applicationStatus === "rejected";

  const handleApprovedTransition = () => {
    toast.success("🎉 Congratulations! Your rider profile has been approved!", {
      duration: 5000,
    });
    navigate("/delivery/dashboard", { replace: true });
  };

  // 1. Real-time WebSocket listener for immediate approval without reload
  useEffect(() => {
    if (!token || !isAuthenticated || role !== "delivery") return;

    const cleanup = onDeliveryApprovalStatus(token, async (data) => {
      console.log("[DeliveryApplicationPending] Received approval status update:", data);
      if (data?.status === "approved" || data?.isVerified === true) {
        if (refreshUser) {
          await refreshUser();
        }
        handleApprovedTransition();
      } else if (data?.status === "rejected") {
        if (refreshUser) {
          await refreshUser();
        }
        toast.error("Your application was reviewed and not approved.");
      }
    });

    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [token, isAuthenticated, role, refreshUser]);

  // 2. Active 3-second heartbeat polling fallback (in case socket drops)
  useEffect(() => {
    if (!isAuthenticated || role !== "delivery" || isVerified) return;

    const interval = setInterval(async () => {
      try {
        if (refreshUser) {
          const freshUser = await refreshUser();
          if (freshUser?.isVerified === true) {
            clearInterval(interval);
            handleApprovedTransition();
          }
        }
      } catch (err) {
        console.warn("[DeliveryApplicationPending] Poll check error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated, role, isVerified, refreshUser]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      if (refreshUser) {
        const freshUser = await refreshUser();
        if (freshUser?.isVerified === true) {
          handleApprovedTransition();
          return;
        }
      }
      toast.info("Application is still under review by admin.");
    } catch {
      toast.error("Failed to check status. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] relative overflow-hidden font-['Outfit']">
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] right-[-10%] h-[420px] w-[420px] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[420px] w-[420px] rounded-full bg-brand-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-10 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2">
              {logoUrl ? (
                <img src={logoUrl} alt={`${appName} logo`} className="h-8 w-8 object-contain" />
              ) : (
                <Bike className="h-5 w-5 text-white/80" />
              )}
              <span className="text-sm font-bold text-[#F8FAFC]">{appName} Delivery</span>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                isRejected
                  ? "bg-rose-500/20 text-rose-200"
                  : "bg-amber-400/20 text-amber-100 animate-pulse"
              }`}
            >
              {isRejected ? <ShieldAlert className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {isRejected ? "Application Rejected" : "Application Pending"}
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-[#FFFFFF] leading-tight">
            {isRejected
              ? "Your delivery partner application needs action."
              : "Your delivery partner profile is under review."}
          </h1>
          <p className="mt-4 text-base md:text-lg text-[#E2E8F0] font-medium max-w-2xl">
            {isRejected
              ? "You cannot access the delivery dashboard yet. Please contact admin or your seller and re-submit with the required details."
              : "Dashboard access unlocks automatically in real-time once admin approves your account — no need to log out!"}
          </p>

          {!isRejected ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-sm text-slate-200 flex items-start gap-3">
              <Sparkles className="h-5 w-5 mt-0.5 shrink-0 text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} />
              <div>
                <p className="font-bold text-white">
                  Live Sync Active
                </p>
                <p className="text-xs font-medium text-emerald-200/90 mt-0.5">
                  As soon as admin clicks "Approve", this page will immediately unlock your delivery dashboard automatically.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
            {!isRejected && (
              <button
                type="button"
                onClick={handleManualCheck}
                disabled={isChecking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 text-sm font-black tracking-wide hover:opacity-95 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              >
                <RotateCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
                {isChecking ? "Checking Status..." : "Check Status Now"}
              </button>
            )}
            <Link
              to="/delivery/auth"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white px-5 py-3 text-sm font-black tracking-wide transition-colors border border-white/10"
            >
              Go To Delivery Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ApplicationPending;
