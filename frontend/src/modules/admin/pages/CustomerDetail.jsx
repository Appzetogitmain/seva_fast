import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../services/adminApi';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Mail,
    Phone,
    MapPin,
    ShoppingBag,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    RotateCw,
    Ban,
    Search,
    Package,
    IndianRupee,
    Wallet,
    CheckCircle2,
    Clock,
    Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import { useAuth } from '@core/context/AuthContext';
import { formatDate, formatDateTime } from '@shared/utils/formatDate';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const StatTile = ({ icon: Icon, label, value, hint, action }) => (
    <div className="flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-100">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
            <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-0.5 truncate text-lg font-black text-slate-900">{value}</p>
            {hint && <p className="text-[11px] font-medium text-slate-400">{hint}</p>}
            {action}
        </div>
    </div>
);

const SectionTitle = ({ icon: Icon, children, right }) => (
    <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900">
            <Icon className="h-4 w-4 text-brand-500" />
            {children}
        </h4>
        {right}
    </div>
);

const CustomerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    // Wallet changes and block/unblock are main-admin only (enforced by the server too).
    const isMainAdmin = user?.role !== 'sub-admin';

    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');
    const [showAllOrders, setShowAllOrders] = useState(false);

    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [walletForm, setWalletForm] = useState({ amount: '', action: 'add', reason: '' });
    const [submittingWallet, setSubmittingWallet] = useState(false);

    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [submittingBlock, setSubmittingBlock] = useState(false);

    const fetchCustomer = useCallback(async () => {
        const { data } = await adminApi.getUserById(id);
        if (data.success) setCustomer(data.result);
    }, [id]);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetchCustomer()
            .catch(() => showToast('Failed to load customer profile', 'error'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchCustomer();
            showToast('Customer data refreshed', 'success');
        } catch {
            showToast('Failed to refresh', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleWalletUpdate = async (e) => {
        e.preventDefault();
        try {
            setSubmittingWallet(true);
            const { amount, action, reason } = walletForm;
            const { data } = await adminApi.updateUserWallet(id, { amount, action, reason });
            if (data.success) {
                setCustomer((prev) => ({ ...prev, walletBalance: data.result.walletBalance }));
                showToast(`Successfully ${action === 'add' ? 'added' : 'deducted'} ₹${amount}`, 'success');
                setIsWalletModalOpen(false);
                setWalletForm({ amount: '', action: 'add', reason: '' });
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update wallet', 'error');
        } finally {
            setSubmittingWallet(false);
        }
    };

    const handleToggleBlock = async () => {
        const block = customer.status === 'active';
        try {
            setSubmittingBlock(true);
            await adminApi.setUserStatus(id, !block);
            setCustomer((prev) => ({ ...prev, status: block ? 'inactive' : 'active' }));
            showToast(block ? 'Customer blocked — logged out and cannot log in' : 'Customer unblocked', block ? 'warning' : 'success');
            setIsBlockModalOpen(false);
        } catch (err) {
            showToast(err.response?.data?.message || 'Action failed', 'error');
        } finally {
            setSubmittingBlock(false);
        }
    };

    const copyText = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast(`${label} copied`, 'success');
        } catch {
            showToast(`Could not copy ${label.toLowerCase()}`, 'error');
        }
    };

    const orders = useMemo(() => (Array.isArray(customer?.recentOrders) ? customer.recentOrders : []), [customer]);
    const filteredOrders = useMemo(() => {
        const q = orderSearch.trim().toLowerCase();
        const list = q
            ? orders.filter((o) => (o.id || '').toLowerCase().includes(q) || (o.status || '').toLowerCase().includes(q))
            : orders;
        return showAllOrders ? list : list.slice(0, 5);
    }, [orders, orderSearch, showAllOrders]);

    if (loading) {
        return (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
                <RotateCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading profile…</p>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
                <p className="text-lg font-bold text-slate-400">Customer not found</p>
                <button onClick={() => navigate('/admin/customers')} className="font-bold text-primary">Back to Customers</button>
            </div>
        );
    }

    const isActive = customer.status === 'active';
    const addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
    const avgOrder = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;
    const initials = String(customer.name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

    return (
        <div className="space-y-4 pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <Card className="rounded-xl border-none bg-white p-4 ring-1 ring-slate-100 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/admin/customers')}
                            className="rounded-lg p-2 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                            aria-label="Back to customers"
                        >
                            <ChevronLeft className="h-4 w-4 text-slate-500" />
                        </button>
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-black text-brand-600">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-xl font-black text-slate-900">{customer.name || 'Customer'}</h1>
                                <Badge variant={isActive ? 'success' : 'error'} className="text-[9px] font-black uppercase">
                                    {isActive ? 'Active' : 'Blocked'}
                                </Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                                {customer.phone && (
                                    <button onClick={() => copyText(customer.phone, 'Phone')} className="flex items-center gap-1.5 hover:text-slate-800" title="Copy phone">
                                        <Phone className="h-3.5 w-3.5" /> {customer.phone}
                                    </button>
                                )}
                                {customer.email && (
                                    <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>
                                )}
                                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Since {formatDate(customer.joinedDate)}</span>
                                <button onClick={() => copyText(String(customer.id), 'Customer ID')} className="flex items-center gap-1 font-mono text-[10px] text-slate-400 hover:text-slate-700" title="Copy customer ID">
                                    <Copy className="h-3 w-3" /> {String(customer.id).slice(-8).toUpperCase()}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                        >
                            <RotateCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                            Refresh
                        </button>
                        <button
                            onClick={() => navigate(`/admin/orders/all?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name || '')}`)}
                            className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                        >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            All Orders
                        </button>
                        {isMainAdmin && (
                            <button
                                onClick={() => setIsBlockModalOpen(true)}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors',
                                    isActive ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                                )}
                            >
                                {isActive ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                {isActive ? 'Block' : 'Unblock'}
                            </button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile icon={IndianRupee} label="Total Spend" value={inr(customer.totalSpent)} hint="Lifetime" />
                <StatTile icon={ShoppingBag} label="Orders" value={customer.totalOrders || 0} hint={customer.lastOrderDate ? `Last: ${formatDateTime(customer.lastOrderDate)}` : 'No orders yet'} />
                <StatTile icon={TrendingUp} label="Average Order" value={inr(Math.round(avgOrder))} hint="Per order" />
                <StatTile
                    icon={Wallet}
                    label="Wallet Balance"
                    value={inr(customer.walletBalance)}
                    action={isMainAdmin && (
                        <button onClick={() => setIsWalletModalOpen(true)} className="mt-1 text-[11px] font-bold text-brand-600 hover:underline">
                            Manage funds →
                        </button>
                    )}
                />
            </div>

            {/* Orders + addresses */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="overflow-hidden rounded-xl border-none bg-white ring-1 ring-slate-100 lg:col-span-2">
                    <div className="p-4 pb-0">
                        <SectionTitle
                            icon={Package}
                            right={(
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search order ID or status"
                                        value={orderSearch}
                                        onChange={(e) => setOrderSearch(e.target.value)}
                                        className="w-48 rounded-lg bg-slate-50 py-1.5 pl-8 pr-3 text-xs font-semibold outline-none ring-1 ring-slate-100 focus:ring-brand-500/30"
                                    />
                                </div>
                            )}
                        >
                            Recent Orders
                        </SectionTitle>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-y border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <th className="px-4 py-2">Order</th>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Status</th>
                                    <th className="px-4 py-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredOrders.map((order, i) => (
                                    <tr
                                        key={order.id || i}
                                        onClick={() => navigate(`/admin/orders/view/${String(order.id || '').replace('#', '')}`)}
                                        className="cursor-pointer transition-colors hover:bg-slate-50/70"
                                    >
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-bold text-slate-900">{order.id}</p>
                                            <p className="text-[11px] font-medium text-slate-400">{order.itemsCount} item(s)</p>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatDateTime(order.date)}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant={order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : 'warning'} className="text-[9px] font-black uppercase">
                                                {String(order.status || '').replace(/_/g, ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{inr(order.amount)}</td>
                                    </tr>
                                ))}
                                {filteredOrders.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                                            {orders.length === 0 ? 'No orders yet.' : 'No orders match your search.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!showAllOrders && orders.length > 5 && !orderSearch && (
                        <div className="flex justify-center border-t border-slate-100 p-3">
                            <button onClick={() => setShowAllOrders(true)} className="flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:underline">
                                Show all {orders.length} recent orders <ChevronRight className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </Card>

                <Card className="rounded-xl border-none bg-white p-4 ring-1 ring-slate-100">
                    <SectionTitle icon={MapPin}>Saved Addresses</SectionTitle>
                    {addresses.length > 0 ? (
                        <div className="space-y-2.5">
                            {addresses.map((addr, idx) => {
                                const type = (addr.label || addr.type || 'other').toUpperCase();
                                const parts = [addr.fullAddress || addr.address, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean);
                                const isDefault = addr.isDefault ?? idx === 0;
                                return (
                                    <div key={addr._id || addr.id || idx} className={cn('rounded-lg p-3 ring-1', isDefault ? 'bg-slate-50 ring-slate-200' : 'bg-white ring-slate-100')}>
                                        <div className="mb-1 flex items-center gap-2">
                                            <Badge variant={isDefault ? 'primary' : 'secondary'} className="text-[9px] font-black">{type}</Badge>
                                            {isDefault && <span className="text-[10px] font-bold text-slate-400">Default</span>}
                                        </div>
                                        <p className="break-words text-xs font-medium leading-relaxed text-slate-600">
                                            {parts.length ? parts.join(', ') : 'No address'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                            <MapPin className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                            <p className="text-[11px] font-bold text-slate-400">No saved addresses</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* Block / unblock */}
            <Modal isOpen={isBlockModalOpen} onClose={() => !submittingBlock && setIsBlockModalOpen(false)} title={isActive ? 'Block this customer?' : 'Unblock this customer?'}>
                <div className="space-y-5">
                    <p className="text-sm text-slate-600">
                        {isActive
                            ? 'They will be logged out within a minute and cannot log in or place orders until you unblock them. Their data is kept.'
                            : 'They will be able to log in and place orders again.'}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setIsBlockModalOpen(false)} disabled={submittingBlock} className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200">
                            Cancel
                        </button>
                        <button
                            onClick={handleToggleBlock}
                            disabled={submittingBlock}
                            className={cn('flex-1 rounded-xl py-3 text-xs font-bold text-white disabled:opacity-60', isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700')}
                        >
                            {submittingBlock ? 'Please wait…' : isActive ? 'Block' : 'Unblock'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Wallet */}
            <Modal isOpen={isWalletModalOpen} onClose={() => !submittingWallet && setIsWalletModalOpen(false)} title="Manage Customer Wallet">
                <form onSubmit={handleWalletUpdate} className="space-y-5">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Balance</p>
                        <p className="text-xl font-black text-slate-900">{inr(customer.walletBalance)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {['add', 'deduct'].map((action) => (
                            <button
                                key={action}
                                type="button"
                                onClick={() => setWalletForm({ ...walletForm, action })}
                                className={cn(
                                    'rounded-xl py-2.5 text-xs font-bold transition-colors',
                                    walletForm.action === action
                                        ? action === 'add' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                )}
                            >
                                {action === 'add' ? 'Add Funds' : 'Deduct Funds'}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount (₹)</label>
                        <input
                            type="number"
                            required
                            min="1"
                            value={walletForm.amount}
                            onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
                            onChange={(e) => setWalletForm({ ...walletForm, amount: e.target.value.replace('-', '') })}
                            placeholder="Enter amount"
                            className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold outline-none ring-1 ring-slate-100 focus:ring-brand-500/30"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Reason (optional)</label>
                        <textarea
                            value={walletForm.reason}
                            onChange={(e) => setWalletForm({ ...walletForm, reason: e.target.value })}
                            placeholder="E.g. Refund for damaged item"
                            className="min-h-[72px] w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium outline-none ring-1 ring-slate-100 focus:ring-brand-500/30"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!walletForm.amount || submittingWallet}
                        className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                    >
                        {submittingWallet ? 'Processing…' : 'Confirm'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default CustomerDetail;
