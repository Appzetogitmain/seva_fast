import React from 'react';
import { HiPrinter } from 'react-icons/hi2';
import { useSettings } from '@core/context/SettingsContext';

const AuthorisedSellerCertificateView = ({ certificate, seller, showPrintButton = true }) => {
    const { settings } = useSettings();
    const signatureImageUrl = settings?.signatureImageUrl;
    const sealImageUrl = settings?.sealImageUrl;

    const targetCert = certificate || seller?.certificate || {};
    const targetSeller = seller || {};

    const cleanStr = (val, fallback = '') => {
        if (!val || val === '-' || String(val).trim() === '') return fallback;
        return String(val).trim();
    };

    const sellerCodeRaw = cleanStr(targetCert.sellerId) || cleanStr(targetSeller.sellerCode) || (targetSeller._id ? `SF-${String(targetSeller._id).slice(-6).toUpperCase()}` : '');
    const certNoRaw = cleanStr(targetCert.certificateNo);

    const certificateNo = certNoRaw || (sellerCodeRaw ? `SF-AS-${String(sellerCodeRaw).replace(/[^a-zA-Z0-9]/g, '')}` : 'SF-AS-PENDING');
    const sellerId = cleanStr(targetCert.sellerId) || cleanStr(targetSeller.sellerCode) || (targetSeller._id ? `SF-${String(targetSeller._id).slice(-6).toUpperCase()}` : 'SF-PENDING');

    const sellerName = cleanStr(targetCert.sellerName) || cleanStr(targetSeller.name) || cleanStr(targetSeller.ownerName) || 'Registered Seller';
    const shopName = cleanStr(targetCert.shopName) || cleanStr(targetSeller.shopName) || 'Registered Store';
    const category = cleanStr(targetCert.category) || cleanStr(targetSeller.category) || 'General Category';
    const cityLocation = cleanStr(targetCert.cityLocation) || cleanStr(targetSeller.city) || cleanStr(targetSeller.address) || cleanStr(targetSeller.locality) || cleanStr(targetSeller.state) || 'Registered Location';

    const defaultToday = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const defaultNextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const issueDate = cleanStr(targetCert.issueDate) || (targetSeller.reviewedAt ? new Date(targetSeller.reviewedAt).toLocaleDateString('en-IN') : defaultToday);
    const validFrom = cleanStr(targetCert.validFrom) || issueDate;
    const validUntil = cleanStr(targetCert.validUntil) || defaultNextYear;
    const signatoryName = cleanStr(targetCert.signatoryName) || 'SEVAFAST Operations';
    const accepted = Boolean(targetCert.accepted);
    const acceptedAt = targetCert.acceptedAt || null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="w-full flex flex-col items-center">
            {showPrintButton && (
                <div className="w-full max-w-3xl flex justify-end mb-4 print:hidden">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg shadow hover:from-amber-600 hover:to-orange-600 transition"
                    >
                        <HiPrinter className="w-5 h-5" />
                        Print / Save as PDF
                    </button>
                </div>
            )}

            {/* Print-friendly container */}
            <div className="certificate-print-area w-full max-w-3xl bg-white p-6 sm:p-10 border-[3px] border-amber-500 rounded-xl shadow-2xl relative text-slate-800 text-sm font-sans print:border-2 print:shadow-none print:max-w-none print:w-full print:p-6">
                {/* Outer decorative line */}
                <div className="border border-amber-300 p-4 sm:p-6 rounded-lg h-full flex flex-col justify-between">
                    
                    {/* Header with Logo */}
                    <div className="text-center mb-6">
                        <div className="flex justify-center items-center mb-2">
                            {/* SEVAFAST Runner Logo graphic */}
                            <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-md">
                                <svg className="w-9 h-9 text-white fill-current" viewBox="0 0 24 24">
                                    <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-orange-600 uppercase">
                            SEVAFAST
                        </h1>
                        <h2 className="text-xl sm:text-2xl font-bold text-amber-700 tracking-wide mt-1 uppercase">
                            AUTHORISED SELLER CERTIFICATE
                        </h2>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                            Verified Marketplace Seller
                        </p>
                    </div>

                    {/* Certification Text */}
                    <p className="text-xs sm:text-sm text-center text-slate-600 leading-relaxed max-w-2xl mx-auto mb-6">
                        This is to certify that the seller named below has successfully completed the SEVAFAST seller onboarding and verification process and is authorised to sell approved products/services on the SEVAFAST platform, subject to the applicable Seller Terms, policies and verification requirements.
                    </p>

                    {/* Main Details Table */}
                    <div className="border border-slate-300 rounded-lg overflow-hidden mb-6 text-xs sm:text-sm">
                        <div className="grid grid-cols-3 border-b border-slate-200">
                            <div className="p-2.5 sm:p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                                Certificate No.
                            </div>
                            <div className="p-2.5 sm:p-3 col-span-2 font-bold text-slate-900">
                                {certificateNo}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 border-b border-slate-200">
                            <div className="p-2.5 sm:p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                                Seller ID
                            </div>
                            <div className="p-2.5 sm:p-3 col-span-2 font-bold text-slate-900">
                                {sellerId}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 border-b border-slate-200">
                            <div className="p-2.5 sm:p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                                Seller / Owner Name
                            </div>
                            <div className="p-2.5 sm:p-3 col-span-2 font-bold text-slate-900">
                                {sellerName}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 border-b border-slate-200">
                            <div className="p-2.5 sm:p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                                Shop / Business Name
                            </div>
                            <div className="p-2.5 sm:p-3 col-span-2 font-bold text-slate-900">
                                {shopName}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 border-b border-slate-200">
                            <div className="p-2.5 sm:p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                                Business Category
                            </div>
                            <div className="p-2.5 sm:p-3 col-span-2 font-bold text-slate-900">
                                {category}
                            </div>
                        </div>

                        <div className="grid grid-cols-3">
                            <div className="p-2.5 sm:p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">
                                Registered City / Location
                            </div>
                            <div className="p-2.5 sm:p-3 col-span-2 font-bold text-slate-900">
                                {cityLocation}
                            </div>
                        </div>
                    </div>

                    {/* Dates Section */}
                    <div className="border border-amber-400 rounded-lg p-3 mb-2 bg-amber-50/50">
                        <div className="grid grid-cols-3 text-center divide-x divide-amber-300">
                            <div>
                                <div className="text-[11px] font-bold text-amber-900 uppercase">ISSUE DATE</div>
                                <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">{issueDate}</div>
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-amber-900 uppercase">VALID FROM</div>
                                <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">{validFrom}</div>
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-amber-900 uppercase">VALID UNTIL</div>
                                <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">{validUntil}</div>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-center text-slate-500 italic mb-6">
                        Recommended validity: 12 months from the approval / issue date, unless suspended, cancelled, or replaced earlier by SEVAFAST.
                    </p>

                    {/* Authorised Seller Status Section */}
                    <div className="text-center mb-6">
                        <h3 className="text-base sm:text-lg font-extrabold text-emerald-700 uppercase tracking-wide mb-1">
                            AUTHORISED SELLER STATUS
                        </h3>
                        <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
                            The above seller is authorised to operate as a SEVAFAST marketplace seller for the approved seller account and product categories. This certificate is a platform-issued seller authorization document and is not a government license, statutory registration, or regulatory certificate.
                        </p>
                    </div>

                    {/* Signatory & Official Seal Boxes */}
                    <div className="grid grid-cols-2 gap-4 mb-6 text-center text-xs">
                        <div className="border border-slate-300 rounded-lg p-4 flex flex-col justify-between items-center min-h-[110px]">
                            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                                SEVAFAST AUTHORIZED SIGNATORY
                            </div>
                            {signatureImageUrl ? (
                                <img src={signatureImageUrl} alt="Authorised signatory signature" className="h-10 object-contain my-1" />
                            ) : (
                                <div className="w-3/4 border-b border-slate-400 my-2"></div>
                            )}
                            <div className="font-semibold text-slate-700">{signatoryName}</div>
                        </div>

                        <div className="border border-slate-300 rounded-lg p-4 flex flex-col justify-between items-center min-h-[110px] relative">
                            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                                OFFICIAL SEAL / STAMP
                            </div>
                            {sealImageUrl ? (
                                <img src={sealImageUrl} alt="SEVAFAST official seal" className="h-14 w-14 object-contain my-1" />
                            ) : (
                                /* Decorative Stamp Seal (placeholder until admin uploads the official seal) */
                                <div className="w-14 h-14 rounded-full border-2 border-dashed border-orange-500/60 flex items-center justify-center text-[9px] font-black text-orange-600 uppercase transform -rotate-12 opacity-80 my-1">
                                    SEVAFAST VERIFIED
                                </div>
                            )}
                            <div className="w-3/4 border-b border-slate-300"></div>
                        </div>
                    </div>

                    {/* Acceptance Badge if Accepted */}
                    {accepted && (
                        <div className="mb-4 p-2 bg-emerald-50 border border-emerald-200 rounded-md text-center text-emerald-700 text-xs font-semibold">
                            ✓ Certificate Accepted by Seller on {acceptedAt ? new Date(acceptedAt).toLocaleDateString("en-IN") : "Record"}
                        </div>
                    )}

                    {/* Footer Verification Notice */}
                    <div className="text-[10px] text-slate-400 text-center leading-normal border-t border-slate-200 pt-3">
                        Verification: Certificate No. / Seller ID may be used by SEVAFAST for internal verification. Certificate validity should be checked against the SEVAFAST seller records.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthorisedSellerCertificateView;
