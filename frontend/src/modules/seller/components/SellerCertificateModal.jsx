import React, { useState } from 'react';
import AuthorisedSellerCertificateView from '@shared/components/AuthorisedSellerCertificateView';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';
import { useAuth } from '@core/context/AuthContext';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';
import { HiCheckCircle, HiOutlineDocumentCheck } from 'react-icons/hi2';

const SellerCertificateModal = ({ seller, onAccepted }) => {
    const { updateUser, refreshUser } = useAuth();
    const [acceptedChecked, setAcceptedChecked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const shouldShow = Boolean(seller && seller.certificate && !seller.certificate.accepted);

    useLockBodyScroll(shouldShow);

    if (!shouldShow) {
        return null;
    }

    const handleAccept = async () => {
        if (!acceptedChecked) {
            toast.error('Please check the agreement box to accept your certificate.');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await sellerApi.acceptCertificate();
            toast.success('Authorised Seller Certificate accepted successfully!');
            
            const updatedCert = response.data?.result?.certificate || {
                ...(seller.certificate || {}),
                accepted: true,
                acceptedAt: new Date(),
            };

            const updatedSeller = response.data?.result?.seller || {
                ...seller,
                certificate: updatedCert,
            };

            if (updateUser) {
                updateUser({ certificate: updatedCert });
            }
            if (refreshUser) {
                await refreshUser();
            }
            if (onAccepted) {
                onAccepted(updatedSeller);
            }
        } catch (error) {
            console.error('Error accepting seller certificate:', error);
            toast.error(error.response?.data?.message || 'Failed to accept certificate');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col h-[90dvh] max-h-[90dvh] overflow-hidden border border-amber-200 animate-in fade-in zoom-in-95 duration-300">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between shrink-0 shadow">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <HiOutlineDocumentCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                                Authorised Seller Certificate & Agreement
                            </h2>
                            <p className="text-xs text-amber-100 font-medium">
                                Please review and accept your platform seller authorization before proceeding.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Certificate Display Area (Scrollable Middle) */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 bg-slate-50 overscroll-contain touch-pan-y">
                    <div className="bg-white rounded-xl p-2 sm:p-4 shadow-sm border border-slate-200">
                        <AuthorisedSellerCertificateView
                            certificate={seller.certificate}
                            seller={seller}
                            showPrintButton={true}
                        />
                    </div>
                </div>

                {/* Acceptance Form Footer */}
                <div className="p-4 sm:p-6 bg-white border-t border-slate-200 shrink-0 flex flex-col gap-4">
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-amber-50/80 border border-amber-200 hover:bg-amber-100/50 transition">
                        <input
                            type="checkbox"
                            checked={acceptedChecked}
                            onChange={(e) => setAcceptedChecked(e.target.checked)}
                            className="mt-1 h-5 w-5 rounded border-amber-400 text-orange-600 focus:ring-orange-500 cursor-pointer"
                        />
                        <span className="text-xs sm:text-sm font-medium text-slate-800 leading-snug">
                            I have carefully reviewed all details on my <strong className="text-orange-700">SEVAFAST Authorised Seller Certificate</strong> above. I hereby accept and agree to abide by all platform policies, seller authorization terms, and marketplace guidelines.
                        </span>
                    </label>

                    <div className="flex justify-end items-center gap-3">
                        <button
                            type="button"
                            onClick={handleAccept}
                            disabled={!acceptedChecked || isSubmitting}
                            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${
                                acceptedChecked && !isSubmitting
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20 active:scale-95'
                                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            {isSubmitting ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                                <>
                                    <HiCheckCircle className="w-5 h-5" />
                                    Accept & Continue to Dashboard
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SellerCertificateModal;
