import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "@shared/components/ui/Modal";
import { Clock, AlertTriangle, ArrowRight, ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";

const SubscriptionExpiryModal = () => {
    const navigate = useNavigate();
    const [statusData, setStatusData] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDismissedWarning, setIsDismissedWarning] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await sellerApi.getSubscriptionStatus();
            if (res.data?.success) {
                const data = res.data.result;
                setStatusData(data);
                if (data.isExpired && data.commissionModel === "PLAN_BASED") {
                    setIsModalOpen(true);
                }
            }
        } catch (error) {
            console.error("Failed to check seller subscription status", error);
        }
    };

    const handleAcknowledgeAndSwitch = async () => {
        try {
            await sellerApi.switchToCategoryCommission();
            setIsModalOpen(false);
            toast.info("Switched to Category-Wise Commission");
            checkStatus();
        } catch (e) {
            setIsModalOpen(false);
        }
    };

    const handleGoToPlans = () => {
        setIsModalOpen(false);
        navigate("/seller/plans");
    };

    const sub = statusData?.subscription;

    return (
        <>
            {/* 24-HOUR PRE-EXPIRY WARNING BANNER */}
            {statusData?.isExpiringSoon && !isDismissedWarning && (
                <div className="bg-amber-500 text-white px-4 py-3 shadow-lg flex items-center justify-between gap-4 font-['Outfit'] relative z-40">
                    <div className="flex items-center gap-3 max-w-4xl mx-auto">
                        <AlertTriangle className="h-5 w-5 shrink-0 animate-bounce" />
                        <p className="text-xs md:text-sm font-bold">
                            Warning: Your plan <span className="underline font-black">{sub?.planName}</span> will expire in{" "}
                            <span className="bg-black/20 px-2 py-0.5 rounded font-mono">{statusData.hoursRemaining} hours</span> (
                            {sub?.expiresAt ? new Date(sub.expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}).
                            Renew now to retain 0% commission!
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGoToPlans}
                            className="px-4 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition-all shrink-0"
                        >
                            Renew Plan
                        </button>
                        <button
                            onClick={() => setIsDismissedWarning(true)}
                            className="text-white/80 hover:text-white p-1 text-xs font-bold"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* HARD EXPIRY MODAL POPUP */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Subscription Plan Expired">
                <div className="py-2 space-y-6 font-['Outfit']">
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-4">
                        <div className="p-3 bg-rose-500 text-white rounded-xl shadow-md shadow-rose-200">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-rose-900">Plan Expired</h4>
                            <p className="text-xs text-rose-700 font-medium">
                                Your plan <span className="font-bold">{sub?.planName}</span> expired on{" "}
                                {sub?.expiresAt ? new Date(sub.expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}.
                            </p>
                        </div>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Your store has automatically reverted to standard <span className="font-bold text-slate-900">Category-Wise Commission (%)</span> set by the platform Admin. Purchase a new subscription plan anytime to reactivate 0% commission!
                    </p>

                    <div className="flex flex-col gap-3 pt-2">
                        <button
                            onClick={handleGoToPlans}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                        >
                            Choose Plan & Subscribe <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleAcknowledgeAndSwitch}
                            className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                        >
                            Continue with Category-Wise Commission
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default SubscriptionExpiryModal;
