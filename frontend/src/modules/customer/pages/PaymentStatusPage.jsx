import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2, AlertTriangle, ArrowRight, RefreshCcw } from "lucide-react";
import { customerApi } from "../services/customerApi";
import { useToast } from "@shared/components/ui/Toast";
import Button from "@shared/components/ui/Button";
import { useAuth } from "@/core/context/AuthContext";

const PaymentStatusPage = () => {
    const { t } = useTranslation('customer');
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user, login } = useAuth();
    
    const merchantOrderId = searchParams.get("merchantOrderId");
    const type = searchParams.get("type");
    const planId = searchParams.get("planId");
    const referredBy = searchParams.get("referredBy");
    const [status, setStatus] = useState("verifying"); // verifying, success, failure, timeout
    const [orderDetails, setOrderDetails] = useState(null);
    const [error, setError] = useState("");
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 10;
    const pollInterval = useRef(null);

    const verifyPayment = async () => {
        if (!merchantOrderId) {
            setStatus("failure");
            setError(t('paymentStatus.errors.missingOrder'));
            return;
        }

        try {
            let response;
            if (type === "plan") {
                response = await customerApi.verifyPlanPayment({ merchantOrderId, planId, referredBy });
                if (response.data.success) {
                    setStatus("success");
                    if (pollInterval.current) clearInterval(pollInterval.current);
                    
                    const updatedUser = response.data.result;
                    if (user && login) login({ ...user, ...updatedUser, token: user.token });

                    setTimeout(() => {
                        navigate(`/`, { replace: true });
                    }, 4000);
                }
            } else {
                response = await customerApi.verifyPaymentStatus(merchantOrderId);
                if (response.data.success) {
                    const paymentStatus = response.data.result.status;
                    const payment = response.data.result.payment;
                    setOrderDetails(payment);

                    if (paymentStatus === "CAPTURED") {
                        setStatus("success");
                        if (pollInterval.current) clearInterval(pollInterval.current);
                        
                        setTimeout(() => {
                            const targetId = payment.checkoutGroupId || payment.publicOrderId || payment.order;
                            navigate(`/orders/${targetId}`, { replace: true });
                        }, 4000);
                    } else if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
                        setStatus("failure");
                        if (pollInterval.current) clearInterval(pollInterval.current);
                    } else {
                        setRetryCount(prev => prev + 1);
                    }
                }
            }
        } catch (err) {
            console.error("Verification error:", err);
            const statusCode = err?.response?.status;
            const isNetworkError = !err?.response;

            if (isNetworkError) {
                setStatus("timeout");
                setError(t('paymentStatus.errors.network'));
                if (pollInterval.current) clearInterval(pollInterval.current);
                return;
            }

            if (statusCode === 401) {
                setStatus("failure");
                setError(t('paymentStatus.errors.session'));
                if (pollInterval.current) clearInterval(pollInterval.current);
                return;
            }

            // If it's a 404, the order might not have been recorded yet or webhook not reached
            setRetryCount(prev => prev + 1);
        }
    };

    useEffect(() => {
        if (merchantOrderId) {
            verifyPayment();
            pollInterval.current = setInterval(() => {
                setRetryCount(prev => {
                    if (prev >= maxRetries) {
                        setStatus("timeout");
                        if (pollInterval.current) clearInterval(pollInterval.current);
                        return prev;
                    }
                    verifyPayment();
                    return prev;
                });
            }, 3000);
        } else {
            setStatus("failure");
            setError(t('paymentStatus.errors.invalidRef'));
        }

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [merchantOrderId]);

    const handleManualRetry = () => {
        setRetryCount(0);
        setStatus("verifying");
        verifyPayment();
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200 border border-slate-100 text-center relative overflow-hidden"
            >
                {/* Status-specific background elements */}
                <AnimatePresence mode="wait">
                    {status === 'success' && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl pointer-events-none"
                        />
                    )}
                    {(status === 'failure' || status === 'timeout') && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute -top-24 -right-24 w-64 h-64 bg-rose-50 rounded-full blur-3xl pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                <div className="relative z-10">
                    {/* Icon Section */}
                    <div className="mb-8 flex justify-center">
                        <AnimatePresence mode="wait">
                            {status === "verifying" && (
                                <motion.div 
                                    key="verifying"
                                    initial={{ scale: 0.5, rotate: 0 }}
                                    animate={{ scale: 1, rotate: 360 }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                    transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" } }}
                                    className="w-20 h-20 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center shadow-inner"
                                >
                                    <Loader2 size={40} />
                                </motion.div>
                            )}

                            {status === "success" && (
                                <motion.div 
                                    key="success"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", damping: 12 }}
                                    className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-100/50"
                                >
                                    <Check size={40} strokeWidth={3} />
                                </motion.div>
                            )}

                            {status === "failure" && (
                                <motion.div 
                                    key="failure"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-100/50"
                                >
                                    <X size={40} strokeWidth={3} />
                                </motion.div>
                            )}

                            {status === "timeout" && (
                                <motion.div 
                                    key="timeout"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-100/50"
                                >
                                    <AlertTriangle size={40} strokeWidth={3} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Text Section */}
                    <AnimatePresence mode="wait">
                        {status === "verifying" && (
                            <motion.div key="text-verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <h1 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">{t('paymentStatus.verifying')}</h1>
                                <p className="text-slate-500 text-sm font-medium">{t('paymentStatus.verifyingSub')}</p>
                                <div className="mt-6 flex justify-center gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                            className="w-2 h-2 bg-brand-400 rounded-full"
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {status === "success" && (
                            <motion.div key="text-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <h1 className="text-2xl font-[1000] text-slate-800 mb-2 uppercase tracking-tight">{t('paymentStatus.confirmed')}</h1>
                                <p className="text-emerald-600 text-sm font-black mb-6 uppercase tracking-wider">{t('paymentStatus.successful')}</p>
                                <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('paymentStatus.orderId')}</span>
                                        <span className="text-xs font-black text-slate-700">#{merchantOrderId?.slice(-8).toUpperCase()}</span>
                                    </div>
                                    <div className="h-px bg-slate-200 my-2" />
                                    <p className="text-[11px] text-slate-500 font-medium">{t('paymentStatus.redirecting')}</p>
                                </div>
                                <Button 
                                        onClick={() => navigate(type === 'plan' ? '/' : '/orders')}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2"
                                    >
                                        {type === 'plan' ? t('checkout.startShopping') : t('paymentStatus.goToOrders')} <ArrowRight size={18} />
                                    </Button>
                            </motion.div>
                        )}

                        {status === "failure" && (
                            <motion.div key="text-failure" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <h1 className="text-2xl font-[1000] text-slate-800 mb-2 uppercase tracking-tight">{t('paymentStatus.failed')}</h1>
                                <p className="text-rose-600 text-sm font-black mb-6 uppercase tracking-wider">{error || t('paymentStatus.rejected')}</p>
                                <p className="text-slate-500 text-sm font-medium mb-8">{t('paymentStatus.failedSub')}</p>
                                <div className="flex flex-col gap-3">
                                    <Button 
                                        onClick={() => navigate(type === 'plan' ? '/plans' : '/checkout')}
                                        className="w-full bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl"
                                    >
                                        {t('paymentStatus.tryAgain')}
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        onClick={() => navigate('/')}
                                        className="w-full border-slate-200 text-slate-600 font-bold h-12 rounded-xl"
                                    >
                                        {t('common:unavailable.backHome')}
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {status === "timeout" && (
                            <motion.div key="text-timeout" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <h1 className="text-2xl font-[1000] text-slate-800 mb-2 uppercase tracking-tight">{t('paymentStatus.pending')}</h1>
                                <p className="text-amber-600 text-sm font-black mb-6 uppercase tracking-wider">{t('paymentStatus.awaiting')}</p>
                                <div className="bg-amber-50 rounded-2xl p-4 mb-8 border border-amber-100 flex items-start gap-3 text-left">
                                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                        {t('paymentStatus.pendingSub')}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <Button 
                                        onClick={handleManualRetry}
                                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2"
                                    >
                                        <RefreshCcw size={18} /> {t('common:unavailable.checkAgain')}
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        onClick={() => navigate('/orders')}
                                        className="w-full border-slate-200 text-slate-600 font-bold h-12 rounded-xl"
                                    >
                                        {t('paymentStatus.viewHistory')}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Progress bar for verification */}
                {status === "verifying" && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
                        <motion.div 
                            className="h-full bg-brand-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${(retryCount / maxRetries) * 100}%` }}
                        />
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default PaymentStatusPage;
