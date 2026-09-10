import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Sparkles } from "lucide-react";
import { useSettings } from "@core/context/SettingsContext";
import { useAuth } from "@core/context/AuthContext";
import { sellerApi } from "../services/sellerApi";

const Splash = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { isAuthenticated, role, user, token } = useAuth();
  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl || "";

  useEffect(() => {
    let isCancelled = false;

    const resolveDestination = async () => {
      const storedToken =
        token ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("auth_seller")
          : null);
      const storedPendingId =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("pending_seller_id")
          : null;

      // 1. If user is already loaded in AuthContext
      if (user && (role === "seller" || storedToken)) {
        const isApproved =
          user.isVerified === true &&
          user.isActive === true &&
          (user.applicationStatus === "approved" || !user.applicationStatus);
        return isApproved ? "/seller" : "/seller/pending-approval";
      }

      // 2. If stored pending ID exists, query live approval status
      if (storedPendingId) {
        try {
          const res = await sellerApi.checkApprovalStatus({ sellerId: storedPendingId });
          const result = res?.data?.result;
          if (result?.isApproved === true || result?.applicationStatus === "approved") {
            return "/seller";
          }
          return "/seller/pending-approval";
        } catch {
          // If check fails or network is slow, default to pending approval since they have a registered ID
          return "/seller/pending-approval";
        }
      }

      // 3. If stored token exists, verify profile
      if (storedToken) {
        try {
          const res = await sellerApi.getProfile();
          const seller = res?.data?.result;
          if (seller) {
            const isApproved =
              seller.isVerified === true &&
              seller.isActive === true &&
              (seller.applicationStatus === "approved" || !seller.applicationStatus);
            return isApproved ? "/seller" : "/seller/pending-approval";
          }
        } catch (e) {
          if (e?.response?.status === 403) {
            return "/seller/pending-approval";
          }
        }
      }

      return "/seller/auth";
    };

    const timer = setTimeout(async () => {
      try {
        const destination = await resolveDestination();
        if (!isCancelled) {
          navigate(destination, { replace: true });
        }
      } catch {
        if (!isCancelled) {
          navigate("/seller/pending-approval", { replace: true });
        }
      }
    }, 2000);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [navigate, isAuthenticated, role, user, token]);

  return (
    <div className="min-h-screen bg-[#fcfaff] flex flex-col items-center justify-between text-slate-900 relative overflow-hidden font-['Outfit']">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-brand-100/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-32 right-0 w-80 h-80 bg-slate-100/60 rounded-full blur-3xl translate-x-1/2 pointer-events-none" />

      {/* Main Brand Content */}
      <div className="z-10 flex-1 flex flex-col items-center justify-center animate-fade-in-up px-6 text-center">
        <div className="w-24 h-24 rounded-3xl bg-white shadow-xl shadow-slate-200/60 border border-slate-100 flex items-center justify-center mb-6 p-4 animate-bounce-subtle">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${appName} logo`}
              className="w-full h-full object-contain"
            />
          ) : (
            <Store size={48} className="text-slate-800" strokeWidth={1.8} />
          )}
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-700 mb-3">
          <Sparkles size={12} className="text-brand-600" />
          <span>Seller Partner Panel</span>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">
          {appName}
        </h1>
        <p className="text-base font-semibold text-slate-500 max-w-xs">
          Manage your products, live orders, and daily earnings seamlessly.
        </p>
      </div>

      {/* Footer Area - White according to theme */}
      <div className="w-full bg-white border-t border-slate-100 py-8 px-6 text-center z-10 shadow-[0_-4px_25px_rgba(0,0,0,0.03)]">
        <p className="text-lg font-black text-slate-900 tracking-tight mb-0.5">
          Empower Your Business.
        </p>
        <p className="text-sm font-bold text-slate-500">
          Sell More. Grow Faster.
        </p>

        {/* Minimal Theme Loading Dots */}
        <div className="mt-5 flex justify-center space-x-2">
          <div className="w-2.5 h-2.5 bg-slate-900 rounded-full animate-pulse" />
          <div className="w-2.5 h-2.5 bg-slate-600 rounded-full animate-pulse delay-100" />
          <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-pulse delay-200" />
        </div>
      </div>
    </div>
  );
};

export default Splash;
