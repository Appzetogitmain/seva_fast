import React from 'react';
import { Shield } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import {
    getLegalAudienceLabel,
    getLegalContent,
    isHtmlLegalContent,
    splitLegalParagraphs,
} from '@/shared/utils/legalContent';
import { formatDate } from '@shared/utils/formatDate';

const Privacy = () => {
    const { settings } = useSettings();
    const audience = 'seller';
    const audienceLabel = getLegalAudienceLabel(audience);
    const appName = settings?.appName || 'App';
    const companyName = settings?.companyName || appName;
    const adminPrivacy = getLegalContent(settings, audience, 'privacy');
    const updatedAt = settings?.updatedAt ? formatDate(settings.updatedAt, null) : null;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">{audienceLabel} Privacy Policy</h2>
                        <p className="text-sm text-slate-500 font-medium">
                            {updatedAt ? `Last updated: ${updatedAt}` : `Published by ${companyName}`}
                        </p>
                    </div>
                </div>

                <div className="prose prose-slate prose-sm max-w-none text-slate-600">
                    {adminPrivacy ? (
                        isHtmlLegalContent(adminPrivacy) ? (
                            <div
                                className="whitespace-pre-wrap leading-relaxed [&_h1]:text-lg [&_h1]:font-black [&_h2]:text-base [&_h2]:font-bold [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
                                dangerouslySetInnerHTML={{ __html: adminPrivacy }}
                            />
                        ) : (
                            splitLegalParagraphs(adminPrivacy).map((para, idx) => (
                                <p key={idx} className="whitespace-pre-wrap leading-relaxed mb-4">
                                    {para}
                                </p>
                            ))
                        )
                    ) : (
                        <>
                            <p className="mb-4">
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
    );
};

export default Privacy;
