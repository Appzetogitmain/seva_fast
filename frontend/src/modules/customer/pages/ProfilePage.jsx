import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    User, MapPin, Package, CreditCard, Wallet, ChevronRight, ChevronDown,
    LogOut, ShieldCheck, Heart, HelpCircle, Info, Edit2, ChevronLeft, Bell,
    Share2, Copy, Sparkles, Camera, X, Users, Briefcase
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

const TEST_PUSH_STATUS_POLL_INTERVAL_MS = 1500;
const TEST_PUSH_STATUS_MAX_ATTEMPTS = 20;

function getReferrerDisplayName(referredBy) {
    if (!referredBy) return null;
    if (typeof referredBy === 'object') {
        return referredBy.name || referredBy.referralCode || null;
    }
    return null;
}

const ProfilePage = () => {
    const navigate = useNavigate();
    const { user, role } = useAuth();
    const { requestSignOut, signOutDialog } = useSignOutConfirmation();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
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

    const handleShare = async () => {
        const shareData = {
            title: appName,
            text: `Check out ${appName}!`,
            url: window.location.origin,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(window.location.origin);
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
            toast.error('Failed to trigger test push', {
                description: message,
            });
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

                {/* User Identity Card */}
                <div 
                    onClick={() => setIsReferralTreeModalOpen(true)}
                    className="group relative overflow-hidden rounded-none mb-2 cursor-pointer transition-all duration-300 hover:brightness-105 active:scale-[0.995] shadow-[0_16px_40px_-18px_rgba(234,88,12,0.45)]"
                >
                    <div className="relative overflow-hidden rounded-none bg-gradient-to-br from-orange-500 via-amber-400 to-green-500 text-white p-3.5 sm:p-4">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-orange-600/30 via-transparent to-green-600/35" />
                        <div className="pointer-events-none absolute inset-0 bg-black/10" />
                        <div className="pointer-events-none absolute inset-0 opacity-25 bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.12)_0px,rgba(255,255,255,0.12)_1px,transparent_1px,transparent_8px)]" />

                        <div className="relative z-10 flex justify-between items-center mb-2.5">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-9 rounded-none bg-white/25 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.55),0_4px_10px_rgba(0,0,0,0.2)] border border-white/35 relative overflow-hidden">
                                    <div className="absolute inset-x-1 top-1.5 h-px bg-white/60" />
                                    <div className="absolute inset-x-1 top-3 h-px bg-white/45" />
                                    <div className="absolute inset-y-1.5 left-2.5 w-px bg-white/40" />
                                </div>
                                <span className="text-xs sm:text-sm font-black italic tracking-[0.18em] text-white drop-shadow-sm">
                                    SEVA FAST
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleShare();
                                    }}
                                    className="p-1.5 rounded-none bg-white/10 hover:bg-white/20 border border-white/15 transition-all backdrop-blur-md cursor-pointer active:scale-95 flex items-center justify-center"
                                    title="Share"
                                >
                                    <Share2 size={13} className="text-white" />
                                </button>
                                <Link 
                                    to="/profile/edit" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-none bg-white/10 hover:bg-white/20 border border-white/15 transition-all backdrop-blur-md" 
                                    title="Edit Profile"
                                >
                                    <Edit2 size={13} className="text-white" />
                                </Link>
                            </div>
                        </div>

                        <div className="relative z-10 flex justify-between gap-3">
                            <div className="flex flex-col flex-1 min-w-0">
                                <div>
                                    <h2 className="text-lg leading-tight font-black text-white tracking-wide">
                                        {user?.name || 'Customer'}
                                    </h2>
                                    <p className="text-white/90 text-[11px] font-medium flex items-center gap-1 mt-1 mb-1.5 drop-shadow-sm">
                                        <span className="bg-black/20 border border-white/20 px-1.5 py-px rounded-none text-[9px] uppercase text-white font-bold tracking-wider">
                                            India
                                        </span>
                                        <span className="truncate">+91 {formatIndiaPhone(user?.phone)}</span>
                                    </p>
                                    {getReferrerDisplayName(user?.referredBy) && (
                                        <div className="flex items-center bg-black/20 border border-white/20 text-white px-2 py-0.5 rounded-none w-fit">
                                            <span className="text-[9px] font-black uppercase tracking-wider">
                                                Referred By: {getReferrerDisplayName(user.referredBy)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3">
                                    <p className="text-[8px] text-white/85 uppercase tracking-[0.2em] mb-0.5 font-bold drop-shadow-sm">
                                        Referral Code
                                    </p>
                                    {user?.referralCode ? (
                                        <div 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(user.referralCode);
                                                toast.success("Referral code copied to clipboard!");
                                            }}
                                            className="flex items-center gap-1.5 cursor-pointer group w-fit"
                                        >
                                            <span className="text-base font-bold font-mono tracking-[0.16em] text-white group-hover:text-white/90 transition-colors drop-shadow-sm">
                                                {user.referralCode}
                                            </span>
                                            <Copy size={12} className="opacity-75 group-hover:opacity-100 text-white transition-opacity" />
                                        </div>
                                    ) : (
                                        <span className="text-xs font-mono opacity-50 tracking-widest">N/A</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-end justify-between flex-shrink-0">
                                {user?.referralCode && (
                                    <div className="flex flex-col items-center">
                                        <div className="bg-white p-1 rounded-none shadow-md ring-1 ring-white/70">
                                            <img 
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/signup?ref=${user.referralCode}`)}`} 
                                                alt="Signup QR Code" 
                                                className="w-[58px] h-[58px] object-contain"
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                        <span className="text-[7px] font-black uppercase tracking-[0.16em] text-white/90 mt-1 text-center leading-tight drop-shadow-sm">
                                            Scan to Join
                                        </span>
                                    </div>
                                )}

                                <div className="text-right mt-2">
                                    <p className="text-[8px] text-white/85 uppercase tracking-[0.2em] mb-0.5 font-bold drop-shadow-sm">
                                        Valid Thru
                                    </p>
                                    <div className="text-sm font-bold font-mono tracking-[0.14em] text-white drop-shadow-sm">
                                        {user?.currentPlan && user?.planExpiry ? new Date(user.planExpiry).toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' }).replace('/', ' / ') : 'N / A'}
                                    </div>
                                </div>
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

const CustomPhotoOrderModal = ({ isOpen, onClose }) => {
    const [file, setFile] = React.useState(null);
    const [city, setCity] = React.useState('');
    const [sellers, setSellers] = React.useState([]);
    const [selectedSellerId, setSelectedSellerId] = React.useState('');
    const [isOpenDropdown, setIsOpenDropdown] = React.useState(false);
    const [notes, setNotes] = React.useState('');
    const [isUploading, setIsUploading] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (isOpen && city.length > 2) {
            fetchSellers();
        }
    }, [city, isOpen]);

    const fetchSellers = async () => {
        try {
            const res = await axiosInstance.get(`/photo-orders/sellers?city=${city}`);
            setSellers(res.data.result || res.data.results || []);
        } catch (error) {
            console.error("Failed to fetch sellers:", error);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return toast.error("Please select an image");
        if (!selectedSellerId) return toast.error("Please select a seller");

        try {
            setIsSubmitting(true);
            setIsUploading(true);
            
            const formData = new FormData();
            formData.append('file', file);
            
            const uploadRes = await axiosInstance.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            const photoUrl = uploadRes.data.result.url;
            setIsUploading(false);

            await axiosInstance.post('/photo-orders', {
                sellerId: selectedSellerId,
                photoUrl,
                notes,
                city
            });

            toast.success("Custom photo order sent to seller!");
            onClose();
            // Reset
            setFile(null);
            setCity('');
            setSelectedSellerId('');
            setNotes('');
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to send photo order");
            setIsUploading(false);
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Camera size={18} className="text-brand-600" />
                        Send Photo to Seller
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your City</label>
                        <input 
                            type="text" 
                            placeholder="Type your city to find sellers..." 
                            value={city} 
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 outline-none transition-colors"
                        />
                    </div>
                    
                    {city.length > 2 && (
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Seller</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsOpenDropdown(!isOpenDropdown)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 outline-none transition-colors text-left flex items-center justify-between font-semibold text-slate-700"
                                >
                                    <span>
                                        {selectedSellerId 
                                            ? `${sellers.find(s => s._id === selectedSellerId)?.name || 'Seller'} (${sellers.find(s => s._id === selectedSellerId)?.shopName || 'Store'})` 
                                            : '-- Choose a seller --'
                                        }
                                    </span>
                                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpenDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {isOpenDropdown && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                        <div 
                                            onClick={() => {
                                                setSelectedSellerId('');
                                                setIsOpenDropdown(false);
                                            }}
                                            className="px-4 py-2.5 hover:bg-slate-50 text-xs font-semibold text-slate-400 cursor-pointer transition-colors"
                                        >
                                            -- Choose a seller --
                                        </div>
                                        {sellers.length === 0 ? (
                                            <div className="px-4 py-3 text-xs font-semibold text-slate-400 text-center">
                                                No enabled sellers found in this city
                                            </div>
                                        ) : (
                                            sellers.map(s => (
                                                <div
                                                    key={s._id}
                                                    onClick={() => {
                                                        setSelectedSellerId(s._id);
                                                        setIsOpenDropdown(false);
                                                    }}
                                                    className="px-4 py-2.5 hover:bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer border-t border-slate-50 transition-colors flex items-center justify-between"
                                                >
                                                    <span>{s.name}</span>
                                                    <span className="text-xs text-slate-400 font-normal">({s.shopName || 'Store'})</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Upload Photo (List)</label>
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center relative bg-slate-50 hover:bg-slate-100 transition-colors">
                            {file ? (
                                <div className="text-sm font-semibold text-brand-600 flex items-center gap-2">
                                    <Sparkles size={16} /> Selected: {file.name}
                                </div>
                            ) : (
                                <>
                                    <Camera size={24} className="text-slate-400 mb-2" />
                                    <span className="text-sm font-medium text-slate-600">Tap to select an image</span>
                                </>
                            )}
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Additional Notes (Optional)</label>
                        <textarea 
                            rows="2"
                            placeholder="Any specific instructions..." 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand-500 outline-none transition-colors resize-none"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isSubmitting || !file || !selectedSellerId}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Camera size={18} />
                        )}
                        {isUploading ? "Uploading Image..." : "Send Request"}
                    </button>
                </form>
            </div>
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
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Referrals</p>
                                    <p className="text-xl font-extrabold text-indigo-600">{stats.total}</p>
                                    <p className="text-[9px] font-black text-indigo-500 mt-0.5">₹{totalEarnings.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level 1</p>
                                    <p className="text-xl font-extrabold text-emerald-600">{stats.levels[1] || 0}</p>
                                    <p className="text-[9px] font-black text-emerald-500 mt-0.5">₹{level1Earnings.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level 2+</p>
                                    <p className="text-xl font-extrabold text-amber-600">
                                        {Object.entries(stats.levels)
                                            .filter(([lvl]) => Number(lvl) > 1)
                                            .reduce((sum, [, count]) => sum + count, 0)}
                                    </p>
                                    <p className="text-[9px] font-black text-amber-500 mt-0.5">₹{level2PlusEarnings.toFixed(2)}</p>
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


