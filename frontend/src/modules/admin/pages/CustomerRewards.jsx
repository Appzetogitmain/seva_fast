import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '@shared/components/ui/Pagination';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { Gift, Plus, Trash2, RotateCw, ShieldAlert, PlayCircle, CheckCircle2, Wallet, Undo2, Search, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import { formatDate, formatDateTime } from '@shared/utils/formatDate';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const STATUS_VARIANT = { pending: 'warning', approved: 'primary', credited: 'success', reversed: 'error' };
const PROGRAM_LABEL = { site_cashback: 'Site Cashback', direct_slab: 'Direct Buy Slab' };

const Field = ({ label, hint, children }) => (
    <label className="block space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        {children}
        {hint && <span className="block text-[11px] font-medium text-slate-400">{hint}</span>}
    </label>
);
const inputCls = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-brand-500/40';

/* ------------------------------ Rules tab ------------------------------ */
const RulesTab = ({ config, onSaved }) => {
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [confirmPayouts, setConfirmPayouts] = useState(false);

    useEffect(() => {
        if (config) setForm(JSON.parse(JSON.stringify(config)));
    }, [config]);

    if (!form) return null;
    const sc = form.siteCashback;
    const ds = form.directSlab;
    const setSc = (k, v) => setForm((f) => ({ ...f, siteCashback: { ...f.siteCashback, [k]: v } }));
    const setDs = (k, v) => setForm((f) => ({ ...f, directSlab: { ...f.directSlab, [k]: v } }));
    const setSlab = (i, k, v) => setDs('slabs', ds.slabs.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));

    const save = async (extra = {}) => {
        try {
            setSaving(true);
            const res = await adminApi.updateCustomerRewardConfig({
                siteCashback: sc,
                directSlab: { ...ds, slabs: ds.slabs.map((s) => ({ minMonthlySpend: Number(s.minMonthlySpend || 0), minOrders: Number(s.minOrders || 0), reward: Number(s.reward) })) },
                ...extra,
            });
            toast.success(res.data?.message || 'Saved');
            onSaved(res.data?.result);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
            setConfirmPayouts(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className={cn('flex flex-col gap-3 rounded-xl p-4 ring-1 sm:flex-row sm:items-center sm:justify-between',
                form.payoutsEnabled ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200')}>
                <div className="flex items-start gap-3">
                    <ShieldAlert className={cn('mt-0.5 h-5 w-5', form.payoutsEnabled ? 'text-emerald-600' : 'text-amber-600')} />
                    <div>
                        <p className="text-sm font-black text-slate-900">
                            Wallet payouts are {form.payoutsEnabled ? 'ON' : 'OFF'}
                        </p>
                        <p className="text-xs font-medium text-slate-600">
                            {form.payoutsEnabled
                                ? `Rewards are tracked and credited for orders delivered since ${formatDate(form.effectiveFrom)}.`
                                : 'Nothing is tracked or credited yet. Use the Test Report to review, then switch payouts on once the rules are approved. Only orders delivered after switching on will qualify.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => (form.payoutsEnabled ? save({ payoutsEnabled: false }) : setConfirmPayouts(true))}
                    disabled={saving}
                    className={cn('rounded-lg px-4 py-2 text-xs font-black text-white', form.payoutsEnabled ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700')}
                >
                    {form.payoutsEnabled ? 'Pause payouts' : 'Enable payouts…'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="space-y-4 rounded-xl border-none p-5 ring-1 ring-slate-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900">Site Cashback</h3>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <input type="checkbox" checked={sc.enabled} onChange={(e) => setSc('enabled', e.target.checked)} /> Enabled
                        </label>
                    </div>
                    <p className="text-xs text-slate-500">
                        Budget per order = <b>{form.siteCashbackPercent}%</b> of that order&apos;s admin commission (set in Fees &amp; Charges).
                        Pending until the order is paid (online paid / COD cash collected) and its return window has closed; reversed if returned or refunded.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Min order value (₹)" hint="0 = any order"><input type="number" min="0" className={inputCls} value={sc.minOrderValue} onChange={(e) => setSc('minOrderValue', e.target.value)} /></Field>
                        <Field label="Max per order (₹)" hint="0 = full budget"><input type="number" min="0" className={inputCls} value={sc.maxPerOrder} onChange={(e) => setSc('maxPerOrder', e.target.value)} /></Field>
                        <Field label="Max per customer / month (₹)" hint="0 = no limit"><input type="number" min="0" className={inputCls} value={sc.maxPerCustomerPerMonth} onChange={(e) => setSc('maxPerCustomerPerMonth', e.target.value)} /></Field>
                        <Field label="Hold days after delivery" hint="Used when an order has no return deadline"><input type="number" min="0" className={inputCls} value={sc.holdDaysAfterDelivery} onChange={(e) => setSc('holdDaysAfterDelivery', e.target.value)} /></Field>
                    </div>
                </Card>

                <Card className="space-y-4 rounded-xl border-none p-5 ring-1 ring-slate-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900">Direct Customer Buy Slab</h3>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <input type="checkbox" checked={ds.enabled} onChange={(e) => setDs('enabled', e.target.checked)} /> Enabled
                        </label>
                    </div>
                    <p className="text-xs text-slate-500">
                        Monthly pool = <b>{form.directSlabPercent}%</b> of the month&apos;s admin commission on eligible orders. A customer qualifies for a slab when their eligible monthly spend <b>and</b> number of eligible orders both reach it; they get the highest reward among slabs met. If total rewards exceed the pool, all are scaled down to fit. Generated after month end, then verified and approved by admin.
                    </p>
                    <Field label="Verification days after month end"><input type="number" min="0" className={inputCls} value={ds.verificationDaysAfterMonthEnd} onChange={(e) => setDs('verificationDaysAfterMonthEnd', e.target.value)} /></Field>
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>Min monthly spend (₹)</span><span>Min orders / month</span><span>Reward (₹)</span><span />
                        </div>
                        {ds.slabs.length === 0 && (
                            <p className="rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-400">No slabs yet. Add at least one slab before enabling payouts.</p>
                        )}
                        {ds.slabs.map((s, i) => (
                            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                                <input type="number" min="0" className={inputCls} value={s.minMonthlySpend} onChange={(e) => setSlab(i, 'minMonthlySpend', e.target.value)} placeholder="0 = any" />
                                <input type="number" min="0" step="1" className={inputCls} value={s.minOrders ?? 0} onChange={(e) => setSlab(i, 'minOrders', e.target.value)} placeholder="0 = any" />
                                <input type="number" min="0" className={inputCls} value={s.reward} onChange={(e) => setSlab(i, 'reward', e.target.value)} />
                                <button onClick={() => setDs('slabs', ds.slabs.filter((_, idx) => idx !== i))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove slab">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        <button onClick={() => setDs('slabs', [...ds.slabs, { minMonthlySpend: '', minOrders: 1, reward: '' }])} className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
                            <Plus className="h-3.5 w-3.5" /> Add slab
                        </button>
                    </div>
                </Card>
            </div>

            <div className="flex justify-end">
                <button onClick={() => save()} disabled={saving} className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save rules'}
                </button>
            </div>

            <Modal isOpen={confirmPayouts} onClose={() => !saving && setConfirmPayouts(false)} title="Enable real wallet payouts?">
                <div className="space-y-4 text-sm text-slate-600">
                    <p>From now on, eligible customers will receive <b>real money in their wallets</b>: Site Cashback after settlement and the return window, and Buy Slab rewards after you approve each month.</p>
                    <p>Only orders delivered after this moment qualify. Make sure the reward rules and the Test Report have been approved.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setConfirmPayouts(false)} className="flex-1 rounded-lg bg-slate-100 py-2.5 text-xs font-bold text-slate-600">Cancel</button>
                        <button onClick={() => save({ payoutsEnabled: true })} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white">
                            Yes, enable payouts
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

/* ----------------------------- Rewards tab ----------------------------- */
const RewardsTab = ({ payoutsEnabled, initialSearch = '' }) => {
    const [filters, setFilters] = useState({ program: '', status: '', search: initialSearch });
    const [searchInput, setSearchInput] = useState(initialSearch);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [exporting, setExporting] = useState(false);
    const [data, setData] = useState({ items: [], total: 0, summary: [] });
    const [loading, setLoading] = useState(true);
    const [reverseTarget, setReverseTarget] = useState(null);
    const [reverseNote, setReverseNote] = useState('');
    const [historyOf, setHistoryOf] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: pageSize };
            if (filters.program) params.program = filters.program;
            if (filters.status) params.status = filters.status;
            if (filters.search) params.search = filters.search;
            const res = await adminApi.getCustomerRewards(params);
            setData(res.data?.result || { items: [], total: 0, summary: [] });
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to load rewards');
        } finally {
            setLoading(false);
        }
    }, [filters, page, pageSize]);

    useEffect(() => { load(); }, [load]);

    // Debounced search by customer name / phone / order ID
    useEffect(() => {
        const t = setTimeout(() => {
            const term = searchInput.trim();
            setFilters((f) => {
                if (f.search === term) return f;
                setPage(1);
                return { ...f, search: term };
            });
        }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const exportCsv = async () => {
        try {
            setExporting(true);
            const params = {};
            if (filters.program) params.program = filters.program;
            if (filters.status) params.status = filters.status;
            if (filters.search) params.search = filters.search;
            const res = await adminApi.exportCustomerRewards(params);
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `reward-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Export failed');
        } finally {
            setExporting(false);
        }
    };

    const act = async (fn, okMsg) => {
        try {
            await fn();
            toast.success(okMsg);
            load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Action failed');
        }
    };

    const totals = useMemo(() => {
        const t = {};
        for (const row of data.summary || []) {
            const k = row._id.status;
            t[k] = { count: (t[k]?.count || 0) + row.count, amount: (t[k]?.amount || 0) + row.amount };
        }
        return t;
    }, [data.summary]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {['pending', 'approved', 'credited', 'reversed'].map((s) => (
                    <div key={s} className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s}</p>
                        <p className="mt-0.5 text-lg font-black text-slate-900">{inr(totals[s]?.amount)}</p>
                        <p className="text-[11px] font-medium text-slate-400">{totals[s]?.count || 0} reward(s)</p>
                    </div>
                ))}
            </div>

            <Card className="overflow-hidden rounded-xl border-none ring-1 ring-slate-100">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Customer name, phone or order ID"
                            className={cn(inputCls, 'w-64 pl-8')}
                        />
                    </div>
                    <select className={cn(inputCls, 'w-auto')} value={filters.program} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, program: e.target.value })); }}>
                        <option value="">All programs</option>
                        <option value="site_cashback">Site Cashback</option>
                        <option value="direct_slab">Direct Buy Slab</option>
                    </select>
                    <select className={cn(inputCls, 'w-auto')} value={filters.status} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, status: e.target.value })); }}>
                        <option value="">All statuses</option>
                        {['pending', 'approved', 'credited', 'reversed'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={load} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                        <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
                    </button>
                    <button onClick={exportCsv} disabled={exporting} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
                        <Download className="h-3.5 w-3.5" /> {exporting ? 'Exporting…' : 'Export CSV'}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="px-4 py-2">Customer</th>
                                <th className="px-4 py-2">Program</th>
                                <th className="px-4 py-2">For</th>
                                <th className="px-4 py-2 text-right">Amount</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(data.items || []).map((r) => (
                                <tr key={r._id} className="text-sm">
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-slate-900">{r.customer?.name || 'Customer'}</p>
                                        <p className="text-[11px] text-slate-400">{r.customer?.phone}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{PROGRAM_LABEL[r.program]}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {r.program === 'site_cashback' ? r.orderId : `${r.period} · spend ${inr(r.monthlySpend)} · ${r.monthlyOrders || 0} order(s) · slab ${inr(r.slab?.minMonthlySpend)}+ / ${r.slab?.minOrders || 0}+ orders${r.scaleFactor < 1 ? ` · ×${r.scaleFactor}` : ''}`}
                                        {r.reason && r.status !== 'credited' && <p className="text-[11px] text-amber-600">{r.reason}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-slate-900">{inr(r.amount)}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => setHistoryOf(r)} title="View history">
                                            <Badge variant={STATUS_VARIANT[r.status]} className="text-[9px] font-black uppercase">{r.status}</Badge>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1.5">
                                            {r.status === 'pending' && (
                                                <button onClick={() => act(() => adminApi.approveCustomerReward(r._id, 'Verified by admin'), 'Approved')} className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700 hover:bg-brand-100">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                                </button>
                                            )}
                                            {r.status === 'approved' && payoutsEnabled && (
                                                <button onClick={() => act(() => adminApi.creditCustomerReward(r._id), 'Credited to wallet')} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">
                                                    <Wallet className="h-3.5 w-3.5" /> Credit
                                                </button>
                                            )}
                                            {r.status !== 'reversed' && (
                                                <button onClick={() => { setReverseTarget(r); setReverseNote(''); }} className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100">
                                                    <Undo2 className="h-3.5 w-3.5" /> Reverse
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && (data.items || []).length === 0 && (
                                <tr><td colSpan="6" className="px-4 py-10 text-center text-xs font-bold text-slate-400">
                                    No rewards yet.{!payoutsEnabled && ' Rewards are tracked only after payouts are enabled.'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-slate-100 px-4 py-3">
                    <Pagination
                        page={page}
                        totalPages={Math.max(Math.ceil((data.total || 0) / pageSize), 1)}
                        total={data.total || 0}
                        pageSize={pageSize}
                        onPageChange={(p) => setPage(p)}
                        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                        loading={loading}
                    />
                </div>
            </Card>

            <Modal isOpen={Boolean(reverseTarget)} onClose={() => setReverseTarget(null)} title="Reverse reward">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        {reverseTarget?.status === 'credited'
                            ? `${inr(reverseTarget?.amount)} will be deducted back from the customer's wallet.`
                            : 'This reward will be cancelled and never paid.'}
                    </p>
                    <textarea value={reverseNote} onChange={(e) => setReverseNote(e.target.value)} placeholder="Reason (required)" className={cn(inputCls, 'min-h-[80px]')} />
                    <button
                        disabled={!reverseNote.trim()}
                        onClick={() => act(() => adminApi.reverseCustomerReward(reverseTarget._id, reverseNote.trim()), 'Reward reversed').then(() => setReverseTarget(null))}
                        className="w-full rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                        Reverse
                    </button>
                </div>
            </Modal>

            <Modal isOpen={Boolean(historyOf)} onClose={() => setHistoryOf(null)} title="Reward history">
                <div className="space-y-2">
                    {(historyOf?.history || []).map((h, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3">
                            <div>
                                <Badge variant={STATUS_VARIANT[h.status]} className="text-[9px] font-black uppercase">{h.status}</Badge>
                                {h.note && <p className="mt-1 text-xs text-slate-600">{h.note}</p>}
                            </div>
                            <p className="shrink-0 text-[11px] font-semibold text-slate-400">{formatDateTime(h.at)}<br />{h.by === 'system' ? 'System' : 'Admin'}</p>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

/* --------------------------- Test report tab --------------------------- */
const TestReportTab = ({ config }) => {
    const [assumeSettled, setAssumeSettled] = useState(false);
    const [report, setReport] = useState(null);
    const [running, setRunning] = useState(false);

    const run = async () => {
        try {
            setRunning(true);
            const res = await adminApi.simulateCustomerRewards({ assumeSettled });
            setReport(res.data?.result || null);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Simulation failed');
        } finally {
            setRunning(false);
        }
    };

    const c = report?.cashback;
    return (
        <div className="space-y-4">
            <Card className="flex flex-col gap-3 rounded-xl border-none p-4 ring-1 ring-slate-100 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-black text-slate-900">Test calculation on real orders</p>
                    <p className="text-xs text-slate-500">Uses the saved rules ({config?.directSlab?.slabs?.length || 0} slab(s)). Nothing is created and no wallet is touched.</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input type="checkbox" checked={assumeSettled} onChange={(e) => setAssumeSettled(e.target.checked)} />
                        What-if: treat COD as collected
                    </label>
                    <button onClick={run} disabled={running} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                        <PlayCircle className="h-4 w-4" /> {running ? 'Running…' : 'Run test'}
                    </button>
                </div>
            </Card>

            {c && (
                <>
                    <Card className="rounded-xl border-none p-4 ring-1 ring-slate-100">
                        <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-900">Site Cashback ({report.config.siteCashbackPercent}% of commission)</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">
                            <div><p className="text-[10px] font-bold uppercase text-slate-400">Budget</p><p className="font-black">{inr(c.budget)}</p></div>
                            <div><p className="text-[10px] font-bold uppercase text-slate-400">Would approve</p><p className="font-black text-emerald-600">{c.wouldApprove} · {inr(c.wouldApproveAmount)}</p></div>
                            <div><p className="text-[10px] font-bold uppercase text-slate-400">Pending</p><p className="font-black text-amber-600">{c.pending} · {inr(c.pendingAmount)}</p></div>
                            <div><p className="text-[10px] font-bold uppercase text-slate-400">Reversed (returned)</p><p className="font-black text-rose-600">{c.reversed}</p></div>
                            <div><p className="text-[10px] font-bold uppercase text-slate-400">Not eligible</p><p className="font-black">{c.notEligible}</p></div>
                        </div>
                    </Card>
                    <Card className="overflow-hidden rounded-xl border-none ring-1 ring-slate-100">
                        <h4 className="p-4 pb-2 text-xs font-black uppercase tracking-widest text-slate-900">Direct Buy Slab by month ({report.config.directSlabPercent}% pool)</h4>
                        <table className="w-full text-left text-sm">
                            <thead><tr className="bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="px-4 py-2">Month</th><th className="px-4 py-2">Eligible orders</th><th className="px-4 py-2">Pool</th><th className="px-4 py-2">Winners</th><th className="px-4 py-2">Scale</th><th className="px-4 py-2 text-right">Payout</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {report.slabs.map((m) => (
                                    <tr key={m.period}>
                                        <td className="px-4 py-2 font-bold">{m.period}</td>
                                        <td className="px-4 py-2 text-xs text-slate-500">{m.eligibleOrders} <span className="text-slate-400">(excluded: {m.excluded.returned} returned, {m.excluded.unsettled} unpaid, {m.excluded.windowOpen} open)</span></td>
                                        <td className="px-4 py-2">{inr(m.pool)}</td>
                                        <td className="px-4 py-2 text-xs">{m.winners.length ? m.winners.map((w) => `${inr(w.spend)} (${w.orders} ord) → ${inr(w.amount)}`).join(', ') : '—'}</td>
                                        <td className="px-4 py-2 text-xs">{m.scaleFactor < 1 ? `×${m.scaleFactor}` : '—'}</td>
                                        <td className="px-4 py-2 text-right font-black">{inr(m.totalPayout)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}
        </div>
    );
};

/* -------------------------------- Page -------------------------------- */
const CustomerRewards = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const TABS = ['rules', 'rewards', 'test'];
    const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'rules';
    const setTab = (t) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', t);
        setSearchParams(next);
    };
    const [config, setConfig] = useState(null);

    useEffect(() => {
        adminApi.getCustomerRewardConfig()
            .then((res) => setConfig(res.data?.result || null))
            .catch((e) => toast.error(e.response?.data?.message || 'Failed to load reward settings'));
    }, []);

    return (
        <div className="space-y-4 pb-10">
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><Gift className="h-5 w-5" /></div>
                <div>
                    <h1 className="text-xl font-black text-slate-900">Customer Rewards</h1>
                    <p className="text-xs font-medium text-slate-500">Site Cashback and Direct Buy Slab, funded from the admin commission.</p>
                </div>
            </div>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
                {[['rules', 'Rules'], ['rewards', 'Rewards'], ['test', 'Test Report']].map(([k, l]) => (
                    <button key={k} onClick={() => setTab(k)} className={cn('rounded-lg px-4 py-1.5 text-xs font-black', tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{l}</button>
                ))}
            </div>
            {tab === 'rules' && <RulesTab config={config} onSaved={setConfig} />}
            {tab === 'rewards' && <RewardsTab payoutsEnabled={config?.payoutsEnabled} initialSearch={searchParams.get('q') || ''} />}
            {tab === 'test' && <TestReportTab config={config} />}
        </div>
    );
};

export default CustomerRewards;
