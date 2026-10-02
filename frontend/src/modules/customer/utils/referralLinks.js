// Referral link builders shared by the profile card (share/QR), the customer signup
// page and the seller signup page.

export const DEFAULT_PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.sevafast.user';
export const DEFAULT_SELLER_PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.sevafast.seller';

const withInstallReferrer = (base, referralCode) => {
    if (!referralCode) return base;
    return `${base}${base.includes('?') ? '&' : '?'}referrer=${encodeURIComponent(`ref=${referralCode}`)}`;
};

// Play Install Referrer: the Flutter app reads "ref=<CODE>" on first launch after install.
export const buildPlayStoreReferUrl = (playStoreLink, referralCode) =>
    withInstallReferrer(playStoreLink || DEFAULT_PLAY_STORE_LINK, referralCode);

export const buildSellerPlayStoreReferUrl = (sellerPlayStoreLink, referralCode) =>
    withInstallReferrer(sellerPlayStoreLink || DEFAULT_SELLER_PLAY_STORE_LINK, referralCode);

// App Link (verified through /.well-known/assetlinks.json): opens the app straight on
// signup when it is installed, otherwise the site sends the visitor to the Play Store.
export const buildAppReferUrl = (siteOrigin, referralCode) =>
    referralCode
        ? `${siteOrigin}/signup?ref=${encodeURIComponent(referralCode)}&install=1`
        : siteOrigin;

// Same idea for the seller app: opens the seller app on signup when installed; on an
// Android browser it redirects to the seller app's Play Store page with the code as
// install referrer; elsewhere it stays on the web seller signup with the code filled.
export const buildSellerReferUrl = (siteOrigin, referralCode) =>
    referralCode
        ? `${siteOrigin}/seller/auth?mode=signup&ref=${encodeURIComponent(referralCode)}&install=1`
        : `${siteOrigin}/seller/auth?mode=signup`;
