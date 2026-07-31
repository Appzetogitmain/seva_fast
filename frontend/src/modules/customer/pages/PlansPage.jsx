import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, X } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useAuth } from '@/core/context/AuthContext';
import PlanCard from '@/shared/components/ui/PlanCard';
import { formatDate } from '@shared/utils/formatDate';

const DEFAULT_REFERRAL_CODE = 'SEVAFAST';

const unlockPageScroll = () => {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
};

const lockPageScroll = () => {
    document.body.style.overflow = 'hidden';
};

const normalizePlanId = (value) => {
    if (!value) return '';
    if (typeof value === 'object') {
        return String(value._id || value.id || '').trim();
    }
    return String(value).trim();
};

const PlansPage = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingPlanId, setProcessingPlanId] = useState(null);
    const [referralModalOpen, setReferralModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [referralCode, setReferralCode] = useState('');
    
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();

    useEffect(() => {
        fetchPlans();
    }, []);

    useEffect(() => {
        if (referralModalOpen) {
            lockPageScroll();
        } else {
            unlockPageScroll();
        }
        return () => {
            unlockPageScroll();
        };
    }, [referralModalOpen]);

    useEffect(() => {
        const restoreScrollOnReturn = () => {
            if (!referralModalOpen) {
                unlockPageScroll();
            }
        };

        window.addEventListener('focus', restoreScrollOnReturn);
        document.addEventListener('visibilitychange', restoreScrollOnReturn);

        return () => {
            window.removeEventListener('focus', restoreScrollOnReturn);
            document.removeEventListener('visibilitychange', restoreScrollOnReturn);
            unlockPageScroll();
        };
    }, [referralModalOpen]);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const res = await customerApi.getPlans({ forceRefresh: true });
            setPlans(res.data.results || res.data.result || []);
        } catch (error) {
            toast.error("Failed to load plans");
        } finally {
            setLoading(false);
        }
    };

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

    const resolveReferralForPurchase = () => {
        const entered = referralCode.trim().toUpperCase();
        if (!entered) return DEFAULT_REFERRAL_CODE;
        if (user?.referralCode && entered === String(user.referralCode).trim().toUpperCase()) {
            return DEFAULT_REFERRAL_CODE;
        }
        return entered;
    };

    const initiateRazorpay = async (planOverride) => {
        const plan = planOverride || selectedPlan;
        if (!plan) return;

        const codeForPurchase = resolveReferralForPurchase();

        setProcessingPlanId(plan._id || plan.id);
        
        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                toast.error("Razorpay SDK failed to load. Are you online?");
                return;
            }

            const planId = String(plan._id || plan.id || "").trim();
            if (!planId) {
                toast.error("Invalid plan selected. Please refresh and try again.");
                return;
            }

            const initRes = await customerApi.initiatePlanSubscription({
                planId,
                referralCode: codeForPurchase,
            });

            const payload = initRes.data?.result || {};
            
            if (payload.isFree) {
                toast.success("Free plan activated successfully!");
                if (refreshUser) {
                    await refreshUser();
                }
                fetchPlans();
                return;
            }

            const orderId = payload.orderId;
            const razorpayKey = payload.razorpayKey || import.meta.env.VITE_RAZORPAY_KEY_ID;

            if (!payload.success || !orderId || !razorpayKey) {
                toast.error(payload.message || initRes.data?.message || "Failed to activate plan. Please try again.");
                return;
            }

            const { amount, currency, referredBy } = payload;

            const options = {
                key: razorpayKey,
                amount,
                currency,
                name: "Seva Fast",
                description: `Subscription: ${plan.name}`,
                order_id: orderId,
                handler: async function (response) {
                    try {
                        const verifyRes = await customerApi.verifyPlanPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            planId,
                            referredBy,
                        });
                        
                        if (verifyRes.data.result) {
                            toast.success("Plan activated successfully!");
                            if (refreshUser) {
                                await refreshUser();
                            }
                            fetchPlans();
                        } else {
                            toast.error("Payment verification failed");
                        }
                    } catch (err) {
                        toast.error(err?.response?.data?.message || "Failed to verify payment");
                    } finally {
                        unlockPageScroll();
                        setSelectedPlan(null);
                        setReferralModalOpen(false);
                    }
                },
                prefill: {
                    name: user?.name || "Customer",
                    contact: user?.phone || "",
                },
                theme: {
                    color: "#0f172a",
                },
                modal: {
                    ondismiss: () => {
                        unlockPageScroll();
                        setSelectedPlan(null);
                        setReferralModalOpen(false);
                    },
                },
            };
            
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                toast.error(response.error.description || "Payment failed");
                unlockPageScroll();
                setSelectedPlan(null);
                setReferralModalOpen(false);
            });
            setReferralModalOpen(false);
            unlockPageScroll();
            rzp.open();
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                (error?.response?.status === 404
                    ? "Plan subscription API not found. Please restart the backend server."
                    : "Failed to initiate payment");
            toast.error(message);
        } finally {
            setProcessingPlanId(null);
        }
    };

    const handleSubscribeClick = (plan) => {
        setSelectedPlan(plan);
        setReferralCode('');
        setReferralModalOpen(true);
    };

    const activePlanSubscriptions = useMemo(() => {
        const now = Date.now();
        const map = new Map();

        (user?.planSubscriptions || []).forEach((subscription) => {
            const planId = normalizePlanId(subscription?.plan);
            const expiresAt = subscription?.expiresAt
                ? new Date(subscription.expiresAt).getTime()
                : 0;
            if (planId && expiresAt > now) {
                map.set(planId, subscription.expiresAt);
            }
        });

        if (map.size === 0 && user?.currentPlan) {
            const legacyPlanId = normalizePlanId(user.currentPlan);
            const legacyExpiry = user?.planExpiry
                ? new Date(user.planExpiry).getTime()
                : 0;
            if (legacyPlanId && legacyExpiry > now) {
                map.set(legacyPlanId, user.planExpiry);
            }
        }

        return map;
    }, [user]);

    const hasAnyActivePlan = activePlanSubscriptions.size > 0;

    return (
        <div className="min-h-screen bg-slate-50 pt-safe-top pb-safe-bottom pb-24 font-['Outfit',_sans-serif]">
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
                <div className="px-4 h-16 flex items-center gap-4 max-w-7xl mx-auto">
                    <button 
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-700" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">
                            {hasAnyActivePlan ? "My Subscription" : "Subscription Plans"}
                        </h1>
                        <p className="text-xs font-bold text-slate-400">
                            {hasAnyActivePlan ? "Your active plan details" : "Choose a plan to continue"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-8 max-w-7xl mx-auto">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-sm">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4"></div>
                        Loading Plans...
                    </div>
                ) : plans.length === 0 ? (
                    <div className="py-20 text-center font-bold text-slate-400 uppercase tracking-widest text-sm">
                        No active plans available
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map((plan) => {
                            const planId = normalizePlanId(plan._id || plan.id);
                            const isActivePlan = activePlanSubscriptions.has(planId);
                            const planExpiry = activePlanSubscriptions.get(planId);
                            return (
                                <div key={planId} className="relative">
                                    {processingPlanId === planId && (
                                        <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm rounded-[32px] flex items-center justify-center">
                                            <div className="w-8 h-8 border-4 border-white border-t-black rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    <div 
                                        onClick={() => !isActivePlan && handleSubscribeClick(plan)}
                                        className={isActivePlan ? "opacity-90 pointer-events-none" : "cursor-pointer"}
                                    >
                                        <PlanCard 
                                            plan={plan} 
                                            isAdmin={false} 
                                            isActive={isActivePlan}
                                            expiryDate={planExpiry}
                                        />
                                        {isActivePlan && planExpiry && (
                                            <div className="absolute top-4 right-4">
                                                <div className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[9px] font-bold text-slate-500 uppercase shadow-sm border border-slate-100">
                                                    Valid till: {formatDate(planExpiry)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {referralModalOpen && selectedPlan && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setReferralModalOpen(false)}
                                className="absolute top-6 right-6 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                            
                            <div className="mb-6">
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Enter Referral Code</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1 mb-3">
                                    <strong>{selectedPlan?.name}</strong> plan ke liye referral code daalein. Har plan purchase par code zaroori hai.
                                </p>
                                <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-3 flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-amber-600 text-xs font-black">!</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-amber-900/60 uppercase tracking-widest mb-0.5">Default Admin Code</p>
                                        <p className="text-xs font-bold text-amber-900 leading-tight">
                                            Referral nahi hai?{' '}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReferralCode(DEFAULT_REFERRAL_CODE);
                                                    toast.success('SEVAFAST code applied');
                                                }}
                                                className="font-black text-amber-700 tracking-wider hover:underline"
                                            >
                                                SEVAFAST
                                            </button>{' '}
                                            use karein — isse admin ko commission milega.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <input 
                                type="text"
                                value={referralCode}
                                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                placeholder="REFERRAL CODE (optional)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-100 transition-all uppercase tracking-widest mb-6"
                            />

                            <button 
                                type="button"
                                onClick={() => initiateRazorpay()}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                Activate Plan (₹{selectedPlan?.price})
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PlansPage;
