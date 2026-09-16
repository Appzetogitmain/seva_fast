import React, { useState, useEffect } from 'react';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import Card from '@shared/components/ui/Card';
import Modal from '@shared/components/ui/Modal';
import {
    Banknote,
    Search,
    CheckCircle2,
    RotateCw,
    Wallet,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const RiderPayouts = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [riders, setRiders] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({ totalPayable: 0, riderCount: 0 });
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const [payModal, setPayModal] = useState({ open: false, rider: null, amount: '', method: 'Cash', note: '' });

    const fetchData = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const res = await adminApi.getRiderPayableBalances(params);
            if (res.data.success) {
                const payload = res.data.result || {};
                setRiders(Array.isArray(payload.items) ? payload.items : []);
                setTotal(typeof payload.total === 'number' ? payload.total : 0);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
                setStats({
                    totalPayable: payload.stats?.totalPayable || 0,
                    riderCount: payload.stats?.riderCount || 0,
                });
            }
        } catch (error) {
            console.error('Failed to fetch rider payable balances:', error);
            toast.error('Failed to load rider payouts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm]);

    const openPayModal = (rider) => {
        setPayModal({ open: true, rider, amount: String(rider.availableBalance), method: 'Cash', note: '' });
    };

    const confirmPay = async () => {
        const amount = Number(payModal.amount);
        if (!amount || amount <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        if (amount > payModal.rider.availableBalance) {
            toast.error(`You can pay up to ₹${payModal.rider.availableBalance.toLocaleString()}`);
            return;
        }

        try {
            setIsProcessing(true);
            const res = await adminApi.payRiderEod({
                riderId: payModal.rider.id,
                amount,
                method: payModal.method,
                note: payModal.note,
            });
            if (res.data.success) {
                toast.success(`Paid ₹${amount.toLocaleString()} to ${payModal.rider.name}`);
                setPayModal({ open: false, rider: null, amount: '', method: 'Cash', note: '' });
                fetchData(page);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Payment failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 pt-6 relative z-10">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Rider Payouts
                        <div className="p-1.5 bg-brand-100 rounded-lg">
                            <Banknote className="h-5 w-5 text-brand-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">
                        Pay riders their delivery earnings at end of day — separate from the COD cash they hand over.
                    </p>
                </div>
            </div>

            {/* Insight Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-2xl bg-brand-50">
                            <Wallet className="h-6 w-6 text-brand-600" />
                        </div>
                    </div>
                    <p className="ds-label mb-1 uppercase tracking-tight font-black">Total Payable</p>
                    <h3 className="ds-stat-medium ds-stat-large">₹{stats.totalPayable.toLocaleString()}</h3>
                </Card>
                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-2xl bg-amber-50">
                            <Users className="h-6 w-6 text-amber-600" />
                        </div>
                    </div>
                    <p className="ds-label mb-1 uppercase tracking-tight font-black">Riders With Balance</p>
                    <h3 className="ds-stat-medium ds-stat-large">{stats.riderCount}</h3>
                </Card>
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 mt-2">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Find Rider or Phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/10 w-72 transition-all"
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl mt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="ds-table-header-cell pl-8 py-5">Delivery Partner</th>
                                <th className="ds-table-header-cell">Payable Earnings</th>
                                <th className="ds-table-header-cell">Pending Withdrawal Requests</th>
                                <th className="ds-table-header-cell text-right pr-8">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="py-16 text-center">
                                        <RotateCw className="h-8 w-8 animate-spin mx-auto text-brand-500" />
                                    </td>
                                </tr>
                            ) : riders.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-16 text-center text-sm text-slate-400">
                                        No riders have a payable balance right now.
                                    </td>
                                </tr>
                            ) : (
                                riders.map((rider) => (
                                    <tr key={rider.id} className="group hover:bg-slate-50/40 transition-all">
                                        <td className="px-6 py-6 pl-8">
                                            <div>
                                                <p className="text-sm font-black text-slate-900">{rider.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                                    {rider.phone}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className="text-lg font-black text-emerald-700">
                                                ₹{rider.availableBalance.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-sm font-semibold text-slate-500">
                                            {rider.pendingWithdrawals > 0 ? `₹${rider.pendingWithdrawals.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-6 py-6 text-right pr-8">
                                            <button
                                                onClick={() => openPayModal(rider)}
                                                className="px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-[10px] font-black hover:bg-black hover:text-white transition-all shadow-sm active:scale-95 uppercase tracking-widest"
                                            >
                                                Pay Now
                                            </button>
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
                        onPageChange={(p) => fetchData(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            </Card>

            {/* Pay Modal */}
            <Modal
                isOpen={payModal.open}
                onClose={() => !isProcessing && setPayModal({ open: false, rider: null, amount: '', method: 'Cash', note: '' })}
                title="Pay Rider Earnings"
                size="sm"
            >
                {payModal.rider && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ds-section-spacing py-4">
                        <div className="text-center space-y-4">
                            <div className="h-20 w-20 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mx-auto shadow-inner border border-brand-100">
                                <Banknote className="h-10 w-10" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{payModal.rider.name}</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1">
                                    Payable balance: <span className="font-black text-emerald-700">₹{payModal.rider.availableBalance.toLocaleString()}</span>
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-xl ring-1 ring-slate-100 mt-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Amount to Pay</label>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-xl font-black italic text-slate-900">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={payModal.amount}
                                        onChange={(e) => setPayModal((prev) => ({ ...prev, amount: e.target.value }))}
                                        disabled={isProcessing}
                                        className="bg-transparent text-2xl font-black italic text-slate-900 w-40 outline-none text-center"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Method</label>
                                <div className="flex gap-2 justify-center">
                                    {['Cash', 'Bank Transfer', 'UPI'].map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setPayModal((prev) => ({ ...prev, method: m }))}
                                            className={cn(
                                                'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all',
                                                payModal.method === m ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-500',
                                            )}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 mt-8">
                            <button
                                onClick={confirmPay}
                                disabled={isProcessing}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                            >
                                {isProcessing ? <RotateCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                {isProcessing ? 'PAYING...' : 'CONFIRM PAYMENT'}
                            </button>
                            <button
                                onClick={() => setPayModal({ open: false, rider: null, amount: '', method: 'Cash', note: '' })}
                                disabled={isProcessing}
                                className="w-full py-4 bg-white ring-1 ring-slate-200 text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98]"
                            >
                                CANCEL
                            </button>
                        </div>
                    </motion.div>
                )}
            </Modal>
        </div>
    );
};

export default RiderPayouts;
