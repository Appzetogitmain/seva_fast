// Referral link builders shared by the profile card (share/QR) and the signup page.

export const DEFAULT_PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.sevafast.user';

// Play Install Referrer: the Flutter app reads "ref=<CODE>" on first launch after install.
export const buildPlayStoreReferUrl = (playStoreLink, referralCode) => {
    const base = playStoreLink || DEFAULT_PLAY_STORE_LINK;
    if (!referralCode) return base;
    return `${base}${base.includes('?') ? '&' : '?'}referrer=${encodeURIComponent(`ref=${referralCode}`)}`;
};

// App Link (verified through /.well-known/assetlinks.json): opens the app straight on
// signup when it is installed, otherwise the site sends the visitor to the Play Store.
export const buildAppReferUrl = (siteOrigin, referralCode) =>
    referralCode
        ? `${siteOrigin}/signup?ref=${encodeURIComponent(referralCode)}&install=1`
        : siteOrigin;
