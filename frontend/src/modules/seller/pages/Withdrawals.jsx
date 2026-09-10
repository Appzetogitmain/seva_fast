import React, { useState, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import {
    Wallet,
    ArrowUpRight,
    Clock,
    CheckCircle2,
    XCircle,
    History,
    Download,
    Building2,
    Info,
    ArrowRight,
    Search,
    AlertCircle,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlurFade } from "@/components/ui/blur-fade";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { useSellerEarnings } from "../context/SellerEarningsContext";
import Pagination from "@shared/components/ui/Pagination";
import { formatDate, formatTime } from "@shared/utils/formatDate";
import { Link } from 'react-router-dom';

const Withdrawals = () => {
    const { earningsData: data, earningsLoading: loading, refreshEarnings } = useSellerEarnings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [showFlowGuide, setShowFlowGuide] = useState(false);

    const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
    const withdrawalHistory = ledger.filter((t) => (t.type || '').toString() === 'Withdrawal');

    const available = Number(data?.balances?.availableBalance ?? 0);
    const pendingPayouts = Math.abs(Number(data?.balances?.pendingPayouts ?? 0));
    const withdrawable = Number(
        data?.balances?.withdrawableBalance ?? Math.max(0, available - pendingPayouts)
    );
    const onHold = Number(data?.balances?.onHoldBalance ?? 0);
    const totalWallet = Number(
        data?.balances?.totalWalletBalance ?? (available + onHold)
    );
    const bankDetails = data?.balances?.bankDetails || null;
    const hasBank = Boolean(bankDetails?.accountNumber && bankDetails?.ifscCode);

    const balances = {
        available,
        withdrawable,
        totalWallet,
        onHold,
        pending: pendingPayouts,
        lastWithdrawal: Math.abs(withdrawalHistory[0]?.amount ?? 0),
        bankDetails,
    };

    const filteredHistory = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const result = withdrawalHistory.filter((item) => {
            const id = (item.id ?? item.ref ?? '').toString().toLowerCase();
            const status = (item.status ?? '').toString().toLowerCase();
            const method = (item.method ?? item.customer ?? '').toString().toLowerCase();
            const amt = Math.abs(Number(item.amount ?? 0)).toString();
            return (
                !term ||
                id.includes(term) ||
                status.includes(term) ||
                method.includes(term) ||
                amt.includes(term)
            );
        });
        const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
        if (page > totalPages) {
            setPage(1);
        }
        return result;
    }, [withdrawalHistory, searchTerm, page, pageSize]);

    const paginatedHistory = useMemo(() => {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return filteredHistory.slice(start, end);
    }, [filteredHistory, page, pageSize]);

    const handleDownloadReceipt = (item) => {
        const id = item.id || item.ref || item.reference || 'withdrawal';
        const lines = [];
        lines.push('Withdrawal Receipt');
        lines.push(`ID,${id}`);
        lines.push(`Status,${item.status ?? ''}`);
        lines.push(`Date,${formatDate(item.createdAt || item.date, '')}`);
        lines.push(`Time,${formatTime(item.createdAt, '') || item.time || ''}`);
        lines.push(`Amount,₹${Math.abs(item.amount ?? 0).toLocaleString()}`);
        lines.push(`Destination,${item.customer ?? bankDetails?.bankName ?? 'Bank Transfer'}`);
        if (bankDetails?.accountNumber) {
            lines.push(`Account,**** ${String(bankDetails.accountNumber).slice(-4)}`);
        }
        if (item.notes || item.reason) {
            lines.push(`Notes,${item.notes || item.reason}`);
        }
        const csvContent = lines.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `withdrawal-receipt-${id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Receipt downloaded');
    };

    const handleQuickAmount = (percentage) => {
        if (withdrawable <= 0) return;
        const val = Math.floor((withdrawable * percentage) / 100);
        setAmount(String(val));
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();

        if (!hasBank) {
            toast.error('Please update your bank account details in your profile first.');
            return;
        }

        const reqAmount = parseFloat(amount);
        if (!reqAmount || reqAmount <= 0) {
            toast.error('Please enter a valid withdrawal amount.');
            return;
        }

        if (reqAmount > withdrawable) {
            toast.error(`Amount exceeds your withdrawable balance of ₹${withdrawable.toLocaleString()}.`);
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await sellerApi.requestWithdrawal({ amount: reqAmount });
            if (response.data.success) {
                toast.success('Withdrawal request submitted successfully!');
                setIsModalOpen(false);
                setAmount('');
                refreshEarnings();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit request');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-3 font-black text-slate-600">
                <div className="h-8 w-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
                <p className="text-xs uppercase tracking-widest text-slate-500">Loading Withdrawals...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <BlurFade delay={0.1}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            Money Requests & Payouts
                            <div className="p-1.5 bg-brand-100 rounded-lg">
                                <Wallet className="h-5 w-5 text-brand-600" />
                            </div>
                        </h1>
                        <p className="text-slate-600 text-sm mt-1 font-medium">
                            Request payouts to your registered bank account and track withdrawal status.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowFlowGuide(!showFlowGuide)}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                            <HelpCircle className="h-4 w-4 text-slate-500" />
                            <span>Commission & Flow</span>
                            {showFlowGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center gap-2 group"
                        >
                            <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            New Request
                        </button>
                    </div>
                </div>
            </BlurFade>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    {
                        label: 'Available Balance',
                        value: `₹${balances.available.toLocaleString()}`,
                        icon: Wallet,
                        color: 'emerald',
                        sub: balances.pending > 0
                            ? `₹${balances.withdrawable.toLocaleString()} withdrawable now`
                            : 'Ready to withdraw',
                    },
                    {
                        label: 'Total Wallet',
                        value: `₹${balances.totalWallet.toLocaleString()}`,
                        icon: Building2,
                        color: 'indigo',
                        sub: 'Available + on hold',
                    },
                    {
                        label: 'On Hold',
                        value: `₹${balances.onHold.toLocaleString()}`,
                        icon: Clock,
                        color: 'blue',
                        sub: '24h return window hold',
                    },
                    {
                        label: 'Withdrawal Pending',
                        value: `₹${balances.pending.toLocaleString()}`,
                        icon: History,
                        color: 'amber',
                        sub: 'Awaiting admin transfer',
                    },
                ].map((stat, i) => (
                    <BlurFade key={i} delay={0.15 + i * 0.08}>
                        <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 hover:ring-brand-200 transition-all bg-white group relative overflow-hidden">
                            <div className="relative z-10">
                                <div className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                                    stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                                    stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 
                                    'bg-amber-50 text-amber-600'
                                )}>
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</h3>
                                <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-1.5">
                                    <span className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        stat.color === 'emerald' ? 'bg-emerald-500' :
                                        stat.color === 'blue' ? 'bg-blue-500' :
                                        stat.color === 'indigo' ? 'bg-indigo-500' : 
                                        'bg-amber-500'
                                    )} />
                                    {stat.sub}
                                </p>
                            </div>
                            <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                <stat.icon className="h-24 w-24" />
                            </div>
                        </Card>
                    </BlurFade>
                ))}
            </div>

            {/* Informative Alert: Return Window on-hold explanation */}
            {balances.onHold > 0 && (
                <BlurFade delay={0.35}>
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex items-start gap-3.5 shadow-sm">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-blue-950 text-sm">
                                    Funds On Hold: ₹{balances.onHold.toLocaleString()}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 uppercase tracking-wider">
                                    24h Return Window
                                </span>
                            </div>
                            <p className="text-slate-600 mt-1 font-medium leading-relaxed">
                                When orders are delivered, earnings are held safely during the customer's 24-hour return window. Once the return window expires without a return, these funds automatically move to your <strong>Available Balance</strong> and become eligible for withdrawal.
                            </p>
                        </div>
                    </div>
                </BlurFade>
            )}

            {/* Missing Bank Details Warning */}
            {!hasBank && (
                <BlurFade delay={0.4}>
                    <div className="p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-start gap-3.5">
                            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">
                                    Bank Account Required for Payouts
                                </h4>
                                <p className="text-xs text-amber-700 mt-0.5 font-medium">
                                    Please configure your bank details in your Profile to enable withdrawal requests.
                                </p>
                            </div>
                        </div>
                        <Link
                            to="/seller/profile"
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shrink-0 transition-colors shadow-sm"
                        >
                            Add Bank Details
                        </Link>
                    </div>
                </BlurFade>
            )}

            {/* Expandable Commission & Flow Guide */}
            {showFlowGuide && (
                <BlurFade delay={0.2}>
                    <Card className="p-6 border-none ring-1 ring-slate-200 bg-white rounded-3xl shadow-md">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-brand-600" />
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                    How Commission, Earnings & Withdrawals Work
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowFlowGuide(false)}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600"
                            >
                                Close
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="h-8 w-8 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center font-black text-xs">
                                    1
                                </div>
                                <h4 className="text-xs font-black text-slate-900 uppercase">Order Placed</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Customer pays the product price. Admin platform commission is calculated based on category rates.
                                </p>
                            </div>
                            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs">
                                    2
                                </div>
                                <h4 className="text-xs font-black text-slate-900 uppercase">Delivered & Held</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Subtotal minus commission equals your seller earning. It is placed <strong>On Hold</strong> during the 24-hour return window.
                                </p>
                            </div>
                            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="h-8 w-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black text-xs">
                                    3
                                </div>
                                <h4 className="text-xs font-black text-slate-900 uppercase">Auto-Release</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Once the 24-hour return window completes without return, earnings automatically move to your <strong>Available Balance</strong>.
                                </p>
                            </div>
                            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="h-8 w-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs">
                                    4
                                </div>
                                <h4 className="text-xs font-black text-slate-900 uppercase">Payout Request</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Submit a withdrawal request up to your available balance. Admin processes the bank transfer directly to your account.
                                </p>
                            </div>
                        </div>
                    </Card>
                </BlurFade>
            )}

            {/* History Table */}
            <BlurFade delay={0.45}>
                <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-3xl">
                    <div className="p-4 sm:p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                            <History className="h-5 w-5 text-brand-500" />
                            Withdrawal History
                        </h2>
                        <div className="relative w-full md:w-64 group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600 group-focus-within:text-brand-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search ID or Status..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[640px]">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-8 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Request Details</th>
                                    <th className="px-8 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Amount</th>
                                    <th className="px-8 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-8 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-right">Destination</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-12 text-center text-slate-600 text-sm font-medium">
                                            {withdrawalHistory.length === 0 ? "No withdrawal requests yet." : "No matches for your search."}
                                        </td>
                                    </tr>
                                ) : paginatedHistory.map((item, idx) => (
                                    <tr key={item.id || item.ref || item.reference || `wd-${idx}`} className="group hover:bg-slate-50/50 transition-all">
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-900">{item.id}</p>
                                            <p className="text-xs font-bold text-slate-500 mt-0.5 tracking-tighter">
                                                {formatDate(item.createdAt || item.date)} • {formatTime(item.createdAt, '') || item.time || ''}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-900">₹{Math.abs(item.amount).toLocaleString()}</p>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <Badge
                                                variant={item.status === 'Settled' ? 'success' : (item.status === 'Pending' || item.status === 'Processing') ? 'warning' : 'danger'}
                                                className="text-[8px] font-black px-2.5 py-0.5 uppercase tracking-widest rounded-lg inline-flex items-center"
                                            >
                                                {item.status === 'Settled' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : (item.status === 'Pending' || item.status === 'Processing') ? <Clock className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                                {item.status}
                                            </Badge>
                                            {(item.notes || item.reason) && (
                                                <p className="text-[9px] text-slate-500 font-medium mt-1 max-w-[200px] mx-auto truncate" title={item.notes || item.reason}>
                                                    {item.notes || item.reason}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <p className="text-xs font-bold text-slate-700">{item.customer || bankDetails?.bankName || 'Bank Transfer'}</p>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadReceipt(item)}
                                                className="text-[10px] font-black text-brand-600 hover:text-brand-700 mt-1 uppercase tracking-widest flex items-center gap-1 justify-end ml-auto"
                                            >
                                                Receipt <Download className="h-3 w-3" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredHistory.length > 0 && (
                        <div className="p-4 sm:p-5 border-t border-slate-50 bg-slate-50/40">
                            <Pagination
                                page={page}
                                totalPages={Math.max(1, Math.ceil(filteredHistory.length / pageSize))}
                                total={filteredHistory.length}
                                pageSize={pageSize}
                                onPageChange={(newPage) => setPage(newPage)}
                                onPageSizeChange={(newSize) => {
                                    setPageSize(newSize);
                                    setPage(1);
                                }}
                                loading={loading}
                            />
                        </div>
                    )}
                </Card>
            </BlurFade>

            {/* Request Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => !isSubmitting && setIsModalOpen(false)}
                title="Request Withdrawal"
            >
                <form onSubmit={handleSubmitRequest} className="space-y-5 py-2">
                    {/* Withdrawable Balance display */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Withdrawable Balance</p>
                            <h4 className="text-2xl font-black text-brand-600">₹{balances.withdrawable.toLocaleString()}</h4>
                            {balances.pending > 0 && (
                                <p className="text-[10px] text-amber-600 font-bold mt-1">
                                    ₹{balances.pending.toLocaleString()} is currently pending approval
                                </p>
                            )}
                        </div>
                        <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <Coins className="h-6 w-6 text-brand-500" />
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-600 uppercase tracking-widest block ml-1">
                            Enter Withdrawal Amount
                        </label>
                        <div className="relative group">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400 group-focus-within:text-brand-500 transition-colors">
                                ₹
                            </span>
                            <input
                                type="number"
                                min="1"
                                max={balances.withdrawable}
                                step="any"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                disabled={balances.withdrawable <= 0}
                                className="w-full pl-12 pr-6 py-4 bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 rounded-2xl text-xl font-black outline-none transition-all placeholder:text-slate-300 disabled:bg-slate-100"
                            />
                        </div>

                        {/* Quick Amount Buttons */}
                        {balances.withdrawable > 0 && (
                            <div className="flex gap-2 pt-1">
                                {[25, 50, 75, 100].map((pct) => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => handleQuickAmount(pct)}
                                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-lg transition-colors"
                                    >
                                        {pct === 100 ? 'Max' : `${pct}%`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Transfer Destination */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            Transfer Destination (Bank Account)
                        </p>
                        {hasBank ? (
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-brand-600">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-900 uppercase truncate">
                                        {bankDetails.bankName || 'Registered Bank'}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                        Acct ending in **** {String(bankDetails.accountNumber).slice(-4)} • IFSC: {bankDetails.ifscCode}
                                    </p>
                                    {bankDetails.accountHolderName && (
                                        <p className="text-[10px] text-slate-400 font-medium truncate">
                                            Holder: {bankDetails.accountHolderName}
                                        </p>
                                    )}
                                </div>
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-amber-700 text-xs font-bold">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>No bank account registered</span>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Please link your bank account in your profile before requesting a payout.
                                </p>
                                <Link
                                    to="/seller/profile"
                                    className="inline-block text-xs font-black text-brand-600 hover:text-brand-700 uppercase tracking-wide"
                                >
                                    Configure Bank Details &rarr;
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Submit Actions */}
                    <div className="flex flex-col gap-2.5 pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting || !hasBank || balances.withdrawable <= 0 || !amount || parseFloat(amount) <= 0}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            {isSubmitting ? (
                                <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                'SUBMIT WITHDRAWAL REQUEST'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Withdrawals;
