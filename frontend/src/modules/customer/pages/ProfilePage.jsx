import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    User, MapPin, Package, CreditCard, Wallet, ChevronRight, ChevronDown,
    LogOut, ShieldCheck, Heart, HelpCircle, Info, Edit2, ChevronLeft, Bell,
    Share2, Copy, Sparkles, Camera, X, Users, Briefcase, FileText
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { useSignOutConfirmation } from '@shared/hooks/useSignOutConfirmation';
import { customerApi } from '../services/customerApi';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
    describePushSupport,
    ensureFcmTokenRegistered,
    startForegroundPushListener
} from '@core/firebase/pushClient';
import { formatDate } from '@shared/utils/formatDate';
import { CustomPhotoOrderModal } from '../components/shared/CustomPhotoOrderModal';

const TEST_PUSH_STATUS_POLL_INTERVAL_MS = 1500;
const TEST_PUSH_STATUS_MAX_ATTEMPTS = 20;

function getReferrerDisplayName(referredBy) {
    if (!referredBy) return null;
    if (typeof referredBy === 'object') {
        return referredBy.name || referredBy.referralCode || null;
    }
    return null;
}

function getPlanShortName(plan) {
    if (!plan) return null;
    if (typeof plan === 'string') return null; // ObjectId only — no display name
    const name = String(plan.name || '').trim();
    if (!name) return null;
    // Prefer first word for short display (e.g. "Gold Membership" -> "Gold")
    return name.split(/\s+/)[0];
}

function getPurchasedPlanNames(user) {
    const names = [];
    const seen = new Set();

    const pushName = (plan) => {
        const shortName = getPlanShortName(plan);
        if (!shortName) return;
        const key = shortName.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(shortName);
    };

    (user?.planSubscriptions || []).forEach((subscription) => {
        pushName(subscription?.plan);
    });

    // Legacy fallback when planSubscriptions is empty
    if (names.length === 0) {
        pushName(user?.currentPlan);
    }

    return names;
}

const ProfilePage = () => {
    const navigate = useNavigate();
    const { user, role } = useAuth();
    const { requestSignOut, signOutDialog } = useSignOutConfirmation();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const purchasedPlanNames = React.useMemo(() => getPurchasedPlanNames(user), [user]);
    const planShortName = purchasedPlanNames[0] ?? null;
    const [isTestingPush, setIsTestingPush] = React.useState(false);
    const [isCustomOrderModalOpen, setIsCustomOrderModalOpen] = React.useState(false);
    const [isReferralTreeModalOpen, setIsReferralTreeModalOpen] = React.useState(false);
    const [targetDetails, setTargetDetails] = React.useState(null);

    React.useEffect(() => {
        const fetchTargetDetails = async () => {
            try {
                const res = await customerApi.getReferralTree();
                setTargetDetails(res.data.result.targetDetails || null);
            } catch (error) {
                console.error("Failed to load target details", error);
            }
        };
        fetchTargetDetails();
    }, []);

    React.useEffect(() => {
        if (isReferralTreeModalOpen || isCustomOrderModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isReferralTreeModalOpen, isCustomOrderModalOpen]);

    const handleShare = async (url, label = appName) => {
        const shareUrl = url || window.location.origin;
        const shareData = {
            title: appName,
            text: `Check out ${label}!`,
            url: shareUrl,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Link copied to clipboard!');
            }
        } catch (error) {
            if (error?.name !== 'AbortError') {
                toast.error('Could not share at this time.');
            }
        }
    };

    const formatIndiaPhone = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('+91')) return raw.replace(/^\+91[\s-]*/, '');
        if (raw.startsWith('91') && raw.length >= 12) return raw.replace(/^91[\s-]*/, '');
        return raw;
    };

    const referralCode = user?.referralCode || '';
    const siteReferUrl = referralCode
        ? `${window.location.origin}/signup?ref=${referralCode}`
        : window.location.origin;
    const appReferUrl = settings?.playStoreLink || siteReferUrl;
    const cardReferUrl = siteReferUrl;
    const referrerName = getReferrerDisplayName(user?.referredBy);
    const logoUrl = settings?.logoUrl || '/seva-fast-logo.png';
    const supportEmail = settings?.supportEmail || 'sevafast2@gmail.com';
    const siteHost = (typeof window !== 'undefined' ? window.location.host : 'www.sevafast.in') || 'www.sevafast.in';
    const profilePhotoUrl = user?.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.name || user?.phone || 'customer')}`;
    const qrSrc = (data, size = 120) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
    const goldText =
        'bg-gradient-to-b from-[#c9a227] via-[#8b6914] to-[#5c4508] bg-clip-text text-transparent';
    const benefitNames = purchasedPlanNames.length > 0 ? purchasedPlanNames : [];

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForTestPushResult = async (orderId) => {
        for (let attempt = 0; attempt < TEST_PUSH_STATUS_MAX_ATTEMPTS; attempt += 1) {
            const statusRes = await customerApi.getTestPushNotificationStatus(orderId);
            const result = statusRes?.data?.result || {};
            const status = String(result.status || '').trim().toLowerCase();

            if (status === 'sent' || status === 'failed') {
                return result;
            }

            if (attempt < TEST_PUSH_STATUS_MAX_ATTEMPTS - 1) {
                await wait(TEST_PUSH_STATUS_POLL_INTERVAL_MS);
            }
        }
        return null;
    };

    const handleTestPush = async () => {
        if (isTestingPush) return;
        setIsTestingPush(true);
        try {
            const support = describePushSupport();
            if (!support.supported) {
                throw new Error(support.message || 'Push notifications are not supported on this device/browser setup.');
            }

            await ensureFcmTokenRegistered({ role, platform: 'web' });
            await startForegroundPushListener();
            const res = await customerApi.testPushNotification();
            const orderId = res?.data?.result?.orderId || '';
            if (!orderId) {
                toast.success('Test push triggered');
                return;
            }

            const statusResult = await waitForTestPushResult(orderId);
            if (!statusResult) {
                toast.message(`Test push processing (${orderId})`, {
                    description: 'Notification delivery is taking longer than expected.',
                });
                return;
            }

            if (statusResult.status === 'sent') {
                toast.success(`Test push sent (${orderId})`, {
                    description: 'MongoDB status is marked as sent.',
                });
                return;
            }

            toast.error(`Test push failed (${orderId})`, {
                description: String(statusResult.failureReason || 'Notification delivery failed.'),
            });
        } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Unknown error';
            if (message.includes('not supported') || message.includes('Permission denied')) {
                toast.info('Push Notifications Unavailable', {
                    description: 'Your browser or device settings currently block push notifications.',
                });
            } else {
                toast.error('Failed to trigger test push', {
                    description: message,
                });
            }
        } finally {
            setIsTestingPush(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 font-sans">
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">My Profile</h1>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleTestPush}
                        disabled={isTestingPush}
                        title="Test push notification"
                        className="w-10 h-10 flex items-center justify-center rounded-full transition-colors border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Bell size={18} className={isTestingPush ? "text-slate-400" : "text-slate-700"} />
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">

                {/* User Identity Card — SEVAFAST membership layout */}
                <div
                    onClick={() => setIsReferralTreeModalOpen(true)}
                    className="group relative mb-2 cursor-pointer overflow-hidden rounded-3xl border border-slate-300/70 bg-[#ececec] shadow-[0_18px_40px_-20px_rgba(15,23,42,0.4)] transition-all duration-300 hover:brightness-[1.02] active:scale-[0.995]"
                >
                    <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.07)_1px,transparent_0)] [background-size:10px_10px]" />

                    {/* Right dark curved panel + arcs */}
                    <div className="pointer-events-none absolute -right-[12%] -top-[18%] h-[140%] w-[52%] rounded-full bg-[#5a5a5a] sm:w-[48%]" />
                    <div className="pointer-events-none absolute -right-[6%] top-[6%] h-[88%] w-[44%] rounded-full border border-black/25 sm:w-[40%]" />
                    <div className="pointer-events-none absolute right-[2%] top-[14%] h-[72%] w-[36%] rounded-full border border-black/15 sm:w-[32%]" />

                    <div className="relative z-10 grid grid-cols-[1.22fr_0.78fr] gap-2 p-3 sm:gap-2.5 sm:p-4 min-h-[238px] sm:min-h-[276px]">
                        {/* Left rounded content panel */}
                        <div className="relative flex min-w-0 flex-col rounded-[1.35rem] bg-white/42 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-[1px] sm:rounded-[1.75rem] sm:px-4 sm:py-3.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <img
                                        src={logoUrl}
                                        alt={appName}
                                        className="h-8 w-8 shrink-0 rounded-md object-contain bg-white/80 p-0.5 sm:h-9 sm:w-9"
                                    />
                                    <div className="min-w-0">
                                        <p className="truncate text-[14px] font-black uppercase tracking-[0.04em] text-slate-900 sm:text-[15px]">
                                            {(appName || 'SEVAFAST').replace(/\s+/g, '')}
                                        </p>
                                        <p className="bg-gradient-to-r from-[#9b7bb8] to-[#e07a3a] bg-clip-text text-[8px] font-extrabold uppercase tracking-[0.11em] text-transparent sm:text-[9px]">
                                            Big Saving Shopping
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleShare(siteReferUrl, appName);
                                        }}
                                        className="rounded-md bg-white/80 p-1.5 text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-white"
                                        title="Share"
                                    >
                                        <Share2 size={12} />
                                    </button>
                                    <Link
                                        to="/profile/edit"
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded-md bg-white/80 p-1.5 text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-white"
                                        title="Edit Profile"
                                    >
                                        <Edit2 size={12} />
                                    </Link>
                                </div>
                            </div>

                            <div className="mt-3 flex items-start justify-between gap-2.5">
                                <div>
                                    <p className="text-[10px] font-black text-slate-900 sm:text-[11px]">Benefits :</p>
                                    <ul className="mt-0.5 space-y-0.5">
                                        {benefitNames.length > 0 ? (
                                            benefitNames.map((planName) => (
                                                <li
                                                    key={planName}
                                                    className={`font-serif text-[12px] font-bold leading-tight sm:text-[13px] ${goldText}`}
                                                >
                                                    {planName}
                                                </li>
                                            ))
                                        ) : planShortName ? (
                                            <li className={`font-serif text-[12px] font-bold sm:text-[13px] ${goldText}`}>
                                                {planShortName}
                                            </li>
                                        ) : (
                                            <li className="text-[10px] font-semibold text-slate-500">No plan</li>
                                        )}
                                    </ul>
                                </div>
                                <p className={`shrink-0 text-right font-serif text-[12px] font-black leading-[1.05] sm:text-[16px] ${goldText}`}>
                                    UP TO<br />25% OFF
                                </p>
                            </div>

                            <div className={`mt-3 space-y-0.5 font-serif text-[11px] font-bold leading-snug sm:text-[13px] ${goldText}`}>
                                {referrerName ? <p className="truncate">Referred By: {referrerName}</p> : null}
                                <p className="truncate">{user?.name || 'Customer'}</p>
                                <p className="truncate">+91 {formatIndiaPhone(user?.phone) || '—'}</p>
                                <p className="truncate">user ref id: {referralCode || 'N/A'}</p>
                            </div>

                            <div className="mt-auto flex items-end justify-between gap-2.5 pt-3">
                                <div className="flex min-w-0 items-end gap-1.5">
                                    <span className="text-xl leading-none sm:text-2xl" aria-hidden>🛍️</span>
                                    <div className="min-w-0 text-[8px] font-semibold leading-tight text-slate-700 sm:text-[9px]">
                                        <p className="truncate">www.{siteHost.replace(/^www\./, '')}</p>
                                        <p className="truncate">{supportEmail}</p>
                                    </div>
                                </div>
                                {referralCode ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(referralCode);
                                            toast.success('Referral code copied to clipboard!');
                                        }}
                                        className="inline-flex max-w-[50%] items-center gap-1 rounded-md bg-[#2f6fed]/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#2f6fed] ring-1 ring-[#2f6fed]/25"
                                        title="Copy referral code"
                                    >
                                        <Share2 size={10} className="shrink-0" />
                                        <span className="truncate font-mono tracking-wider text-slate-800 normal-case">
                                            {referralCode}
                                        </span>
                                        <Copy size={10} className="shrink-0 text-slate-500" />
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* Right content over dark curve */}
                        <div className="relative flex min-w-0 flex-col items-center px-1 text-white">
                            <div className="mt-0.5 flex w-full justify-end gap-2 sm:gap-2.5">
                                <div className="flex flex-col items-center">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleShare(appReferUrl, 'App referral');
                                        }}
                                        className="mb-0.5 self-start text-[#2f6fed]"
                                        title="Share app referral"
                                    >
                                        <Share2 size={11} />
                                    </button>
                                    <div className="rounded-[2px] bg-white p-0.5 shadow-sm">
                                        <img
                                            src={qrSrc(appReferUrl, 90)}
                                            alt="App referral QR"
                                            className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                    <span className="mt-1 text-[7px] font-bold uppercase tracking-wide text-white/95 sm:text-[8px]">
                                        app refer
                                    </span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleShare(siteReferUrl, 'Site referral');
                                        }}
                                        className="mb-0.5 self-start text-[#2f6fed]"
                                        title="Share site referral"
                                    >
                                        <Share2 size={11} />
                                    </button>
                                    <div className="rounded-[2px] bg-white p-0.5 shadow-sm">
                                        <img
                                            src={qrSrc(siteReferUrl, 90)}
                                            alt="Site referral QR"
                                            className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                    <span className="mt-1 text-[7px] font-bold uppercase tracking-wide text-white/95 sm:text-[8px]">
                                        site refer
                                    </span>
                                </div>
                            </div>

                            <div className="relative mt-2.5 flex flex-col items-center">
                                <div className="absolute -left-[3.25rem] top-5 hidden w-[3rem] text-right text-[8px] font-bold leading-tight text-white/90 sm:block">
                                    <span>card renewal</span>
                                    <div className="font-mono text-[9px] tracking-wide text-white">
                                        {user?.currentPlan && user?.planExpiry ? formatDate(user.planExpiry) : 'N / A'}
                                    </div>
                                </div>
                                <div className="h-[4.25rem] w-[4.25rem] overflow-hidden rounded-full border-[3px] border-white bg-slate-200 shadow-md sm:h-[5.25rem] sm:w-[5.25rem]">
                                    <img
                                        src={profilePhotoUrl}
                                        alt={user?.name || 'Profile'}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <span className="mt-1 text-[8px] font-semibold text-white/95 sm:text-[9px]">
                                    profile photo
                                </span>
                            </div>

                            <div className="mt-auto flex w-full flex-col items-center pb-0.5">
                                <p className="mb-1 text-[8px] font-bold text-white/95 sm:hidden">
                                    renewal: {user?.currentPlan && user?.planExpiry ? formatDate(user.planExpiry) : 'N / A'}
                                </p>
                                {referralCode ? (
                                    <div className="relative flex flex-col items-center">
                                        <div className="rounded-[2px] bg-white p-1 shadow-md">
                                            <img
                                                src={qrSrc(cardReferUrl, 140)}
                                                alt="Card referral QR"
                                                className="h-14 w-14 object-contain sm:h-[4.25rem] sm:w-[4.25rem]"
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleShare(cardReferUrl, 'Card referral');
                                            }}
                                            className="absolute -right-5 bottom-5 text-[#2f6fed] sm:-right-6"
                                            title="Share card referral"
                                        >
                                            <Share2 size={12} />
                                        </button>
                                        <span className="mt-1 text-[7px] font-bold uppercase tracking-wide text-white/95 sm:text-[8px]">
                                            Card refer
                                        </span>
                                    </div>
                                ) : (
                                    <div className="rounded-sm bg-white/85 px-2 py-3 text-center text-[8px] font-semibold text-slate-500">
                                        Save your URL to create a QR code
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Monthly Referral Target Progress Widget */}
                {targetDetails && targetDetails.monthlyTarget ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-amber-50 rounded-xl">
                                    <Sparkles size={16} className="text-amber-500 animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                        Monthly Referral Target
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                        Month: {targetDetails.monthName}
                                    </p>
                                </div>
                            </div>
                            <span className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                                targetDetails.isTargetAchieved 
                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                    : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                            )}>
                                {targetDetails.isTargetAchieved ? "Achieved" : "In Progress"}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-baseline justify-between text-xs">
                                <span className="font-bold text-slate-500">Progress</span>
                                <span className="text-sm font-extrabold text-slate-800">
                                    {targetDetails.currentMonthReferralsCount} <span className="text-slate-400 font-bold">/ {targetDetails.monthlyTarget} Referrals</span>
                                </span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div 
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        targetDetails.isTargetAchieved ? "bg-emerald-500" : "bg-indigo-600"
                                    )}
                                    style={{ width: `${Math.min(100, (targetDetails.currentMonthReferralsCount / targetDetails.monthlyTarget) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <div className={cn(
                            "text-xs font-semibold leading-relaxed p-3 rounded-xl flex items-start gap-2.5 border",
                            targetDetails.isTargetAchieved 
                                ? "bg-emerald-50/50 text-emerald-800 border-emerald-100/50" 
                                : "bg-indigo-50/40 text-indigo-900 border-indigo-100/30"
                        )}>
                            {targetDetails.isTargetAchieved ? (
                                <>
                                    <span className="text-sm">🎉</span>
                                    <span><strong>Congratulations!</strong> You completed this month's target and received <strong>₹{targetDetails.monthlyTargetReward}</strong> incentive in your wallet!</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-sm">💡</span>
                                    <span>Refer <strong>{targetDetails.monthlyTarget - targetDetails.currentMonthReferralsCount} more</strong> user{targetDetails.monthlyTarget - targetDetails.currentMonthReferralsCount > 1 ? 's' : ''} this month to unlock a <strong>₹{targetDetails.monthlyTargetReward}</strong> wallet bonus!</span>
                                </>
                            )}
                        </div>
                    </div>
                ) : null}

                {/* Menu Sections */}
                <div className="space-y-4">
                    {/* Account Section */}
                    <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Personal Account</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            <MenuItem
                                icon={Sparkles}
                                label="My Subscription"
                                sub={user?.currentPlan?.name ? `Active: ${user.currentPlan.name}` : "View or upgrade your plan"}
                                path="/plans"
                                color="#a855f7"
                                bg="rgba(168,85,247,0.10)"
                            />
                            <MenuItem
                                icon={Briefcase}
                                label="Professional Services"
                                sub="Register or manage professional services"
                                path="/professionals/panel"
                                color="#2563eb"
                                bg="rgba(37,99,235,0.10)"
                            />
                            <div onClick={() => setIsCustomOrderModalOpen(true)}>
                                <MenuItem
                                    icon={Camera}
                                    label="Custom Photo Order"
                                    sub="Send a picture directly to a seller"
                                    color="#ec4899"
                                    bg="rgba(236,72,153,0.10)"
                                />
                            </div>
                            <MenuItem
                                icon={Package}
                                label="Your Orders"
                                sub="Track, return or buy things again"
                                path="/orders"
                                color="var(--primary)"
                                bg="rgba(16,185,129,0.10)"
                            />
                            <MenuItem
                                icon={CreditCard}
                                label="Order Transactions"
                                sub="View all payments & refunds"
                                path="/transactions"
                                color="#f97316"
                                bg="rgba(249,115,22,0.10)"
                            />
                            <MenuItem
                                icon={Wallet}
                                label="Wallet"
                                sub="Balance & return refunds"
                                path="/wallet"
                                color="#10b981"
                                bg="rgba(16,185,129,0.10)"
                            />
                            <div onClick={() => setIsReferralTreeModalOpen(true)}>
                                <MenuItem
                                    icon={Users}
                                    label="Referral Network"
                                    sub="See your referral tree & levels"
                                    color="#6366f1"
                                    bg="rgba(99,102,241,0.10)"
                                />
                            </div>
                            <MenuItem
                                icon={Heart}
                                label="Your Wishlist"
                                sub="Your saved items"
                                path="/wishlist"
                                color="#fb7185"
                                bg="rgba(248,113,113,0.08)"
                            />
                            <MenuItem
                                icon={MapPin}
                                label="Saved Addresses"
                                sub="Manage your delivery locations"
                                path="/addresses"
                                color="var(--primary)"
                                bg="rgba(56,189,248,0.10)"
                            />
                        </div>
                    </div>

                    {/* Support Section */}
                    <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Help & Settings</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            <MenuItem
                                icon={HelpCircle}
                                label="Help & Support"
                                path="/support"
                                color="#3b82f6"
                                bg="rgba(59,130,246,0.08)"
                            />
                            <MenuItem
                                icon={ShieldCheck}
                                label="Privacy Policy"
                                path="/privacy"
                                color="#a855f7"
                                bg="rgba(168,85,247,0.08)"
                            />
                            <MenuItem
                                icon={FileText}
                                label="Terms & Conditions"
                                path="/terms"
                                color="#0ea5e9"
                                bg="rgba(14,165,233,0.08)"
                            />
                            <MenuItem
                                icon={Info}
                                label="About Us"
                                path="/about"
                                color="#14b8a6"
                                bg="rgba(45,212,191,0.08)"
                            />
                        </div>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={requestSignOut}
                    className="w-full py-3 rounded-lg border border-slate-300 text-slate-700 font-semibold bg-white hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 mt-2"
                >
                    <LogOut size={20} />
                    Sign out
                </button>

                <div className="text-center pb-8">
                    <p className="text-[10px] text-slate-400 font-medium">Version 2.4.0 - {appName}</p>
                </div>

            </div>
            
            <CustomPhotoOrderModal 
                isOpen={isCustomOrderModalOpen} 
                onClose={() => setIsCustomOrderModalOpen(false)} 
            />
            <ReferralTreeModal
                isOpen={isReferralTreeModalOpen}
                onClose={() => setIsReferralTreeModalOpen(false)}
                user={user}
            />
            {signOutDialog}
        </div>
    );
};


const MenuItem = ({ icon: Icon, label, sub, path, color = '#334155', bg = 'rgba(148,163,184,0.12)' }) => (
    <Link to={path || '#'} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group">
        <div className="flex items-center gap-3">
            <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: bg }}
            >
                <Icon
                    size={20}
                    className="transition-colors"
                    style={{ color }}
                />
            </div>
            <div>
                <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
                {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </div>
        <div className="p-1.5 rounded-md group-hover:bg-slate-100 transition-colors">
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 transition-all group-hover:translate-x-0.5" />
        </div>
    </Link>
);

const getTreeStats = (tree) => {
    const stats = {};
    let total = 0;
    const traverse = (node) => {
        if (!node) return;
        if (node.level > 0) {
            total++;
            stats[node.level] = (stats[node.level] || 0) + 1;
        }
        if (node.children) {
            node.children.forEach(traverse);
        }
    };
    traverse(tree);
    return { total, levels: stats };
};

const ReferralNode = ({ node, isLast }) => {
    const [isOpen, setIsOpen] = React.useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="relative pl-6 mt-2">
            {/* Visual connecting lines */}
            <div className={cn("absolute left-0 w-0.5 bg-slate-300", isLast ? "h-9 top-[-8px]" : "top-[-8px] bottom-0")}></div>
            <div className="absolute top-7 left-0 w-6 h-0.5 bg-slate-300"></div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/50 shadow-sm flex items-center justify-between hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                        node.level === 1 ? "bg-emerald-100 text-emerald-700" :
                        node.level === 2 ? "bg-amber-100 text-amber-700" :
                        node.level === 3 ? "bg-rose-100 text-rose-700" :
                        "bg-blue-100 text-blue-700"
                    )}>
                        L{node.level}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-800 truncate">{node.name}</h4>
                            {node.earnings > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                                    +₹{node.earnings.toFixed(2)}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate">Ref: {node.referralCode} • {node.phone}</p>
                    </div>
                </div>
                {hasChildren && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            setIsOpen(!isOpen);
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                    >
                        {isOpen ? "Hide" : `Show (${node.children.length})`}
                    </button>
                )}
            </div>

            {isOpen && hasChildren && (
                <div className="space-y-2 mt-2 ml-[28px] relative">
                    {node.children.map((child, idx) => (
                        <ReferralNode
                            key={child._id}
                            node={child}
                            isLast={idx === node.children.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ReferralTreeModal = ({ isOpen, onClose, user }) => {
    const [treeData, setTreeData] = React.useState(null);
    const [earningsByLevel, setEarningsByLevel] = React.useState({});
    const [targetDetails, setTargetDetails] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            fetchTreeData();
        }
    }, [isOpen]);

    const fetchTreeData = async () => {
        try {
            setIsLoading(true);
            const res = await customerApi.getReferralTree();
            setTreeData(res.data.result.tree);
            setEarningsByLevel(res.data.result.earningsByLevel || {});
            setTargetDetails(res.data.result.targetDetails || null);
        } catch (error) {
            toast.error("Failed to load referral tree");
        } finally {
            setIsLoading(false);
        }
    };

    const stats = React.useMemo(() => {
        if (!treeData) return { total: 0, levels: {} };
        return getTreeStats(treeData);
    }, [treeData]);

    const totalEarnings = React.useMemo(() => {
        return Object.values(earningsByLevel).reduce((sum, val) => sum + val, 0);
    }, [earningsByLevel]);

    const level1Earnings = earningsByLevel[1] || 0;

    const level2PlusEarnings = React.useMemo(() => {
        return Object.entries(earningsByLevel)
            .filter(([lvl]) => Number(lvl) >= 2)
            .reduce((sum, [_, val]) => sum + val, 0);
    }, [earningsByLevel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-50 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl h-[85vh] relative animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-white">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-indigo-600" />
                        Referral Network Tree
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-3">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-semibold text-slate-500">Loading your network...</span>
                        </div>
                    ) : treeData ? (
                        <>
                            {/* Stats Summary */}
                            <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm text-center">
                                <div className="min-w-0 overflow-hidden">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Referrals</p>
                                    <p className="text-xl font-extrabold text-indigo-600 truncate">{stats.total}</p>
                                    <p className="text-[9px] font-black text-indigo-500 mt-0.5 truncate">₹{totalEarnings.toFixed(2)}</p>
                                </div>
                                <div className="min-w-0 overflow-hidden">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Level 1</p>
                                    <p className="text-xl font-extrabold text-emerald-600 truncate">{stats.levels[1] || 0}</p>
                                    <p className="text-[9px] font-black text-emerald-500 mt-0.5 truncate">₹{level1Earnings.toFixed(2)}</p>
                                </div>
                                <div className="min-w-0 overflow-hidden">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Level 2+</p>
                                    <p className="text-xl font-extrabold text-amber-600 truncate">
                                        {Object.entries(stats.levels)
                                            .filter(([lvl]) => Number(lvl) > 1)
                                            .reduce((sum, [, count]) => sum + count, 0)}
                                    </p>
                                    <p className="text-[9px] font-black text-amber-500 mt-0.5 truncate">₹{level2PlusEarnings.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Monthly Target Progress Section */}
                            {targetDetails && targetDetails.monthlyTarget ? (
                                <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={16} className="text-amber-500 animate-pulse" />
                                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                                Monthly Target ({targetDetails.monthName})
                                            </h4>
                                        </div>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                            targetDetails.isTargetAchieved ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {targetDetails.isTargetAchieved ? "Achieved" : "In Progress"}
                                        </span>
                                    </div>

                                    <div className="flex items-baseline justify-between">
                                        <p className="text-xs font-bold text-slate-500">
                                            Referrals Completed
                                        </p>
                                        <p className="text-sm font-extrabold text-slate-800">
                                            {targetDetails.currentMonthReferralsCount} <span className="text-slate-400 font-bold">/ {targetDetails.monthlyTarget}</span>
                                        </p>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className={cn(
                                                "h-full rounded-full transition-all duration-500",
                                                targetDetails.isTargetAchieved ? "bg-emerald-500" : "bg-indigo-600"
                                            )}
                                            style={{ width: `${Math.min(100, (targetDetails.currentMonthReferralsCount / targetDetails.monthlyTarget) * 100)}%` }}
                                        />
                                    </div>

                                    <p className={cn(
                                        "text-[11px] font-semibold leading-relaxed p-2.5 rounded-lg flex items-start gap-2",
                                        targetDetails.isTargetAchieved 
                                            ? "bg-emerald-50 text-emerald-800 border border-emerald-100/50" 
                                            : "bg-indigo-50/50 text-indigo-900 border border-indigo-100/20"
                                    )}>
                                        {targetDetails.isTargetAchieved ? (
                                            <>
                                                <span>🎉</span>
                                                <span><strong>Congratulations!</strong> You completed the target and received ₹{targetDetails.monthlyTargetReward} in your wallet!</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>💡</span>
                                                <span>Refer <strong>{targetDetails.monthlyTarget - targetDetails.currentMonthReferralsCount} more</strong> user{targetDetails.monthlyTarget - targetDetails.currentMonthReferralsCount > 1 ? 's' : ''} this month to earn an extra <strong>₹{targetDetails.monthlyTargetReward}</strong> incentive!</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            ) : null}

                            {/* Tree view */}
                            {stats.total === 0 ? (
                                <div className="bg-white rounded-xl border border-slate-200/60 p-8 text-center space-y-4 shadow-sm">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                        <Users size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-slate-800">No Referrals Yet</h4>
                                        <p className="text-xs text-slate-400">Share your referral code with friends and family to build your network tree!</p>
                                    </div>
                                    {user?.referralCode && (
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(user.referralCode);
                                                toast.success("Referral code copied!");
                                            }}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 mx-auto"
                                        >
                                            Copy Code ({user.referralCode})
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm overflow-x-auto min-w-[320px]">
                                    {/* Root User Node */}
                                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3 shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                            Me
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-slate-800 truncate">{treeData.name} (You)</h4>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">Ref Code: {treeData.referralCode} • {treeData.phone}</p>
                                        </div>
                                    </div>

                                    {/* Children tree */}
                                    {treeData.children && treeData.children.length > 0 && (
                                        <div className="mt-2 space-y-2 ml-[28px] relative">
                                            {treeData.children.map((child, idx) => (
                                                <ReferralNode
                                                    key={child._id}
                                                    node={child}
                                                    isLast={idx === treeData.children.length - 1}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;


