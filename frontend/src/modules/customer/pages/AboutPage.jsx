import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Truck, Heart, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';

const AboutPage = () => {
    const { t } = useTranslation('customer');
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{t('profile.menu.about')}</h1>
            </div>

            <div className="px-4 pt-1 max-w-3xl mx-auto space-y-4">

                {/* Hero Section */}
                <div className="rounded-xl p-5 text-center bg-white border border-slate-200">
                    <div className="flex flex-col items-center">
                        <div className="bg-slate-100 p-3 rounded-lg mb-3">
                            <ShoppingBag size={24} className="text-slate-700" />
                        </div>
                        <h2 className="text-xl font-semibold mb-1 tracking-tight text-slate-900">{appName}</h2>
                        <p className="text-slate-600 text-sm max-w-sm mx-auto">{t('about.tagline')}</p>
                    </div>
                </div>

                {/* Mission Card */}
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                            <Truck size={18} />
                        </div>
                        <h3 className="text-base font-semibold text-slate-800">{t('about.mission')}</h3>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-sm">
                        {t('about.missionText')}
                    </p>
                </div>

                {/* Values Card */}
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                            <Heart size={18} />
                        </div>
                        <h3 className="text-base font-semibold text-slate-800">{t('about.values')}</h3>
                    </div>
                    <ul className="space-y-3 text-sm text-slate-600">
                        <li className="flex gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                            <span><strong>{t('about.v1Title')}</strong> {t('about.v1')}</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                            <span><strong>{t('about.v2Title')}</strong> {t('about.v2')}</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                            <span><strong>{t('about.v3Title')}</strong> {t('about.v3')}</span>
                        </li>
                    </ul>
                </div>

                <div className="text-center pt-2">
                    <p className="text-xs text-slate-400">© {new Date().getFullYear()} {appName}. {t('footer.rights')}</p>
                </div>

            </div>
        </div>
    );
};

export default AboutPage;
