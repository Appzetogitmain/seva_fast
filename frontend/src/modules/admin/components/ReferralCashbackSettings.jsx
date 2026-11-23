import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import Card from '@shared/components/ui/Card';
import { cn } from '@/lib/utils';

const inputCls =
    'w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all';
const labelCls = 'text-[10px] font-black text-slate-400 uppercase tracking-widest';
const num = (v) => Math.max(0, Number(v) || 0);

/**
 * Admin settings section for Refer & Earn cashback. Stateless — the parent
 * AdminSettings page owns the value and saves it with the rest of settings.
 */
const ReferralCashbackSettings = ({ value: rc, onChange }) => {
    const isPercent = rc.rewardType === 'percent';
    const sampleOrder = 1000;
    let sampleReward = isPercent ? Math.round(sampleOrder * rc.rewardValue) / 100 : rc.rewardValue;
    if (isPercent && rc.maxRewardAmount > 0) sampleReward = Math.min(sampleReward, rc.maxRewardAmount);

    return (
        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-gradient-to-r from-emerald-500/10 via-brand-500/5 to-transparent flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-emerald-600" />
                        Refer &amp; Earn Cashback
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium max-w-xl">
                        The referrer gets a one-time wallet cashback once their friend&apos;s first order is delivered
                        and its return window closes without a return. Runs alongside the MLM level commission.
                    </p>
                </div>
                <Link
                    to="/admin/referral-rewards"
                    className="text-xs font-black text-brand-600 hover:text-brand-700 underline underline-offset-4"
                >
                    View rewards &amp; review flagged →
                </Link>
            </div>

            <div className="p-8 space-y-6">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-black text-slate-900">Enable Referral Cashback</p>
                        <p className="text-xs font-bold text-slate-500 mt-1">
                            Only orders delivered after you switch this on qualify. Nothing is paid retroactively.
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={rc.enabled}
                        onClick={() => onChange('enabled', !rc.enabled)}
                        className={cn(
                            'relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200',
                            rc.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                        )}
                    >
                        <span
                            className={cn(
                                'inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200',
                                rc.enabled ? 'translate-x-7' : 'translate-x-1'
                            )}
                        />
                    </button>
                </div>

                <div className="space-y-3">
                    <label className={labelCls}>Cashback Type</label>
                    <div role="radiogroup" aria-label="Cashback type" className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                        {[
                            {
                                id: 'fixed',
                                symbol: '₹',
                                label: 'Fixed amount',
                                hint: 'Same cashback on every referral, e.g. ₹50',
                            },
                            {
                                id: 'percent',
                                symbol: '%',
                                label: 'Percentage of order',
                                hint: "A share of the friend's first order, e.g. 5%",
                            },
                        ].map((opt) => {
                            const selected = rc.rewardType === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => onChange('rewardType', opt.id)}
                                    className={cn(
                                        'flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all',
                                        selected
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black',
                                            selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                                        )}
                                    >
                                        {opt.symbol}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-black text-slate-900">{opt.label}</span>
                                        <span className="block text-[11px] font-medium text-slate-500 mt-0.5">{opt.hint}</span>
                                    </span>
                                    <span
                                        className={cn(
                                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                                            selected ? 'border-emerald-500' : 'border-slate-300'
                                        )}
                                    >
                                        {selected && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <label className={labelCls}>{isPercent ? 'Cashback Percentage (%)' : 'Cashback Amount (₹)'}</label>
                        <input
                            type="number"
                            min={0}
                            max={isPercent ? 100 : undefined}
                            value={rc.rewardValue}
                            onChange={(e) =>
                                onChange('rewardValue', isPercent ? Math.min(100, num(e.target.value)) : num(e.target.value))
                            }
                            className={inputCls}
                        />
                    </div>
                    {isPercent && (
                        <div className="space-y-3">
                            <label className={labelCls}>Maximum Cashback (₹), 0 = no cap</label>
                            <input
                                type="number"
                                min={0}
                                value={rc.maxRewardAmount}
                                onChange={(e) => onChange('maxRewardAmount', num(e.target.value))}
                                className={inputCls}
                            />
                        </div>
                    )}
                    <div className="space-y-3">
                        <label className={labelCls}>Minimum Order Value (₹)</label>
                        <input
                            type="number"
                            min={0}
                            value={rc.minOrderValue}
                            onChange={(e) => onChange('minOrderValue', num(e.target.value))}
                            className={inputCls}
                        />
                        <p className="text-[10px] font-bold text-slate-400 italic">
                            Checked against the items subtotal of the friend&apos;s first order.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <label className={labelCls}>Max Rewards per Referrer per Month, 0 = unlimited</label>
                        <input
                            type="number"
                            min={0}
                            step={1}
                            value={rc.maxRewardsPerReferrerPerMonth}
                            onChange={(e) => onChange('maxRewardsPerReferrerPerMonth', Math.floor(num(e.target.value)))}
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-xs font-bold text-emerald-900 leading-relaxed">
                    Example: a friend&apos;s first order of ₹{sampleOrder.toLocaleString('en-IN')} →{' '}
                    {sampleOrder < rc.minOrderValue ? (
                        <>no cashback (below the ₹{rc.minOrderValue} minimum).</>
                    ) : (
                        <>
                            the referrer gets{' '}
                            <span className="font-black">₹{Number(sampleReward || 0).toLocaleString('en-IN')}</span> after
                            the return window closes.
                        </>
                    )}
                    <br />
                    Referrals from the same device, network, phone or address as the referrer are held for your review
                    instead of being paid automatically.
                </div>
            </div>
        </Card>
    );
};

export default ReferralCashbackSettings;
