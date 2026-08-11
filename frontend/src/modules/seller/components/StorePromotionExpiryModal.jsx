import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "@shared/components/ui/Modal";
import { AlertTriangle, ArrowRight, ShieldAlert, Rocket, X } from "lucide-react";
import { sellerApi } from "../services/sellerApi";

const StorePromotionExpiryModal = () => {
    const navigate = useNavigate();
    const [statusData, setStatusData] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDismissedWarning, setIsDismissedWarning] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await sellerApi.getStorePromotionStatus();
            if (res.data?.success) {
                const data = res.data.result;
                setStatusData(data);
                if (data.isExpired && data.justExpiredPromotion) {
                    setIsModalOpen(true);
                }
            }
        } catch (error) {
            console.error("Failed to check seller promotion status", error);
        }
    };

    const handleGoToPromotions = () => {
        setIsModalOpen(false);
        navigate("/seller/promotions");
    };

    const promo = statusData?.activePromotion || statusData?.justExpiredPromotion;

    return (
        <>
            {/* 24-HOUR PRE-EXPIRY WARNING BANNER */}
            {statusData?.isExpiringSoon && !isDismissedWarning && (
                <div className="bg-indigo-900 text-white px-4 py-3 shadow-xl flex items-center justify-between gap-4 font-['Outfit'] border-b border-indigo-500/30 relative z-40">
                    <div className="flex items-center gap-3 max-w-4xl mx-auto">
                        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 animate-bounce" />
                        <p className="text-xs md:text-sm font-bold">
                            Notice: Your store promotion <span className="underline font-black text-indigo-200">{promo?.planName}</span> will expire in{" "}
                            <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-mono">{statusData.hoursRemaining} hours</span>.
                            Renew now to maintain top search rankings &amp; featured placement!
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGoToPromotions}
                            className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer shadow-md"
                        >
                            🚀 Renew Boost
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

            {/* EXPIRY ALERT MODAL POPUP */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Store Promotion Expired">
                <div className="py-2 space-y-6 font-['Outfit']">
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
                            <Rocket className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-indigo-950">Store Boost Completed</h4>
                            <p className="text-xs text-indigo-700 font-medium">
                                Your campaign <span className="font-bold">{promo?.planName}</span> has expired.
                            </p>
                        </div>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Your store boost duration has ended. To continue receiving featured home page placement, top search rankings, and multi-fold customer reach, you can easily purchase a new promotion plan anytime!
                    </p>

                    <div className="flex flex-col gap-3 pt-2">
                        <button
                            onClick={handleGoToPromotions}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 cursor-pointer"
                        >
                            🚀 Boost Store Again <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                        >
                            Exit / Close
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default StorePromotionExpiryModal;
