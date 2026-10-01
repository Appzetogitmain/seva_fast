import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
    { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
];

export const LANGUAGE_STORAGE_KEY = 'seva_language';

// Translations live in src/locales/<lang>/<namespace>/<area>.json and are
// merged into resources[lang][namespace][area], so the key nav.home in the
// "customer" namespace reads src/locales/<lang>/customer/nav.json → "home".
const files = import.meta.glob('../../locales/*/*/*.json', { eager: true, import: 'default' });

const resources = {};
for (const [path, messages] of Object.entries(files)) {
    const [, lang, ns, area] = path.match(/locales\/([^/]+)\/([^/]+)\/([^/]+)\.json$/) || [];
    if (!lang) continue;
    resources[lang] = resources[lang] || {};
    resources[lang][ns] = resources[lang][ns] || {};
    resources[lang][ns][area] = messages;
}

const syncDocumentLang = (lng) => {
    if (typeof document !== 'undefined') document.documentElement.lang = lng || 'en';
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
        fallbackLng: 'en',
        ns: Object.keys(resources.en || {}),
        defaultNS: 'common',
        fallbackNS: 'common',
        interpolation: { escapeValue: false },
        returnNull: false,
        detection: {
            order: ['localStorage'],
            lookupLocalStorage: LANGUAGE_STORAGE_KEY,
            caches: ['localStorage'],
        },
    });

/**
 * For text that comes from admin settings but usually holds our built-in
 * English default: translate it when it is still that default, otherwise
 * show exactly what the admin typed.
 */
export const translateIfDefault = (t, value, key) => {
    if (value === undefined || value === null || value === '') return t(key);
    const normalize = (s) => String(s).trim().toLowerCase();
    return normalize(value) === normalize(t(key, { lng: 'en' })) ? t(key) : value;
};

/** Translates stored ETA strings such as "12-15 mins" for display. */
export const translateEta = (eta) => {
    if (!eta) return eta;
    return String(eta).replace(/(\d+)\s*-\s*(\d+)\s*mins?/i, (_, min, max) =>
        i18n.t('customer:checkout.minsRange', { min, max }));
};

/** BCP-47 locale for Intl/toLocale* formatting of dates and numbers. */
export const getDateLocale = () => `${i18n.resolvedLanguage || 'en'}-IN`;

syncDocumentLang(i18n.resolvedLanguage);
i18n.on('languageChanged', syncDocumentLang);

export default i18n;
