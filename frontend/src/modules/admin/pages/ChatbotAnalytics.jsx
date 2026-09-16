import React, { useState, useEffect, useCallback } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import Pagination from '@shared/components/ui/Pagination';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import {
    Bot,
    MessageSquare,
    ShieldAlert,
    TrendingUp,
    RotateCw,
    Search,
    Ban,
    CheckCircle2,
    Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const RISK_VARIANT = { NONE: 'gray', LOW: 'info', MEDIUM: 'warning', HIGH: 'error' };
const INTEREST_VARIANT = { NONE: 'gray', LOW: 'gray', MEDIUM: 'info', HIGH: 'success' };
const ROLE_LABEL = { user: 'Customer', seller: 'Seller', delivery: 'Delivery Boy', admin: 'Admin', 'sub-admin': 'Sub-Admin', anonymous: 'Anonymous' };

const DURATION_OPTIONS = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
];

const ChatbotAnalytics = () => {
    const [tab, setTab] = useState('overview'); // overview | sessions | flagged
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);

    const [sessions, setSessions] = useState([]);
    const [sessionFilters, setSessionFilters] = useState({ role: '', riskLevel: '', interestLevel: '', search: '' });
    const [sessionPage, setSessionPage] = useState(1);
    const [sessionTotal, setSessionTotal] = useState(0);

    const [flagged, setFlagged] = useState([]);
    const [flaggedFilters, setFlaggedFilters] = useState({ reviewStatus: 'open', riskLevel: '' });
    const [flaggedPage, setFlaggedPage] = useState(1);
    const [flaggedTotal, setFlaggedTotal] = useState(0);

    const [detail, setDetail] = useState({ open: false, data: null, loading: false });
    const [accessModal, setAccessModal] = useState({ open: false, role: '', userId: '', name: '', mode: 'temporary', duration: '24h', reason: '' });

    const pageSize = 20;

    const loadOverview = useCallback(async () => {
        try {
            setLoading(true);
            const res = await adminApi.getChatbotOverview();
            if (res.data.success) setOverview(res.data.result);
        } catch (err) {
            toast.error('Failed to load chatbot analytics overview');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSessions = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const params = { page, limit: pageSize };
            if (sessionFilters.role) params.role = sessionFilters.role;
            if (sessionFilters.riskLevel) params.riskLevel = sessionFilters.riskLevel;
            if (sessionFilters.interestLevel) params.interestLevel = sessionFilters.interestLevel;
            if (sessionFilters.search.trim()) params.search = sessionFilters.search.trim();
            const res = await adminApi.getChatbotSessions(params);
            if (res.data.success) {
                const payload = res.data.result || {};
                setSessions(payload.items || []);
                setSessionTotal(payload.total || 0);
                setSessionPage(payload.page || page);
            }
        } catch (err) {
            toast.error('Failed to load chat sessions');
        } finally {
            setLoading(false);
        }
    }, [sessionFilters]);

    const loadFlagged = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const params = { page, limit: pageSize };
            if (flaggedFilters.reviewStatus) params.reviewStatus = flaggedFilters.reviewStatus;
            if (flaggedFilters.riskLevel) params.riskLevel = flaggedFilters.riskLevel;
            const res = await adminApi.getChatbotFlagged(params);
            if (res.data.success) {
                const payload = res.data.result || {};
                setFlagged(payload.items || []);
                setFlaggedTotal(payload.total || 0);
                setFlaggedPage(payload.page || page);
            }
        } catch (err) {
            toast.error('Failed to load flagged conversations');
        } finally {
            setLoading(false);
        }
    }, [flaggedFilters]);

    useEffect(() => {
        if (tab === 'overview') loadOverview();
        if (tab === 'sessions') loadSessions(1);
        if (tab === 'flagged') loadFlagged(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    useEffect(() => {
        if (tab === 'sessions') {
            const timer = setTimeout(() => loadSessions(1), 400);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionFilters]);

    useEffect(() => {
        if (tab === 'flagged') loadFlagged(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flaggedFilters]);

    const openDetail = async (sessionId) => {
        setDetail({ open: true, data: null, loading: true });
        try {
            const res = await adminApi.getChatbotSessionDetail(sessionId);
            if (res.data.success) setDetail({ open: true, data: res.data.result, loading: false });
        } catch (err) {
            toast.error('Failed to load conversation detail');
            setDetail({ open: false, data: null, loading: false });
        }
    };

    const reviewFlag = async (id, reviewStatus) => {
        try {
            const res = await adminApi.reviewChatbotFlagged(id, { reviewStatus });
            if (res.data.success) {
                toast.success('Moderation status updated');
                loadFlagged(flaggedPage);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update moderation status');
        }
    };

    const openAccessModal = (role, userId, name) => {
        setAccessModal({ open: true, role, userId, name, mode: 'temporary', duration: '24h', reason: '' });
    };

    const submitAccessAction = async (enable) => {
        const { role, userId, mode, duration, reason } = accessModal;
        if (!enable && !reason.trim()) {
            toast.error('Please provide a reason');
            return;
        }
        try {
            if (enable) {
                await adminApi.enableChatbotAccess(role, userId, { reason });
                toast.success('Chatbot access re-enabled');
            } else {
                await adminApi.disableChatbotAccess(role, userId, { mode, duration, reason });
                toast.success('Chatbot access disabled');
            }
            setAccessModal({ open: false, role: '', userId: '', name: '', mode: 'temporary', duration: '24h', reason: '' });
            if (tab === 'sessions') loadSessions(sessionPage);
            if (tab === 'flagged') loadFlagged(flaggedPage);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed');
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 pt-6 relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Chatbot Analytics
                        <div className="p-1.5 bg-brand-100 rounded-lg">
                            <Bot className="h-5 w-5 text-brand-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">
                        Understand chatbot usage, product interest, and moderation risk across User, Seller, and Delivery panels.
                    </p>
                </div>
            </div>

            <div className="flex gap-2 border-b border-slate-100 px-1">
                {[
                    { key: 'overview', label: 'Overview' },
                    { key: 'sessions', label: 'Conversations' },
                    { key: 'flagged', label: 'Flagged Queue' },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all',
                            tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600',
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <OverviewTab loading={loading} overview={overview} onOpenFlagged={() => setTab('flagged')} />
            )}

            {tab === 'sessions' && (
                <SessionsTab
                    loading={loading}
                    sessions={sessions}
                    filters={sessionFilters}
                    setFilters={setSessionFilters}
                    page={sessionPage}
                    total={sessionTotal}
                    pageSize={pageSize}
                    onPageChange={loadSessions}
                    onOpenDetail={openDetail}
                    onOpenAccess={openAccessModal}
                />
            )}

            {tab === 'flagged' && (
                <FlaggedTab
                    loading={loading}
                    flagged={flagged}
                    filters={flaggedFilters}
                    setFilters={setFlaggedFilters}
                    page={flaggedPage}
                    total={flaggedTotal}
                    pageSize={pageSize}
                    onPageChange={loadFlagged}
                    onOpenDetail={openDetail}
                    onReview={reviewFlag}
                    onOpenAccess={openAccessModal}
                />
            )}

            {/* Session Detail Modal */}
            <Modal
                isOpen={detail.open}
                onClose={() => setDetail({ open: false, data: null, loading: false })}
                title="Conversation Detail"
                size="lg"
            >
                {detail.loading ? (
                    <div className="py-16 text-center"><RotateCw className="h-8 w-8 animate-spin mx-auto text-brand-500" /></div>
                ) : detail.data ? (
                    <SessionDetailView data={detail.data} />
                ) : null}
            </Modal>

            {/* Access Control Modal */}
            <Modal
                isOpen={accessModal.open}
                onClose={() => setAccessModal((p) => ({ ...p, open: false }))}
                title="Chatbot Access Control"
                size="sm"
            >
                <div className="space-y-4 py-2">
                    <p className="text-sm text-slate-600">
                        Managing chatbot access for <span className="font-black text-slate-900">{accessModal.name || accessModal.userId}</span> ({ROLE_LABEL[accessModal.role] || accessModal.role}).
                        This does <span className="font-bold">not</span> affect their account — only chatbot usage.
                    </p>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Mode</label>
                        <div className="flex gap-2">
                            {['temporary', 'permanent'].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setAccessModal((p) => ({ ...p, mode: m }))}
                                    className={cn(
                                        'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all',
                                        accessModal.mode === m ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-500',
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    {accessModal.mode === 'temporary' && (
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Duration</label>
                            <div className="flex gap-2">
                                {DURATION_OPTIONS.map((d) => (
                                    <button
                                        key={d.value}
                                        type="button"
                                        onClick={() => setAccessModal((p) => ({ ...p, duration: d.value }))}
                                        className={cn(
                                            'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all',
                                            accessModal.duration === d.value ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-500',
                                        )}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Admin Reason</label>
                        <textarea
                            value={accessModal.reason}
                            onChange={(e) => setAccessModal((p) => ({ ...p, reason: e.target.value }))}
                            rows={3}
                            className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20"
                            placeholder="Why is chatbot access being disabled/enabled?"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => submitAccessAction(false)}
                            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Ban className="h-4 w-4" /> Disable Chatbot
                        </button>
                        <button
                            onClick={() => submitAccessAction(true)}
                            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="h-4 w-4" /> Re-enable
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, color = 'brand' }) => (
    <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white">
        <div className="flex items-center justify-between mb-4">
            <div className={cn('p-3 rounded-2xl', `bg-${color}-50`)}>
                <Icon className={cn('h-6 w-6', `text-${color}-600`)} />
            </div>
        </div>
        <p className="ds-label mb-1 uppercase tracking-tight font-black">{label}</p>
        <h3 className="ds-stat-medium ds-stat-large">{value}</h3>
    </Card>
);

const OverviewTab = ({ loading, overview, onOpenFlagged }) => {
    if (loading && !overview) {
        return <div className="py-16 text-center"><RotateCw className="h-8 w-8 animate-spin mx-auto text-brand-500" /></div>;
    }
    if (!overview) return null;

    const { totalConversations, byRole, riskBreakdown, interestBreakdown, topCategories, topProducts, flaggedOpenCount } = overview;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard icon={MessageSquare} label="Total Conversations" value={totalConversations} color="brand" />
                <StatCard icon={TrendingUp} label="High Interest Chats" value={interestBreakdown?.HIGH || 0} color="emerald" />
                <StatCard icon={ShieldAlert} label="High Risk Chats" value={riskBreakdown?.HIGH || 0} color="red" />
                <button onClick={onOpenFlagged} className="text-left">
                    <StatCard icon={Clock} label="Open Flags (click to review)" value={flaggedOpenCount || 0} color="amber" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white">
                    <h3 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-wide">Conversations by Role</h3>
                    <div className="space-y-3">
                        {Object.entries(byRole || {}).map(([role, count]) => (
                            <div key={role} className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-600">{ROLE_LABEL[role] || role}</span>
                                <span className="text-sm font-black text-slate-900">{count}</span>
                            </div>
                        ))}
                        {Object.keys(byRole || {}).length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
                    </div>
                </Card>

                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white">
                    <h3 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-wide">Most Discussed Categories</h3>
                    <div className="space-y-3">
                        {(topCategories || []).map((c) => (
                            <div key={c.category} className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-600">{c.category}</span>
                                <span className="text-sm font-black text-slate-900">{c.count}</span>
                            </div>
                        ))}
                        {(topCategories || []).length === 0 && <p className="text-sm text-slate-400">No product interest detected yet.</p>}
                    </div>
                </Card>

                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white lg:col-span-2">
                    <h3 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-wide">Most Discussed Products</h3>
                    <div className="flex flex-wrap gap-2">
                        {(topProducts || []).map((p) => (
                            <Badge key={p.product} variant="info">{p.product} · {p.count}</Badge>
                        ))}
                        {(topProducts || []).length === 0 && <p className="text-sm text-slate-400">No product interest detected yet.</p>}
                    </div>
                </Card>
            </div>
        </div>
    );
};

const SessionsTab = ({ loading, sessions, filters, setFilters, page, total, pageSize, onPageChange, onOpenDetail, onOpenAccess }) => (
    <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search summary, intent, product..."
                    value={filters.search}
                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                    className="pl-9 pr-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/10 w-64"
                />
            </div>
            <select value={filters.role} onChange={(e) => setFilters((p) => ({ ...p, role: e.target.value }))} className="px-3 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none">
                <option value="">All Roles</option>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filters.riskLevel} onChange={(e) => setFilters((p) => ({ ...p, riskLevel: e.target.value }))} className="px-3 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none">
                <option value="">Any Risk</option>
                {['NONE', 'LOW', 'MEDIUM', 'HIGH'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filters.interestLevel} onChange={(e) => setFilters((p) => ({ ...p, interestLevel: e.target.value }))} className="px-3 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none">
                <option value="">Any Interest</option>
                {['NONE', 'LOW', 'MEDIUM', 'HIGH'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
        </div>

        <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="ds-table-header-cell pl-8 py-5">Identity</th>
                            <th className="ds-table-header-cell">Intent</th>
                            <th className="ds-table-header-cell">Interest</th>
                            <th className="ds-table-header-cell">Risk</th>
                            <th className="ds-table-header-cell">Messages</th>
                            <th className="ds-table-header-cell">Last Active</th>
                            <th className="ds-table-header-cell text-right pr-8">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan="7" className="py-16 text-center"><RotateCw className="h-8 w-8 animate-spin mx-auto text-brand-500" /></td></tr>
                        ) : sessions.length === 0 ? (
                            <tr><td colSpan="7" className="py-16 text-center text-sm text-slate-400">No conversations found.</td></tr>
                        ) : (
                            sessions.map((s) => (
                                <tr key={s.sessionId} className="group hover:bg-slate-50/40 transition-all cursor-pointer" onClick={() => onOpenDetail(s.sessionId)}>
                                    <td className="px-6 py-5 pl-8">
                                        <p className="text-sm font-black text-slate-900">{s.identityName || 'Guest'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{ROLE_LABEL[s.role] || s.role}</p>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-slate-600 max-w-[200px] truncate">{s.intent || '—'}</td>
                                    <td className="px-6 py-5"><Badge variant={INTEREST_VARIANT[s.interest?.level] || 'gray'}>{s.interest?.level || 'NONE'}</Badge></td>
                                    <td className="px-6 py-5"><Badge variant={RISK_VARIANT[s.moderation?.riskLevel] || 'gray'}>{s.moderation?.riskLevel || 'NONE'}</Badge></td>
                                    <td className="px-6 py-5 text-sm font-semibold text-slate-500">{s.messageCount}</td>
                                    <td className="px-6 py-5 text-sm text-slate-500">{s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleString() : '—'}</td>
                                    <td className="px-6 py-5 text-right pr-8">
                                        {s.userRef && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onOpenAccess(s.role, s.userRef, s.identityName); }}
                                                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest"
                                            >
                                                Manage Access
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-100">
                <Pagination
                    page={page}
                    totalPages={Math.ceil(total / pageSize) || 1}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={(p) => onPageChange(p)}
                    loading={loading}
                />
            </div>
        </Card>
    </div>
);

const FlaggedTab = ({ loading, flagged, filters, setFilters, page, total, pageSize, onPageChange, onOpenDetail, onReview, onOpenAccess }) => (
    <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
            <select value={filters.reviewStatus} onChange={(e) => setFilters((p) => ({ ...p, reviewStatus: e.target.value }))} className="px-3 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none">
                {['open', 'reviewed', 'actioned', 'dismissed'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.riskLevel} onChange={(e) => setFilters((p) => ({ ...p, riskLevel: e.target.value }))} className="px-3 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none">
                <option value="">Any Risk</option>
                {['LOW', 'MEDIUM', 'HIGH'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
        </div>

        <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="ds-table-header-cell pl-8 py-5">Identity</th>
                            <th className="ds-table-header-cell">Risk</th>
                            <th className="ds-table-header-cell">Flags</th>
                            <th className="ds-table-header-cell">Reason</th>
                            <th className="ds-table-header-cell">Flagged At</th>
                            <th className="ds-table-header-cell text-right pr-8">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan="6" className="py-16 text-center"><RotateCw className="h-8 w-8 animate-spin mx-auto text-brand-500" /></td></tr>
                        ) : flagged.length === 0 ? (
                            <tr><td colSpan="6" className="py-16 text-center text-sm text-slate-400">No flagged conversations.</td></tr>
                        ) : (
                            flagged.map((f) => (
                                <tr key={f._id} className="group hover:bg-slate-50/40 transition-all">
                                    <td className="px-6 py-5 pl-8 cursor-pointer" onClick={() => onOpenDetail(f.sessionId)}>
                                        <p className="text-sm font-black text-slate-900">{f.identityName || 'Guest'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{ROLE_LABEL[f.role] || f.role}</p>
                                    </td>
                                    <td className="px-6 py-5"><Badge variant={RISK_VARIANT[f.riskLevel] || 'gray'}>{f.riskLevel}</Badge></td>
                                    <td className="px-6 py-5 text-xs text-slate-500 max-w-[180px] truncate">{(f.flags || []).join(', ') || '—'}</td>
                                    <td className="px-6 py-5 text-sm text-slate-600 max-w-[220px] truncate">{f.reason || '—'}</td>
                                    <td className="px-6 py-5 text-sm text-slate-500">{new Date(f.createdAt).toLocaleString()}</td>
                                    <td className="px-6 py-5 text-right pr-8 space-x-2">
                                        {f.reviewStatus === 'open' && (
                                            <>
                                                <button onClick={() => onReview(f._id, 'reviewed')} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest">Mark Reviewed</button>
                                                <button onClick={() => onReview(f._id, 'dismissed')} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest">Dismiss</button>
                                            </>
                                        )}
                                        {f.userRef && (
                                            <button onClick={() => onOpenAccess(f.role, f.userRef, f.identityName)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest">Manage Access</button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-100">
                <Pagination
                    page={page}
                    totalPages={Math.ceil(total / pageSize) || 1}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={(p) => onPageChange(p)}
                    loading={loading}
                />
            </div>
        </Card>
    </div>
);

const SessionDetailView = ({ data }) => (
    <div className="space-y-5 py-2">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-black text-slate-900">{data.identityName || 'Guest'}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{ROLE_LABEL[data.role] || data.role}</p>
            </div>
            <div className="flex gap-2">
                <Badge variant={INTEREST_VARIANT[data.interest?.level] || 'gray'}>Interest: {data.interest?.level || 'NONE'}</Badge>
                <Badge variant={RISK_VARIANT[data.moderation?.riskLevel] || 'gray'}>Risk: {data.moderation?.riskLevel || 'NONE'}</Badge>
            </div>
        </div>

        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Summary</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4">{data.summary || 'Not yet classified — summary appears after a few more messages.'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Intent</p>
                <p className="text-sm text-slate-700">{data.intent || '—'} {data.intentCategory ? `(${data.intentCategory})` : ''}</p>
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Interested Product / Category</p>
                <p className="text-sm text-slate-700">{[data.interest?.product, data.interest?.category].filter(Boolean).join(' / ') || '—'}</p>
                {data.interest?.details && <p className="text-xs text-slate-500 mt-1">{data.interest.details}</p>}
            </div>
        </div>

        {data.moderation?.flags?.length > 0 && (
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Flags</p>
                <div className="flex flex-wrap gap-2">
                    {data.moderation.flags.map((f) => <Badge key={f} variant="error">{f}</Badge>)}
                </div>
                {data.moderation.reason && <p className="text-xs text-slate-500 mt-2">{data.moderation.reason}</p>}
            </div>
        )}

        <div className="grid grid-cols-3 gap-4 text-center pt-2 border-t border-slate-100">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Messages</p>
                <p className="text-lg font-black text-slate-900">{data.messageCount}</p>
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Started</p>
                <p className="text-xs font-semibold text-slate-600">{new Date(data.startedAt).toLocaleString()}</p>
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Active</p>
                <p className="text-xs font-semibold text-slate-600">{new Date(data.lastMessageAt).toLocaleString()}</p>
            </div>
        </div>
    </div>
);

export default ChatbotAnalytics;
