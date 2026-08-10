import React, { useState, useEffect } from "react";
import { Sparkles, CheckCircle2, ShieldCheck, Clock, Loader2, ArrowRight, Store, AlertCircle, RefreshCw, Check, Zap } from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";

const SellerPlans = () => {
    const { user } = useAuth();
    const [plans, setPlans] = useState([]);
    const [statusData, setStatusData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [subscribingId, setSubscribingId] = useState(null);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [plansRes, statusRes] = await Promise.all([
                sellerApi.getPlans(),
                sellerApi.getSubscriptionStatus(),
            ]);

            if (plansRes.data?.success) {
                setPlans(plansRes.data.results || plansRes.data.result || []);
            }
            if (statusRes.data?.success) {
                setStatusData(statusRes.data.result);
            }
        } catch (error) {
            console.error("Failed to load seller subscription data", error);
            toast.error("Failed to load subscription plans");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleSubscribe = async (plan) => {
        try {
            setSubscribingId(plan._id);
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                toast.error("Failed to load Razorpay payment SDK");
                setSubscribingId(null);
                return;
            }

            const initRes = await sellerApi.initiatePlanPurchase({ planId: plan._id });
            const data = initRes.data?.result;

            if (data?.isFree) {
                toast.success("Free Seller Subscription Plan activated!");
                fetchData();
                setSubscribingId(null);
                return;
            }

            if (!data?.orderId) {
                toast.error("Could not initiate payment order");
                setSubscribingId(null);
                return;
            }

            const options = {
                key: data.razorpayKey || process.env.REACT_APP_RAZORPAY_KEY_ID,
                amount: data.amount,
                currency: data.currency || "INR",
                name: "SevaFast Platform",
                description: `Seller Subscription: ${plan.name}`,
                order_id: data.orderId,
                handler: async (response) => {
                    try {
                        const verifyRes = await sellerApi.verifyPlanPurchase({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            planId: plan._id,
                        });

                        if (verifyRes.data?.success) {
                            toast.success("Subscription Plan purchased successfully! 0% Commission Activated.");
                            fetchData();
                        } else {
                            toast.error("Payment verification failed");
                        }
                    } catch (verifyErr) {
                        toast.error(verifyErr.response?.data?.message || "Payment verification failed");
                    } finally {
                        setSubscribingId(null);
                    }
                },
                prefill: {
                    name: user?.name || user?.shopName || "",
                    email: user?.email || "",
                    contact: user?.phone || "",
                },
                theme: {
                    color: plan.displayColor || "#0ea5e9",
                },
                modal: {
                    ondismiss: () => {
                        setSubscribingId(null);
                        toast.info("Payment cancelled");
                    },
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            console.error("Subscription initiation error", error);
            toast.error(error.response?.data?.message || "Failed to initiate subscription");
            setSubscribingId(null);
        }
    };

    const handleSwitchToCommission = async () => {
        if (!window.confirm("Are you sure you want to switch to Category-Wise Commission? Orders will incur standard category commission fees.")) return;
        try {
            await sellerApi.switchToCategoryCommission();
            toast.success("Switched to Category-Wise Commission");
            fetchData();
        } catch (e) {
            toast.error("Failed to switch model");
        }
    };

    const sub = statusData?.subscription;
    const isPlanActive = statusData?.status === "active";
    const isExpiringSoon = statusData?.isExpiringSoon;
    const activePlanObj = plans.find((p) => p._id === sub?.planId);

    return (
        <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8 font-['Outfit'] pb-24">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-black text-white p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden mb-6 sm:mb-8">
                <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-amber-500/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none" />
                <div className="relative z-10 max-w-2xl">
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] sm:text-[10px] font-black uppercase tracking-[2px] rounded-full inline-block mb-3 shadow-xs">
                        0% Order Commission Passes
                    </span>
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                        Seller Subscription Plans
                    </h1>
                    <p className="mt-2 text-slate-300 text-xs sm:text-sm font-medium leading-relaxed">
                        Eliminate per-order commission fees! Choose a plan according to your preferred validity duration and keep 100% of your earnings.
                    </p>
                </div>
            </div>

            {/* Loading Indicator */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="h-8 w-8 text-slate-900 animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Seller Plans...</p>
                </div>
            ) : isPlanActive && sub ? (
                /* ONLY SHOW ACTIVE PLAN VIEW WHEN ACTIVE PLAN EXISTS */
                <div className="space-y-6 max-w-3xl mx-auto">
                    {/* Active Status Alert Header */}
                    <div className="p-4 sm:p-6 bg-emerald-500 text-white rounded-2xl sm:rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-emerald-400/40 relative overflow-hidden">
                        <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                            <div className="h-12 w-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                                <ShieldCheck className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2.5 py-0.5 rounded-full bg-white text-emerald-800 text-[9px] font-black tracking-widest uppercase">
                                        ACTIVE PASS
                                    </span>
                                    {isExpiringSoon && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black tracking-widest uppercase animate-pulse">
                                            EXPIRING SOON ({statusData.hoursRemaining} HRS LEFT)
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                                    0% Commission Active: {sub.planName}
                                </h3>
                                <p className="text-xs text-emerald-100 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <Clock className="h-3.5 w-3.5 text-emerald-200 shrink-0" />
                                    Valid Until: <span className="font-mono font-bold text-white">{new Date(sub.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span> ({statusData.daysRemaining} days remaining)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Active Plan Detail Card */}
                    <div className="bg-white border-2 border-emerald-500/40 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Current Subscription</span>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{sub.planName}</h2>
                                <p className="text-xs font-bold text-slate-500 mt-1">
                                    Purchased on: <span className="font-mono text-slate-700">{sub.purchasedAt ? new Date(sub.purchasedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'N/A'}</span>
                                </p>
                            </div>

                            <div className="text-left sm:text-right">
                                <span className="text-3xl sm:text-4xl font-black text-slate-900">₹{sub.pricePaid ?? activePlanObj?.price ?? 0}</span>
                                <span className="text-xs font-bold text-slate-400 block mt-0.5">/ {sub.validityDays || activePlanObj?.validityDays || 30} Days</span>
                            </div>
                        </div>

                        {/* 0% Commission Guarantee Box */}
                        <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 flex items-center gap-3.5 mb-6">
                            <div className="p-2.5 bg-emerald-500 text-white rounded-xl shrink-0">
                                <Zap className="h-5 w-5 fill-white" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">0% Commission Guarantee Enabled</h4>
                                <p className="text-xs text-emerald-800 font-semibold mt-0.5">
                                    You receive 100% of product order subtotal. Zero commission is deducted by the platform.
                                </p>
                            </div>
                        </div>

                        {/* Active Features */}
                        <div className="space-y-3 mb-8">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Included Pass Benefits</h4>
                            {(activePlanObj?.features || ["0% Commission on all orders", "Unlimited Order Acceptances", "Priority Store Search Listing"]).map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800">
                                    <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                                    </div>
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>

                        {/* Plan Expiry Notice */}
                        <div className="pt-6 border-t border-slate-100 flex items-center gap-3 text-slate-500">
                            <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                            <p className="text-xs font-semibold leading-relaxed">
                                Your 0% Commission Pass is currently active and locked until <span className="font-bold text-slate-900">{new Date(sub.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>. You will automatically switch to Category Commission once expired, after which new plans can be chosen.
                            </p>
                        </div>
                    </div>
                </div>
            ) : plans.length === 0 ? (
                <div className="bg-white p-8 sm:p-12 rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 text-center max-w-md mx-auto">
                    <AlertCircle className="h-10 sm:h-12 w-10 sm:w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base sm:text-lg font-black text-slate-900">No Active Plans Available</h3>
                    <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                        Admin hasn't configured active seller subscription plans yet. You are currently on standard Category-Wise Commission.
                    </p>
                </div>
            ) : (
                /* Plan Cards Grid for Sellers WITHOUT an active plan */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {plans.map((plan) => {
                        return (
                            <div
                                key={plan._id}
                                className="relative flex flex-col bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200 hover:shadow-2xl transition-all duration-300 overflow-hidden shadow-lg"
                                style={{ borderTop: `6px solid ${plan.displayColor || '#0ea5e9'}` }}
                            >
                                {/* Top Badge Header */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">{plan.name}</h3>
                                    {plan.badgeText && (
                                        <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white rounded-full shadow-xs shrink-0 whitespace-nowrap">
                                            {plan.badgeText}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-slate-500 text-xs font-bold">
                                    <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                                    {plan.validityDays} Days Pass ({Math.round(plan.validityDays / 30) || 1} Months)
                                </div>

                                {/* Pricing */}
                                <div className="my-5 flex items-baseline gap-2">
                                    <span className="text-3xl sm:text-4xl font-black text-slate-900">₹{plan.price}</span>
                                    {plan.originalPrice && (
                                        <span className="text-xs sm:text-sm font-bold text-slate-400 line-through">₹{plan.originalPrice}</span>
                                    )}
                                    <span className="text-xs font-bold text-slate-400">/ {plan.validityDays} days</span>
                                </div>

                                {plan.description && (
                                    <p className="text-xs font-medium text-slate-500 mb-5 leading-relaxed">{plan.description}</p>
                                )}

                                {/* 0% Commission Highlight */}
                                <div className="p-3 sm:p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3 mb-5">
                                    <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-emerald-900 uppercase tracking-wide">0% Order Commission</p>
                                        <p className="text-[10px] text-emerald-700 font-medium">Keep 100% of order payouts</p>
                                    </div>
                                </div>

                                {/* Feature List */}
                                <div className="flex-1 space-y-2.5 mb-6 sm:mb-8">
                                    {Array.isArray(plan.features) && plan.features.map((feature, idx) => (
                                        <div key={idx} className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Purchase Button */}
                                <button
                                    onClick={() => handleSubscribe(plan)}
                                    disabled={subscribingId === plan._id}
                                    className="w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                                >
                                    {subscribingId === plan._id ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                                        </>
                                    ) : (
                                        <>
                                            Choose Plan &amp; Subscribe <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SellerPlans;
