import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Bike, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";

const ApplicationPending = () => {
  const location = useLocation();
  const { isAuthenticated, role, user, isLoading } = useAuth();
  const { settings } = useSettings();

  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl || "";

  const applicationStatus =
    location.state?.applicationStatus ||
    (user?.isVerified ? "approved" : "pending");

  if (!isLoading && isAuthenticated && role === "delivery" && user?.isVerified === true) {
    return <Navigate to="/delivery/dashboard" replace />;
  }

  const isRejected = applicationStatus === "rejected";

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
                <Bike className="h-5 w-5 text-white/80" />
              )}
              <span className="text-sm font-bold text-white/90">{appName} Delivery</span>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${isRejected
                  ? "bg-rose-500/20 text-rose-200"
                  : "bg-amber-400/20 text-amber-100"
                }`}
            >
              {isRejected ? <ShieldAlert className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {isRejected ? "Application Rejected" : "Application Pending"}
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
            {isRejected
              ? "Your delivery partner application needs action."
              : "Your delivery partner profile is pending for approval."}
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-200/90 font-medium max-w-2xl">
            {isRejected
              ? "You cannot access the delivery dashboard yet. Please contact admin or your seller and re-submit with the required details."
              : "Dashboard access unlocks automatically once your seller or admin approves your account."}
          </p>

          {!isRejected ? (
            <div className="mt-6 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-slate-200 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-emerald-400" />
              <p className="font-semibold text-slate-200">
                Approval usually takes less than 24 hours. You can return to login and try again later.
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/delivery/auth"
              className="inline-flex items-center justify-center rounded-xl bg-white text-slate-900 px-5 py-3 text-sm font-black tracking-wide hover:bg-slate-100 transition-colors"
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
