import React, { useState, useEffect } from "react";
import {
    Rocket,
    Sparkles,
    CheckCircle2,
    Clock,
    Loader2,
    ArrowRight,
    Wallet as WalletIcon,
    AlertCircle,
    Eye,
    TrendingUp,
    Star,
    Zap,
    CreditCard,
    ShieldAlert,
    ShieldCheck,
    X,
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";

const StorePromotions = () => {
    const { user } = useAuth();
    const [plans, setPlans] = useState([]);
    const [myPromotions, setMyPromotions] = useState([]);
    const [walletBalance, setWalletBalance] = useState(0);
    const [promoStatus, setPromoStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const [subscribingId, setSubscribingId] = useState(null);
    const [selectedPlanForPayment, setSelectedPlanForPayment] = useState(null);
    const [isWalletPaying, setIsWalletPaying] = useState(false);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [plansRes, walletRes, promoRes, statusRes] = await Promise.all([
                sellerApi.getStorePromotionPlans(),
                sellerApi.getWalletSummary(),
                sellerApi.getMyStorePromotions(),
                sellerApi.getStorePromotionStatus(),
            ]);

            if (plansRes.data?.success) {
                setPlans(plansRes.data.results || plansRes.data.result || []);
            }
            if (walletRes.data?.success) {
                setWalletBalance(walletRes.data.result?.availableBalance || 0);
            }
            if (promoRes.data?.success) {
                setMyPromotions(promoRes.data.results || promoRes.data.result || []);
            }
            if (statusRes.data?.success) {
                setPromoStatus(statusRes.data.result);
            }
        } catch (error) {
            console.error("Failed to load store promotion data", error);
            toast.error("Failed to load store promotions");
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

    const handlePayViaRazorpay = async (plan) => {
        try {
            setSubscribingId(plan._id);
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                toast.error("Failed to load Razorpay payment SDK");
                setSubscribingId(null);
                return;
            }

            const initRes = await sellerApi.initiateStorePromotionPurchase({ planId: plan._id });
            const data = initRes.data?.result;

            if (data?.isFree) {
                toast.success("Free Store Promotion activated! Payment Status: Paid | Campaign Status: Pending Activation");
                setSelectedPlanForPayment(null);
                fetchData();
                setSubscribingId(null);
                return;
            }

            if (!data?.orderId) {
                toast.error("Could not initiate promotion order");
                setSubscribingId(null);
                return;
            }

            const options = {
                key: data.razorpayKey || process.env.REACT_APP_RAZORPAY_KEY_ID,
                amount: data.amount,
                currency: data.currency || "INR",
                name: "SevaFast Platform",
                description: `Store Promotion: ${plan.name}`,
                order_id: data.orderId,
                handler: async (response) => {
                    try {
                        const verifyRes = await sellerApi.verifyStorePromotionPurchase({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            planId: plan._id,
                        });

                        if (verifyRes.data?.success) {
                            toast.success(
                                <div>
                                    <p className="font-bold text-sm">Payment Successful! 🎉</p>
                                    <p className="text-xs text-slate-200">
                                        Payment Status: <strong>Paid</strong> | Campaign Status: <strong>Pending Activation</strong>
                                    </p>
                                </div>
                            );
                            setSelectedPlanForPayment(null);
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
                    color: plan.displayColor || "#6366f1",
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
            console.error("Promotion purchase error", error);
            toast.error(error.response?.data?.message || "Failed to initiate promotion purchase");
            setSubscribingId(null);
        }
    };

    const handlePayViaWallet = async (plan) => {
        if (walletBalance < plan.amount) {
            toast.error(`Insufficient wallet balance. Available: ₹${walletBalance}, Required: ₹${plan.amount}`);
            return;
        }

        try {
            setIsWalletPaying(true);
            const res = await sellerApi.payStorePromotionWithWallet({ planId: plan._id });

            if (res.data?.success) {
                toast.success(
                    <div>
                        <p className="font-bold text-sm">Paid with Wallet Balance! 🎉</p>
                        <p className="text-xs text-slate-200">
                            Payment Status: <strong>Paid</strong> | Campaign Status: <strong>Pending Activation</strong>
                        </p>
                    </div>
                );
                setSelectedPlanForPayment(null);
                fetchData();
            } else {
                toast.error("Wallet payment failed");
            }
        } catch (error) {
            console.error("Wallet payment error", error);
            toast.error(error.response?.data?.message || "Failed to pay via wallet");
        } finally {
            setIsWalletPaying(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case "Active":
                return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
            case "Pending Activation":
                return "bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse";
            case "Paused":
                return "bg-blue-500/10 text-blue-600 border-blue-500/30";
            case "Completed":
                return "bg-slate-500/10 text-slate-600 border-slate-500/30";
            case "Cancelled":
                return "bg-rose-500/10 text-rose-600 border-rose-500/30";
            default:
                return "bg-slate-100 text-slate-600 border-slate-200";
        }
    };

    const activePromo = promoStatus?.activePromotion;
    const hasActive = promoStatus?.hasActivePromotion && activePromo;

    return (
        <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8 font-['Outfit'] pb-24 space-y-8">
            {/* Header Banner - Boost Your Store */}
            <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl translate-y-1/3 pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/20 border border-indigo-400/30 backdrop-blur-md rounded-full text-indigo-300 text-[11px] font-black uppercase tracking-[2px] mb-4">
                            <Rocket className="h-4 w-4 text-indigo-400 animate-bounce" />
                            🚀 Store Visibility &amp; Ads
                        </div>
                        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                            🚀 Boost Your Store
                        </h1>
                        <p className="mt-2.5 text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-xl">
                            Invest in premium store placement, featured listings, and extended customer reach to skyrocket your daily orders and brand exposure.
                        </p>
                    </div>

                    {/* Seller Wallet Balance Card */}
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-2xl sm:rounded-3xl shrink-0 min-w-[240px] shadow-inner">
                        <div className="flex items-center gap-2.5 text-slate-300 text-xs font-bold uppercase tracking-wider">
                            <WalletIcon className="h-4 w-4 text-emerald-400" />
                            <span>Seller Wallet Balance</span>
                        </div>
                        <div className="mt-2 text-3xl font-black text-white font-mono tracking-tight">
                            ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-[10px] text-slate-300 font-medium mt-1">
                            Available funds in your payout wallet
                        </p>
                    </div>
                </div>
            </div>

            {/* Loading Spinner */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="h-9 w-9 text-indigo-600 animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Promotion Status...</p>
                </div>
            ) : hasActive ? (
                /* ACTIVE OR PENDING PROMOTION VIEW (WHEN SELLER HAS ALREADY PAID / HAS ACTIVE BOOST) */
                <div className="space-y-6 max-w-3xl mx-auto">
                    {/* Active Status Alert Header */}
                    <div className={`p-6 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border relative overflow-hidden ${
                        activePromo.campaignStatus === "Active"
                            ? "bg-gradient-to-r from-emerald-600 to-teal-700 border-emerald-400/40"
                            : "bg-gradient-to-r from-amber-600 to-indigo-900 border-amber-400/40"
                    }`}>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="h-12 w-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                                <Rocket className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-3 py-0.5 rounded-full bg-white text-slate-900 text-[10px] font-black tracking-widest uppercase">
                                        {activePromo.campaignStatus === "Active" ? "CAMPAIGN LIVE" : "PENDING ACTIVATION"}
                                    </span>
                                    {promoStatus.isExpiringSoon && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black tracking-widest uppercase animate-pulse">
                                            EXPIRING SOON ({promoStatus.hoursRemaining} HRS LEFT)
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg sm:text-xl font-black text-white mt-1.5">
                                    Store Boost: {activePromo.planName}
                                </h3>
                                <p className="text-xs text-white/90 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    {activePromo.campaignStatus === "Active" && activePromo.expiresAt ? (
                                        <>Valid Until: <span className="font-mono font-bold">{new Date(activePromo.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span> ({promoStatus.daysRemaining} days remaining)</>
                                    ) : (
                                        <>Payment Status: <span className="font-bold uppercase">Paid</span> — Waiting for Admin Activation</>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Active Promotion Detail Card */}
                    <div className="bg-white border-2 border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Purchased Campaign</span>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{activePromo.planName}</h2>
                                <p className="text-xs font-bold text-slate-500 mt-1">
                                    Purchased on: <span className="font-mono text-slate-700">{activePromo.paidAt ? new Date(activePromo.paidAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : new Date(activePromo.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                                </p>
                            </div>

                            <div className="text-left sm:text-right">
                                <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">₹{activePromo.amount}</span>
                                <span className="text-xs font-bold text-slate-400 block mt-0.5">/ {activePromo.durationDays} Days Campaign</span>
                            </div>
                        </div>

                        {/* Store Boost Active Guarantee Box */}
                        <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-200/80 flex items-center gap-3.5 mb-6">
                            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0">
                                <Zap className="h-5 w-5 fill-white" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                                    {activePromo.campaignStatus === "Active" ? "Store Boost Active & Live" : "Payment Confirmed (Paid)"}
                                </h4>
                                <p className="text-xs text-indigo-800 font-semibold mt-0.5">
                                    {activePromo.campaignStatus === "Active"
                                        ? "Your store is currently boosted with priority placement, top category ranking, and increased search reach."
                                        : "Your promotion payment is verified (Paid). Admin will activate your campaign shortly!"}
                                </p>
                            </div>
                        </div>

                        {/* Active Benefits */}
                        <div className="space-y-3 mb-8">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Active Campaign Benefits</h4>
                            {(activePromo.benefits?.length ? activePromo.benefits : [
                                "Featured Store Banner on Home Page",
                                "Top Search Placement in Category",
                                "Up to 5x Increased Customer Reach",
                                "Dedicated Verified Store Badge",
                            ]).map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800">
                                    <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />
                                    </div>
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>

                        {/* Notice */}
                        <div className="pt-6 border-t border-slate-100 flex items-center gap-3 text-slate-500">
                            <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
                            <p className="text-xs font-semibold leading-relaxed">
                                You currently have an active store boost campaign. New promotion plans can be chosen once this active campaign completes.
                            </p>
                        </div>
                    </div>
                </div>
            ) : plans.length === 0 ? (
                <div className="bg-white p-8 sm:p-12 rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 text-center max-w-md mx-auto">
                    <AlertCircle className="h-10 sm:h-12 w-10 sm:w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base sm:text-lg font-black text-slate-900">No Promotion Plans Available</h3>
                    <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                        Admin has not configured any store promotion plans yet. Please check back later for exciting store boost packages!
                    </p>
                </div>
            ) : (
                /* PLAN CARDS GRID (WHEN SELLER DOES NOT HAVE AN ACTIVE CAMPAIGN) */
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900">Choose Promotion Plan</h2>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">Admin-curated packages designed for maximum conversion and reach.</p>
                        </div>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-black rounded-full border border-indigo-100">
                            {plans.length} Packages Available
                        </span>
                    </div>

                    {/* Plans Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {plans.map((plan) => {
                            const defaultBenefits = [
                                "Featured Store Banner on Home Page",
                                "Top Search Placement in Category",
                                "Up to 5x Increased Customer Reach",
                                "Dedicated Verified Store Badge",
                            ];
                            const benefitsList = plan.benefits && plan.benefits.length > 0 ? plan.benefits : defaultBenefits;

                            return (
                                <div
                                    key={plan._id}
                                    className="relative flex flex-col bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200 hover:shadow-2xl transition-all duration-300 overflow-hidden shadow-lg group"
                                    style={{ borderTop: `6px solid ${plan.displayColor || '#6366f1'}` }}
                                >
                                    {/* Top Badge Header */}
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">{plan.name}</h3>
                                        {plan.badgeText && (
                                            <span
                                                className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white rounded-full shadow-xs shrink-0 whitespace-nowrap"
                                                style={{ backgroundColor: plan.displayColor || '#6366f1' }}
                                            >
                                                {plan.badgeText}
                                            </span>
                                        )}
                                    </div>

                                    {/* Duration */}
                                    <div className="flex items-center gap-2 mt-1 text-slate-500 text-xs font-bold">
                                        <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                                        {plan.durationDays} Days Active Campaign
                                    </div>

                                    {/* Amount - Non editable by seller */}
                                    <div className="my-5 flex items-baseline gap-2">
                                        <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">₹{plan.amount}</span>
                                        <span className="text-xs font-bold text-slate-400">/ {plan.durationDays} days</span>
                                    </div>

                                    {plan.description && (
                                        <p className="text-xs font-medium text-slate-500 mb-5 leading-relaxed">{plan.description}</p>
                                    )}

                                    {/* Benefits List */}
                                    <div className="flex-1 space-y-3 mb-6 sm:mb-8">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Package Benefits</h4>
                                        {benefitsList.map((benefit, idx) => (
                                            <div key={idx} className="flex items-start gap-2.5 text-xs font-semibold text-slate-700">
                                                <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                                                <span>{benefit}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Pay Now Button */}
                                    <button
                                        onClick={() => setSelectedPlanForPayment(plan)}
                                        className="w-full py-4 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 cursor-pointer"
                                    >
                                        Pay Now (₹{plan.amount}) <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Seller Promotion Purchase History & Active Campaigns */}
            {myPromotions.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-lg sm:text-xl font-black text-slate-900">Your Store Promotions &amp; Campaigns</h3>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">Track payment and activation statuses for your store promotion orders.</p>
                        </div>
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">
                            {myPromotions.length} Total Purchased
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="py-3 px-4">Plan Name</th>
                                    <th className="py-3 px-4">Amount Paid</th>
                                    <th className="py-3 px-4">Duration</th>
                                    <th className="py-3 px-4">Payment Status</th>
                                    <th className="py-3 px-4">Campaign Status</th>
                                    <th className="py-3 px-4">Purchased On</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                {myPromotions.map((item) => (
                                    <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-4 px-4 font-black text-slate-900">
                                            {item.planName || item.plan?.name || "Promotion Plan"}
                                        </td>
                                        <td className="py-4 px-4 font-mono font-bold text-slate-900">
                                            ₹{item.amount}
                                        </td>
                                        <td className="py-4 px-4 font-medium text-slate-500">
                                            {item.durationDays} Days
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${item.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                {item.paymentStatus}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${getStatusBadgeClass(item.campaignStatus)}`}>
                                                {item.campaignStatus}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 font-mono text-slate-500 text-[11px]">
                                            {item.paidAt ? new Date(item.paidAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : new Date(item.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PAYMENT CHOICE MODAL */}
            {selectedPlanForPayment && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden">
                        <button
                            onClick={() => setSelectedPlanForPayment(null)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 text-lg font-bold"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">
                                Select Payment Method
                            </span>
                            <h3 className="text-xl font-black text-slate-900 mt-1">
                                {selectedPlanForPayment.name}
                            </h3>
                            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                                ₹{selectedPlanForPayment.amount} <span className="text-xs text-slate-400 font-normal">/ {selectedPlanForPayment.durationDays} Days</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* Option 1: Seller Wallet Balance */}
                            <div
                                onClick={() => {
                                    if (walletBalance >= selectedPlanForPayment.amount && !isWalletPaying) {
                                        handlePayViaWallet(selectedPlanForPayment);
                                    }
                                }}
                                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                    walletBalance >= selectedPlanForPayment.amount
                                        ? "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/70 hover:border-emerald-300"
                                        : "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-500 text-white shrink-0">
                                        <WalletIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                            Pay using Seller Wallet
                                        </h4>
                                        <p className="text-[11px] font-mono font-bold text-emerald-700 mt-0.5">
                                            Available Balance: ₹{walletBalance.toFixed(2)}
                                        </p>
                                        {walletBalance < selectedPlanForPayment.amount && (
                                            <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                                                Insufficient balance (Requires ₹{selectedPlanForPayment.amount})
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {walletBalance >= selectedPlanForPayment.amount && (
                                    <button
                                        disabled={isWalletPaying}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePayViaWallet(selectedPlanForPayment);
                                        }}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase rounded-xl shrink-0 transition-all"
                                    >
                                        {isWalletPaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pay via Wallet"}
                                    </button>
                                )}
                            </div>

                            {/* Option 2: Razorpay Online Gateway */}
                            <div
                                onClick={() => handlePayViaRazorpay(selectedPlanForPayment)}
                                className="p-4 rounded-2xl border bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100/70 hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between gap-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0">
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                            Pay via Razorpay Online
                                        </h4>
                                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                            UPI, Debit/Credit Card, Netbanking
                                        </p>
                                    </div>
                                </div>

                                <button
                                    disabled={subscribingId === selectedPlanForPayment._id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlePayViaRazorpay(selectedPlanForPayment);
                                    }}
                                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase rounded-xl shrink-0 transition-all"
                                >
                                    {subscribingId === selectedPlanForPayment._id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        "Pay Online"
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-400 text-xs">
                            <span className="text-[10px] font-medium">100% Secure Payment Processing</span>
                            <button
                                onClick={() => setSelectedPlanForPayment(null)}
                                className="text-[11px] font-bold text-slate-600 hover:text-slate-900"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StorePromotions;
