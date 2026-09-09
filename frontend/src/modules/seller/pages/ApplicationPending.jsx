import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, ShieldAlert, Store, RotateCw, Sparkles } from "lucide-react";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { onSellerApprovalStatus } from "@core/services/orderSocket";
import { toast } from "sonner";

const ApplicationPending = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role, user, isLoading, refreshUser, token } = useAuth();
  const { settings } = useSettings();
  const [isChecking, setIsChecking] = useState(false);

  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl || "";

  // Prioritize live user object status over stale location.state
  const currentStatus = user?.applicationStatus || (user?.isVerified ? "approved" : location.state?.applicationStatus || "pending");
  const isApproved =
    Boolean(user) &&
    user.isVerified === true &&
    user.isActive === true &&
    currentStatus === "approved";

  const handleApprovedTransition = () => {
    toast.success("🎉 Congratulations! Your store application has been approved by admin!", {
      duration: 5000,
    });
    navigate("/seller", { replace: true });
  };

  // If already approved on mount or state change, immediately redirect to seller dashboard
  if (!isLoading && isAuthenticated && role === "seller" && isApproved) {
    return <Navigate to="/seller" replace />;
  }

  // 1. Real-time WebSocket listener for immediate approval without reload
  useEffect(() => {
    if (!token || !isAuthenticated || role !== "seller") return;

    const cleanup = onSellerApprovalStatus(token, async (data) => {
      console.log("[SellerApplicationPending] Received approval status update:", data);
      if (data?.status === "approved" || data?.applicationStatus === "approved") {
        if (refreshUser) {
          await refreshUser();
        }
        handleApprovedTransition();
      } else if (data?.status === "rejected") {
        if (refreshUser) {
          await refreshUser();
        }
        toast.error(`Store application rejected: ${data?.reason || "Please review and re-submit."}`);
      }
    });

    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [token, isAuthenticated, role, refreshUser]);

  // 2. Active 3-second heartbeat polling fallback (in case socket reconnects)
  useEffect(() => {
    if (!isAuthenticated || role !== "seller" || isApproved) return;

    const interval = setInterval(async () => {
      try {
        if (refreshUser) {
          const freshUser = await refreshUser();
          const freshStatus = freshUser?.applicationStatus || (freshUser?.isVerified ? "approved" : "pending");
          if (freshUser?.isVerified === true && freshUser?.isActive === true && freshStatus === "approved") {
            clearInterval(interval);
            handleApprovedTransition();
          }
        }
      } catch (err) {
        console.warn("[SellerApplicationPending] Poll check error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated, role, isApproved, refreshUser]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      if (refreshUser) {
        const freshUser = await refreshUser();
        const freshStatus = freshUser?.applicationStatus || (freshUser?.isVerified ? "approved" : "pending");
        if (freshUser?.isVerified === true && freshUser?.isActive === true && freshStatus === "approved") {
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

  const isRejected = currentStatus === "rejected";
  const isStatusUnknown = !currentStatus;
  const rejectionReason = location.state?.rejectionReason || user?.rejectionReason || "";

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-['Outfit']">
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
                <Store className="h-5 w-5 text-white/80" />
              )}
              <span className="text-sm font-bold text-white/90">{appName} Seller</span>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                isRejected
                  ? "bg-rose-500/20 text-rose-200"
                  : "bg-amber-400/20 text-amber-100 animate-pulse"
              }`}
            >
              {isRejected ? <ShieldAlert className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {isRejected ? "Application Rejected" : isStatusUnknown ? "Status Unavailable" : "Application Pending"}
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
            {isRejected
              ? "Your seller application needs action."
              : isStatusUnknown
                ? "We could not verify your seller status right now."
                : "Your seller application is under review."}
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-200/90 font-medium max-w-2xl">
            {isRejected
              ? "You cannot access the seller dashboard yet. Please contact admin support and re-submit with the required details."
              : isStatusUnknown
                ? "This can happen during a temporary network issue. Please reconnect and try signing in again."
                : "Dashboard access unlocks automatically in real-time once admin approves your store — no need to log out!"}
          </p>

          {rejectionReason ? (
            <div className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              <span className="font-black uppercase tracking-widest text-[11px]">Reason</span>
              <p className="mt-1 font-medium">{rejectionReason}</p>
            </div>
          ) : null}

          {!isRejected && !isStatusUnknown ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-sm text-slate-100 flex items-start gap-3">
              <Sparkles className="h-5 w-5 mt-0.5 shrink-0 text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} />
              <div>
                <p className="font-bold text-white">
                  Live Sync Active
                </p>
                <p className="text-xs font-medium text-emerald-200/90 mt-0.5">
                  As soon as admin clicks "Approve", this page will instantly unlock your seller dashboard automatically.
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
              to="/seller/auth"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white px-5 py-3 text-sm font-black tracking-wide transition-colors border border-white/10"
            >
              Back To Seller Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ApplicationPending;
