import React from 'react';
import { ChevronLeft, Shield } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';
import {
    getLegalAudienceLabel,
    getLegalContent,
    isHtmlLegalContent,
    normalizeLegalAudience,
    splitLegalParagraphs,
} from '@/shared/utils/legalContent';
import { formatDate } from '@shared/utils/formatDate';

const PrivacyPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { settings } = useSettings();
    const audience = normalizeLegalAudience(searchParams.get('for') || searchParams.get('audience'));
    const audienceLabel = getLegalAudienceLabel(audience);
    const appName = settings?.appName || 'App';
    const companyName = settings?.companyName || appName;
    const adminPrivacy = getLegalContent(settings, audience, 'privacy');
    const updatedAt = settings?.updatedAt ? formatDate(settings.updatedAt, null) : null;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-10">
            <div className="bg-white sticky top-0 z-30 px-4 py-3 flex items-center gap-1 shadow-sm">
                <button
                    onClick={() => window.history.length > 2 ? navigate(-1) : window.close() || navigate('/')}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                    <ChevronLeft size={24} className="text-slate-600" />
                </button>
                <h1 className="text-lg font-black text-slate-800">Privacy Policy</h1>
            </div>

            <div className="p-5 max-w-3xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-primary">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{audienceLabel} Privacy Policy</h2>
                            <p className="text-xs text-slate-500 font-medium">
                                {updatedAt ? `Last updated: ${updatedAt}` : `Published by ${companyName}`}
                            </p>
                        </div>
                    </div>

                    <div className="prose prose-slate prose-sm max-w-none text-slate-600 space-y-4">
                        {adminPrivacy ? (
                            isHtmlLegalContent(adminPrivacy) ? (
                                <div
                                    className="whitespace-pre-wrap leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                    dangerouslySetInnerHTML={{ __html: adminPrivacy }}
                                />
                            ) : (
                                splitLegalParagraphs(adminPrivacy).map((para, idx) => (
                                    <p key={idx} className="whitespace-pre-wrap leading-relaxed">
                                        {para}
                                    </p>
                                ))
                            )
                        ) : (
                            <>
                                <p>
                                    At {appName}, we take {audienceLabel.toLowerCase()} privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.
                                </p>
                                <p className="text-slate-400 italic">
                                    A detailed {audienceLabel.toLowerCase()} privacy policy has not been published by the admin yet. Please check back later or contact support.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
