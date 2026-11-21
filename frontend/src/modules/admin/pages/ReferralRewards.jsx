import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ShieldAlert, Check, X, Loader2, Settings } from 'lucide-react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import PageHeader from '@shared/components/ui/PageHeader';
import Pagination from '@shared/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDate } from '@shared/utils/formatDate';
import { adminApi } from '../services/adminApi';

const STATUS_TABS = [
    { id: '', label: 'All' },
    { id: 'flagged', label: 'Needs review' },
    { id: 'credited', label: 'Credited' },
    { id: 'failed', label: 'Failed' },
    { id: 'ineligible', label: 'Not eligible' },
    { id: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE = {
    credited: 'success',
    flagged: 'warning',
    failed: 'error',
    rejected: 'error',
    ineligible: 'gray',
    processing: 'info',
};

const SIGNAL_LABELS = {
    same_device_as_referrer: 'Same device as referrer',
    same_signup_network_as_referrer: 'Same network (IP) as referrer',
    delivery_phone_matches_referrer: "Delivery phone is referrer's",
    delivery_address_matches_referrer: "Delivery address is referrer's",
};

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const ReferralRewards = () => {
    const [status, setStatus] = useState('flagged');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [data, setData] = useState({ items: [], total: 0, counts: {}, totalCreditedAmount: 0, config: null });
    const [loading, setLoading] = useState(true);
    const [actingId, setActingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getReferralRewards({ status: status || undefined, page, limit: pageSize });
            setData(res.data?.result || { items: [], total: 0, counts: {} });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to load referral rewards');
        } finally {
            setLoading(false);
        }
    }, [status, page, pageSize]);

    useEffect(() => {
        load();
    }, [load]);

    const act = async (reward, action) => {
        const verb = action === 'approve' ? 'credit' : 'reject';
        const confirmText =
            action === 'approve'
                ? `Credit ${money(reward.amount)} to ${reward.referrer?.name || 'the referrer'}'s wallet?`
                : `Reject this cashback? ${reward.referrer?.name || 'The referrer'} will not be paid.`;
        if (!window.confirm(confirmText)) return;

        setActingId(reward._id);
        try {
            if (action === 'approve') await adminApi.approveReferralReward(reward._id);
            else await adminApi.rejectReferralReward(reward._id);
            toast.success(action === 'approve' ? 'Cashback credited' : 'Cashback rejected');
            await load();
        } catch (error) {
            toast.error(error?.response?.data?.message || `Failed to ${verb} cashback`);
        } finally {
            setActingId(null);
        }
    };

    const cfg = data.config;
    const counts = data.counts || {};

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Referral Cashback"
                description="Refer & Earn rewards paid when a referred friend's first order completes its return window"
                badge={
                    <div className="ds-stat-card-icon bg-emerald-50">
                        <Wallet className="ds-icon-lg text-emerald-600" />
                    </div>
                }
                actions={
                    <Link
                        to="/admin/settings"
                        className="px-4 py-2 bg-white ring-1 ring-slate-200 hover:ring-slate-300 text-slate-700 font-extrabold text-xs rounded-xl flex items-center gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        Cashback settings
                    </Link>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                    <p className={cn('text-lg font-black mt-1', cfg?.enabled ? 'text-emerald-600' : 'text-slate-400')}>
                        {cfg?.enabled ? 'Enabled' : 'Disabled'}
                    </p>
                    {cfg?.enabled && (
                        <p className="text-[11px] font-bold text-slate-500 mt-1">
                            {cfg.rewardType === 'percent'
                                ? `${cfg.rewardValue}% of order${cfg.maxRewardAmount > 0 ? `, max ${money(cfg.maxRewardAmount)}` : ''}`
                                : `${money(cfg.rewardValue)} per referral`}
                            {cfg.minOrderValue > 0 ? ` · min order ${money(cfg.minOrderValue)}` : ''}
                        </p>
                    )}
                </Card>
                <Card className="p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total paid</p>
                    <p className="text-lg font-black mt-1 text-slate-900">{money(data.totalCreditedAmount)}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">{counts.credited || 0} rewards credited</p>
                </Card>
                <Card className={cn('p-4', counts.flagged > 0 && 'ring-2 ring-amber-300')}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Needs review</p>
                    <p className="text-lg font-black mt-1 text-amber-600">{counts.flagged || 0}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">Held for possible fraud</p>
                </Card>
                <Card className="p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Failed</p>
                    <p className="text-lg font-black mt-1 text-red-600">{counts.failed || 0}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">Credit errors, can retry</p>
                </Card>
            </div>

            <Card className="overflow-hidden">
                <div className="flex gap-2 p-3 border-b border-slate-100 overflow-x-auto no-scrollbar">
                    {STATUS_TABS.map((tab) => (
                        <button
                            key={tab.id || 'all'}
                            type="button"
                            onClick={() => {
                                setStatus(tab.id);
                                setPage(1);
                            }}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-colors',
                                status === tab.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                            )}
                        >
                            {tab.label}
                            {tab.id && counts[tab.id] > 0 ? ` (${counts[tab.id]})` : ''}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : data.items.length === 0 ? (
                    <div className="p-12 text-center text-sm font-bold text-slate-400">No referral rewards here yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-4 py-3">Referrer</th>
                                    <th className="px-4 py-3">Friend</th>
                                    <th className="px-4 py-3">Order</th>
                                    <th className="px-4 py-3">Cashback</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.items.map((r) => {
                                    const canAct = r.status === 'flagged' || r.status === 'failed';
                                    return (
                                        <tr key={r._id} className="align-top">
                                            <td className="px-4 py-3">
                                                <p className="font-black text-slate-900">{r.referrer?.name || '—'}</p>
                                                <p className="text-slate-500">{r.referrer?.phone}</p>
                                                <p className="text-[10px] text-slate-400">Code: {r.referrer?.referralCode}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-800">{r.referredCustomer?.name || '—'}</p>
                                                <p className="text-slate-500">{r.referredCustomer?.phone}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-800">{r.orderId || '—'}</p>
                                                <p className="text-slate-500">{money(r.orderAmount)}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-black text-slate-900">{money(r.amount)}</p>
                                                <p className="text-[10px] text-slate-400">
                                                    {r.rewardType === 'percent' ? `${r.rewardValue}%` : 'fixed'}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 max-w-[260px]">
                                                <Badge variant={STATUS_BADGE[r.status] || 'gray'}>{r.status}</Badge>
                                                {r.fraudSignals?.length > 0 && (
                                                    <ul className="mt-2 space-y-1">
                                                        {r.fraudSignals.map((sig) => (
                                                            <li key={sig} className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                                                                <ShieldAlert className="h-3 w-3 shrink-0" />
                                                                {SIGNAL_LABELS[sig] || sig}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {r.reason && r.status !== 'flagged' && (
                                                    <p className="mt-1 text-[11px] text-slate-500">{r.reason}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                                {formatDate(r.creditedAt || r.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                {canAct ? (
                                                    <div className="inline-flex gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={actingId === r._id}
                                                            onClick={() => act(r, 'approve')}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black disabled:opacity-50"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                            {r.status === 'failed' ? 'Retry' : 'Approve'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={actingId === r._id}
                                                            onClick={() => act(r, 'reject')}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white ring-1 ring-red-200 text-red-600 hover:bg-red-50 font-black disabled:opacity-50"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination
                    page={page}
                    totalPages={Math.max(1, Math.ceil((data.total || 0) / pageSize))}
                    total={data.total || 0}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                    loading={loading}
                />
            </Card>
        </div>
    );
};

export default ReferralRewards;
