import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../../services/customerApi';

const money = (v) => Number(v || 0).toLocaleString('en-IN');

const STATUS_STYLE = {
    credited: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    not_eligible: 'bg-slate-100 text-slate-500',
};

/**
 * Refer & Earn cashback card for the customer profile. Renders nothing unless
 * the admin has enabled referral cashback, so it is invisible by default.
 */
const ReferEarnCard = ({ config, referUrl, appName }) => {
    const { t } = useTranslation('customer');
    const [rewards, setRewards] = useState({ totalEarned: 0, items: [] });
    const enabled = Boolean(config?.enabled) && Number(config?.rewardValue) > 0;

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        customerApi
            .getMyReferralRewards()
            .then((res) => {
                if (!cancelled && res?.data?.result) setRewards(res.data.result);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    if (!enabled) return null;

    const isPercent = config.rewardType === 'percent';
    const offer = !isPercent
        ? t('profile.referEarn.offerFixed', { amount: money(config.rewardValue) })
        : config.maxRewardAmount > 0
            ? t('profile.referEarn.offerPercentCap', { percent: config.rewardValue, cap: money(config.maxRewardAmount) })
            : t('profile.referEarn.offerPercent', { percent: config.rewardValue });

    const handleShare = async () => {
        const text = t('profile.referEarn.shareText', { app: appName || 'SevaFast' });
        try {
            if (navigator.share) {
                await navigator.share({ title: appName || 'SevaFast', text, url: referUrl });
                return;
            }
        } catch (error) {
            if (error?.name === 'AbortError') return;
        }
        try {
            await navigator.clipboard.writeText(`${text} ${referUrl}`);
            toast.success(t('profile.referEarn.copied'));
        } catch {
            toast.error(referUrl);
        }
    };

    const statusLabel = {
        credited: t('profile.referEarn.credited'),
        pending: t('profile.referEarn.pending'),
        not_eligible: t('profile.referEarn.notEligible'),
    };

    return (
        <div className="mb-4 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-lg">
            <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/20 p-2.5 shrink-0">
                    <Gift className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-white/80">{t('profile.referEarn.title')}</p>
                    <p className="mt-1 text-sm font-black leading-snug">{offer}</p>
                    <p className="mt-1 text-[11px] font-semibold text-white/80 leading-snug">
                        {config.minOrderValue > 0 && <>{t('profile.referEarn.minOrder', { amount: money(config.minOrderValue) })} </>}
                        {t('profile.referEarn.howItWorks')}
                    </p>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70">{t('profile.referEarn.earned')}</p>
                    <p className="text-lg font-black">₹{money(rewards.totalEarned)}</p>
                </div>
                <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-emerald-700 shadow active:scale-95 transition"
                >
                    <Share2 className="h-4 w-4" />
                    {t('profile.referEarn.share')}
                </button>
            </div>

            {rewards.items.length > 0 ? (
                <div className="mt-3 rounded-2xl bg-white p-3 text-slate-800">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {t('profile.referEarn.history')}
                    </p>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                        {rewards.items.slice(0, 20).map((item) => (
                            <li key={item._id} className="flex items-center justify-between gap-2 text-xs">
                                <span className="truncate font-bold">{item.friendName}</span>
                                <span className="flex items-center gap-2 shrink-0">
                                    {item.amount > 0 && <span className="font-black">₹{money(item.amount)}</span>}
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_STYLE[item.status] || STATUS_STYLE.not_eligible}`}>
                                        {statusLabel[item.status] || item.status}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="mt-3 text-[11px] font-semibold text-white/80">{t('profile.referEarn.empty')}</p>
            )}
        </div>
    );
};

export default ReferEarnCard;
