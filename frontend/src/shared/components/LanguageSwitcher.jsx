import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@core/i18n';
import { cn } from '@/lib/utils';

/**
 * English / हिंदी / मराठी switch. The choice is saved on this device and
 * applied across the whole app instantly.
 * variant="pills": compact segmented control (headers, auth screen)
 * variant="list":  full-width rows (settings / profile)
 */
const LanguageSwitcher = ({ variant = 'pills', className }) => {
    const { t, i18n } = useTranslation('common');
    const current = i18n.resolvedLanguage || 'en';

    if (variant === 'list') {
        return (
            <div className={cn('divide-y divide-slate-50', className)}>
                {SUPPORTED_LANGUAGES.map((lang) => {
                    const active = current === lang.code;
                    return (
                        <button
                            key={lang.code}
                            type="button"
                            onClick={() => i18n.changeLanguage(lang.code)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                        >
                            <div>
                                <p className="font-bold text-slate-800 text-base">{lang.nativeLabel}</p>
                                {lang.nativeLabel !== lang.label && (
                                    <p className="text-xs font-medium text-slate-400">{lang.label}</p>
                                )}
                            </div>
                            <span
                                className={cn(
                                    'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                                    active ? 'border-primary' : 'border-slate-300',
                                )}
                                aria-label={active ? t('language.selected') : undefined}
                            >
                                {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div
            role="group"
            aria-label={t('language.title')}
            className={cn('inline-flex items-center gap-1 rounded-full bg-white/90 p-1 ring-1 ring-slate-200 shadow-sm', className)}
        >
            <Languages size={14} className="ml-1.5 text-slate-500" aria-hidden />
            {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                    key={lang.code}
                    type="button"
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
                        current === lang.code ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                    )}
                >
                    {lang.nativeLabel}
                </button>
            ))}
        </div>
    );
};

export default LanguageSwitcher;
