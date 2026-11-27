import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    PieChart,
    Wallet,
    Shield,
    Users,
    Megaphone,
    Wrench,
    Gift,
    Percent,
    ArrowRight,
    RotateCw,
    Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { formatDate } from '@shared/utils/formatDate';

const groupLabels = {
    platform: 'Platform Splits',
    operations: 'Operations & Network',
    incentives: 'Target Incentives',
    discounts: 'Club Discounts',
};

const statusStyles = {
    credited: 'success',
    tracked: 'warning',
    discount: 'secondary',
    retained: 'primary',
};

const CommissionSplitsReport = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [report, setReport] = useState({
        totals: {},
        splits: [],
        subAdminWallets: [],
        recentCredits: [],
    });

    const fetchReport = async () => {
        try {
            setLoading(true);
            const params = {};
            if (fromDate) params.fromDate = fromDate;
            if (toDate) params.toDate = toDate;
            const res = await adminApi.getCommissionSplitsReport(params);
            if (res.data.success) {
                setReport(res.data.result || {});
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load splits report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromDate, toDate]);

    const totals = report.totals || {};
    const splitsByGroup = (report.splits || []).reduce((acc, split) => {
        const key = split.group || 'other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(split);
        return acc;
    }, {});

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1">Commission Splits Report</h1>
                    <p className="ds-description mt-1">
                        Every split is a % of the <span className="font-bold text-slate-700">admin commission</span> on delivered orders (returned orders excluded).
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white ring-1 ring-slate-200 rounded-xl px-3 py-1.5">
                        <input
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                            aria-label="From date"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(e) => setToDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                            aria-label="To date"
                        />
                        {(fromDate || toDate) && (
                            <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase">
                                Clear
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => navigate('/admin/billing')}
                        className="px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                        Edit Rates
                    </button>
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50"
                    >
                        <RotateCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Delivered Orders', value: totals.orderCount || 0, prefix: '' },
                    { label: 'Admin Commission', value: totals.adminCommission || 0, prefix: '₹', highlight: true },
                    { label: 'Distributed (Splits)', value: totals.distributedTotal || 0, prefix: '₹' },
                    { label: 'Kept by Platform', value: totals.platformRetained || 0, prefix: '₹' },
                ].map((card) => (
                    <Card
                        key={card.label}
                        className={cn(
                            'p-4 border-none shadow-sm ring-1',
                            card.highlight ? 'ring-fuchsia-100 bg-fuchsia-50' : 'ring-slate-100 bg-white',
                        )}
                    >
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
                        <p className={cn('text-2xl font-black mt-1', card.highlight ? 'text-fuchsia-700' : 'text-slate-900')}>
                            {card.prefix}{Number(card.value).toLocaleString('en-IN')}
                        </p>
                    </Card>
                ))}
            </div>

            {Number(totals.estimatedOrders || 0) > 0 && (
                <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-xs font-semibold text-amber-800">
                    {totals.estimatedOrders} of {totals.orderCount} orders were placed before split tracking was fixed, so their split amounts are
                    <span className="font-black"> estimated</span> from today&apos;s rates and were <span className="font-black">not paid out</span>.
                    New orders store and pay their exact split on delivery.
                </div>
            )}

            {/* Split totals by billing category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(splitsByGroup).map(([group, items]) => (
                    <Card key={group} className="border-none shadow-xl ring-1 ring-slate-100 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-fuchsia-600" />
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                                {groupLabels[group] || group}
                            </h2>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {items.map((split) => (
                                <div key={split.key} className="px-5 py-3.5 flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {split.label}
                                            {split.ratePercent !== undefined && (
                                                <span className="ml-2 text-[10px] font-black text-slate-400">{split.ratePercent}% of commission</span>
                                            )}
                                        </p>
                                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{split.creditedTo}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black text-slate-900">
                                            ₹{Number(split.amount || 0).toLocaleString('en-IN')}
                                        </p>
                                        <Badge variant={statusStyles[split.status] || 'secondary'} className="text-[8px] font-black mt-1">
                                            {split.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>

            {/* Sub-Admin Wallets — created by admin panel */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-indigo-600" />
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Sub-Admin Wallets</h2>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                Panel sub-admins get commission when seller&apos;s zone matches their assigned zones
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/admin/users')}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1"
                    >
                        Manage Sub-Admins <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-sm font-bold text-slate-400">Loading wallets...</div>
                ) : (report.subAdminWallets || []).length === 0 ? (
                    <div className="py-16 text-center">
                        <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-400">No sub-admins created yet</p>
                        <button
                            onClick={() => navigate('/admin/users')}
                            className="mt-3 text-xs font-black uppercase text-indigo-600"
                        >
                            Create Sub-Admin
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <th className="ds-table-header-cell pl-5">Sub-Admin</th>
                                    <th className="ds-table-header-cell">Zones</th>
                                    <th className="ds-table-header-cell text-center">Available</th>
                                    <th className="ds-table-header-cell text-center">Total Credited</th>
                                    <th className="ds-table-header-cell text-right pr-5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {report.subAdminWallets.map((sa) => (
                                    <tr key={sa._id} className="hover:bg-indigo-50/30">
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-black text-slate-900">{sa.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400">{sa.email}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(sa.zones || []).length === 0 ? (
                                                    <span className="text-[10px] font-bold text-amber-600">No zone — commissions won&apos;t credit</span>
                                                ) : (
                                                    sa.zones.map((z) => (
                                                        <Badge key={z} variant="secondary" className="text-[8px] font-black">{z}</Badge>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-sm font-black text-emerald-700">
                                                ₹{Number(sa.availableBalance || 0).toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-sm font-bold text-slate-700">
                                                ₹{Number(sa.totalCredited || 0).toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={() => navigate('/admin/users')}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-slate-900 text-white"
                                            >
                                                <Wallet className="h-3 w-3" /> Wallet
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Recent credits */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Gift className="h-4 w-4 text-amber-600" />
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Split Credits</h2>
                </div>
                {(report.recentCredits || []).length === 0 ? (
                    <div className="py-12 text-center text-sm font-bold text-slate-400">
                        No commission credits yet — appear after order delivery
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {report.recentCredits.map((txn) => (
                            <div key={txn.id} className="px-5 py-3 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{txn.type}</p>
                                    <p className="text-[11px] font-semibold text-slate-400">
                                        {txn.userName} {txn.userPhone ? `· ${txn.userPhone}` : ''} · {txn.reference}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-emerald-700">+₹{Number(txn.amount || 0).toLocaleString('en-IN')}</p>
                                    <p className="text-[10px] font-bold text-slate-400">
                                        {txn.date ? formatDate(txn.date) : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card className="p-5 border-none ring-1 ring-slate-100 bg-slate-50 rounded-2xl">
                <p className="text-xs font-bold text-slate-600 leading-relaxed">
                    <Percent className="h-3.5 w-3.5 inline mr-1 text-fuchsia-600" />
                    <strong>How Sub-Admin wallet works:</strong> When you create a Sub-Admin under{' '}
                    <button type="button" className="text-indigo-600 underline" onClick={() => navigate('/admin/users')}>
                        Sub-Admins
                    </button>
                    {' '}and assign zones, a wallet is created automatically. On order delivery, if the seller&apos;s zone
                    matches that Sub-Admin, the Sub Admin % from Billing goes to their wallet. Assign zones or commissions stay uncredited.
                </p>
                <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> Technical / Maintenance = tracked only</span>
                    <span className="flex items-center gap-1"><Megaphone className="h-3 w-3" /> Advertise = tracked only</span>
                    <span className="flex items-center gap-1"><Store className="h-3 w-3" /> Admin Commission = platform earning</span>
                </div>
            </Card>
        </div>
    );
};

export default CommissionSplitsReport;
