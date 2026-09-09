import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Users,
    UserCheck,
    Activity,
    Trophy,
    Search,
    Filter,
    Pencil,
    Phone,
    MapPin,
    Truck,
    User,
    Star,
    DollarSign,
    ShieldCheck,
    XCircle,
    Trash2,
    Eye,
    X,
    Mail,
    FileText,
    IdCard,
    FileSearch,
    Building,
    CreditCard,
    Hash,
    Check,
    Wallet as WalletIcon,
    TrendingUp,
    Banknote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { formatDate } from '@shared/utils/formatDate';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';

// Helper to render field value with nice fallback if empty/missing
const renderVal = (val, { isMono = false, isUppercase = false } = {}) => {
    const text = String(val || '').trim();
    if (!text || text === 'N/A' || text === 'Not Specified' || text === 'Unknown') {
        return <span className="text-[11px] font-semibold text-rose-500 italic">Not Provided</span>;
    }
    return (
        <span className={cn(
            "text-xs font-bold text-slate-900 leading-relaxed block",
            isMono && "font-mono tracking-wider",
            isUppercase && "uppercase"
        )}>
            {text}
        </span>
    );
};

const ActiveDeliveryBoys = () => {
    const location = useLocation();
    const isSellerView = location.pathname.startsWith('/seller/');
    const [riders, setRiders] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedRider, setSelectedRider] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
    const [viewingRider, setViewingRider] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Lock background scroll while viewing rider or editing modal
    useLockBodyScroll(Boolean(viewingRider || isEditModalOpen || isOnboardModalOpen));

    // Form states
    const [formState, setFormState] = useState({
        name: '', phone: '', email: '', vehicle: '', vehicleNum: '', location: ''
    });

    // Fetch Riders
    const fetchRiders = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const params = { page: requestedPage, limit: pageSize, verified: 'true' };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await adminApi.getDeliveryPartners(params);
            const payload = response.data.result || {};
            const data = Array.isArray(payload.items) ? payload.items : (response.data.results || response.data.result || []);

            const mappedRiders = data.map(r => {
                const loc = String(r.preferredArea || r.currentArea || r.address || '').trim() || 'Not Specified';
                return {
                    id: r._id,
                    name: r.name,
                    phone: r.phone,
                    email: r.email,
                    address: r.address,
                    dob: r.dob,
                    bloodGroup: r.bloodGroup,
                    avatar: r.profileImage,
                    status: r.isOnline ? 'available' : 'offline',
                    vehicle: r.vehicleType ? r.vehicleType.charAt(0).toUpperCase() + r.vehicleType.slice(1) : 'Bike',
                    vehicleNumber: r.vehicleNumber,
                    vehicleNum: r.vehicleNumber || 'N/A',
                    drivingLicenseNumber: r.drivingLicenseNumber,
                    aadharNumber: r.aadharNumber,
                    panNumber: r.panNumber,
                    accountHolder: r.accountHolder,
                    accountNumber: r.accountNumber,
                    ifsc: r.ifsc,
                    documents: Object.keys(r.documents || {}).filter(key => r.documents[key]),
                    documentUrls: r.documents || {},
                    rating: typeof r.rating === 'number' ? Number(r.rating.toFixed(1)) : 5.0,
                    totalOrders: r.totalDeliveries || r.totalOrders || 0,
                    todayEarnings: typeof r.todayEarnings === 'number' ? r.todayEarnings : 0,
                    totalEarnings: typeof r.totalEarnings === 'number' ? r.totalEarnings : 0,
                    walletBalance: typeof r.walletBalance === 'number' ? r.walletBalance : 0,
                    cashInHand: typeof r.cashInHand === 'number' ? r.cashInHand : 0,
                    location: loc,
                    preferredArea: loc,
                    lastSync: 'Now',
                    joinDate: formatDate(r.createdAt),
                    appliedDate: formatDate(r.createdAt)
                };
            });

            setRiders(mappedRiders);
            setTotal(typeof payload.total === 'number' ? payload.total : mappedRiders.length);
            setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
        } catch (error) {
            console.error('Fetch Riders Error:', error);
            toast.error('Failed to fetch delivery partners');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRiders(1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm, statusFilter]);

    // Filtering logic
    const filteredRiders = useMemo(() => {
        return riders.filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.phone.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [riders, searchTerm, statusFilter]);

    const handleAction = (type, rider) => {
        if (type === 'view') {
            setViewingRider(rider);
        } else if (type === 'edit') {
            setFormState(rider);
            setSelectedRider(rider);
            setIsEditModalOpen(true);
        } else if (type === 'delete') {
            if (window.confirm(`Are you sure you want to deactivate ${rider.name}?`)) {
                setRiders(riders.filter(r => r.id !== rider.id));
            }
        }
    };

    const handleOnboardSubmit = (e) => {
        e.preventDefault();
        if (!formState.name?.trim()) return toast.error("Name is required");
        if (!/^\d{10}$/.test(formState.phone?.replace(/\D/g, ''))) return toast.error("Valid 10-digit phone required");
        if (formState.vehicle !== 'Cycle' && !formState.vehicleNum?.trim()) return toast.error("Vehicle number is required");
        if (!formState.location?.trim()) return toast.error("Operational area is required");

        const newRider = {
            ...formState,
            id: 'r' + (riders.length + 1),
            status: 'offline',
            rating: 5.0,
            totalOrders: 0,
            todayEarnings: 0,
            totalEarnings: 0,
            walletBalance: 0,
            cashInHand: 0,
            lastSync: 'Just now',
            joinDate: formatDate(new Date())
        };
        setRiders([newRider, ...riders]);
        toast.success("Rider onboarded successfully");
        setIsOnboardModalOpen(false);
        setFormState({ name: '', phone: '', email: '', vehicle: '', vehicleNum: '', location: '' });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRider?.id) return;

        if (!formState.name?.trim()) return toast.error("Name is required");
        if (!/^\d{10}$/.test(formState.phone?.replace(/\D/g, ''))) return toast.error("Valid 10-digit phone required");
        if (formState.vehicle !== 'Cycle' && !formState.vehicleNum?.trim()) return toast.error("Vehicle number is required");
        if (!formState.location?.trim()) return toast.error("Operational area is required");

        try {
            setIsSaving(true);
            const payload = {
                name: formState.name,
                phone: formState.phone,
                email: formState.email,
                vehicleType: formState.vehicle,
                vehicleNumber: formState.vehicleNum,
                currentArea: formState.location,
            };
            const res = await adminApi.updateDeliveryPartner(selectedRider.id, payload);
            if (res.data?.success) {
                toast.success(res.data.message || 'Driver updated successfully');
                setRiders((prev) =>
                    prev.map((r) =>
                        r.id === selectedRider.id
                            ? {
                                ...r,
                                name: formState.name,
                                phone: formState.phone,
                                email: formState.email,
                                vehicle: formState.vehicle,
                                vehicleNum: formState.vehicleNum,
                                location: formState.location,
                            }
                            : r,
                    ),
                );
                setIsEditModalOpen(false);
                setSelectedRider(null);
                fetchRiders(page);
            } else {
                toast.error(res.data?.message || 'Failed to update driver');
            }
        } catch (error) {
            console.error('Update rider error:', error);
            toast.error(error.response?.data?.message || 'Failed to update driver');
        } finally {
            setIsSaving(false);
        }
    };

    const stats = [
        { label: 'Total Fleet', value: total || riders.length, color: 'indigo', icon: Users, description: 'Total active partners' },
        { label: 'Available (Online)', value: riders.filter(r => r.status === 'available').length, color: 'emerald', icon: UserCheck, description: 'Ready for orders' },
        { label: 'Busy (On Task)', value: riders.filter(r => r.status === 'busy').length, color: 'amber', icon: Activity, description: 'Currently delivering' },
        { label: 'Top Rated', value: riders.filter(r => r.rating >= 4.5).length, color: 'rose', icon: Trophy, description: 'Rating 4.5+' },
    ];

    return (
        <div className="ds-section-spacing animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Active Delivery Boys
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h1>
                    <p className="ds-description mt-1">Real-time fleet monitoring, live wallet balances, earnings, and KYC verification records.</p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <Card key={idx} className="p-6 border-none shadow-xl ring-1 ring-slate-100 hover:ring-primary/20 transition-all group overflow-hidden relative">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="ds-label mb-2">{stat.label}</p>
                                <h3 className="ds-stat-medium">{stat.value}</h3>
                            </div>
                            <div className={cn(
                                "p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg",
                                stat.color === 'indigo' ? "bg-brand-500/10 text-brand-600 shadow-brand-100" :
                                    stat.color === 'emerald' ? "bg-emerald-500/10 text-emerald-600 shadow-emerald-100" :
                                        stat.color === 'amber' ? "bg-amber-500/10 text-amber-600 shadow-amber-100" :
                                            "bg-rose-500/10 text-rose-600 shadow-rose-100"
                            )}>
                                <stat.icon className="h-5 w-5" strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-700" />
                    </Card>
                ))}
            </div>

            {/* Filters & Search Section */}
            <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100 bg-white/50 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, phone, or operational area..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100/50 p-1 rounded-2xl flex items-center">
                            {['all', 'available', 'busy', 'offline'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={cn(
                                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                        statusFilter === status
                                            ? "bg-white text-slate-900 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                        <button className="p-3.5 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-600 hover:text-primary hover:ring-primary/30 transition-all shadow-sm">
                            <Filter className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </Card>

            {/* Riders Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative min-h-[300px]">
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-3xl">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching fleet stats...</p>
                        </div>
                    </div>
                )}
                <AnimatePresence mode='popLayout'>
                    {!isLoading && filteredRiders.length === 0 ?
                        <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                            <User className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500">No delivery partners found matching your filters.</p>
                        </div>
                        :
                        filteredRiders.map((rider) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={rider.id}
                            >
                                <Card className="group border-none shadow-xl ring-1 ring-slate-100 hover:ring-primary/20 transition-all overflow-hidden bg-white">
                                    <div className="p-6 space-y-5">
                                        {/* Rider Top Header */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className="relative">
                                                    <img 
                                                       src={rider.avatar && !rider.avatar.includes('emoji') && !rider.avatar.includes('avatar') ? rider.avatar : "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                                                       alt="" 
                                                       className="h-14 w-14 rounded-xl bg-gray-100 ring-2 ring-white shadow-sm object-cover group-hover:scale-105 transition-transform" 
                                                    />
                                                    <div className={cn(
                                                        "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white shadow-sm",
                                                        rider.status === 'available' ? 'bg-emerald-500' :
                                                            rider.status === 'busy' ? 'bg-amber-500' : 'bg-slate-300'
                                                    )} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{rider.name}</h4>
                                                    <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                                        <Phone className="h-3 w-3" />
                                                        <span className="text-[10px] font-bold">{rider.phone}</span>
                                                    </div>
                                                    <p className="text-[9px] font-mono font-bold text-slate-400 mt-0.5">ID: RD-{String(rider.id || '').slice(-6).toUpperCase()}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2.5 py-1 rounded-xl">
                                                <Star className="h-3 w-3 fill-current" />
                                                <span className="text-[11px] font-black">{rider.rating}</span>
                                            </div>
                                        </div>

                                        {/* Dynamic Metrics Row */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Today Earn</p>
                                                <span className="text-xs font-black text-emerald-600">₹{rider.todayEarnings.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2.5 rounded-xl text-center border-l border-slate-200/60">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Delivered</p>
                                                <span className="text-xs font-black text-slate-900">{rider.totalOrders}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2.5 rounded-xl text-center border-l border-slate-200/60">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Wallet</p>
                                                <span className="text-xs font-black text-brand-600">₹{rider.walletBalance.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>

                                        {/* Location & Vehicle */}
                                        <div className="space-y-1.5 pt-1 border-t border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <span className="text-[10px] font-semibold truncate">{rider.location}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <span className="text-[10px] font-semibold truncate">{rider.vehicle} • <span className="text-slate-900 font-bold">{rider.vehicleNum}</span></span>
                                            </div>
                                        </div>

                                        {/* Action Footer */}
                                        <div className="pt-1 flex items-center gap-2">
                                            <button
                                                onClick={() => handleAction('view', rider)}
                                                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                VIEW DRIVER
                                            </button>
                                            <button
                                                onClick={() => handleAction('edit', rider)}
                                                className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-brand-50 hover:text-brand-600 transition-all"
                                                title="Edit Driver"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleAction('delete', rider)}
                                                className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all"
                                                title="Deactivate Driver"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))
                    }
                </AnimatePresence>
            </div>
            <div className="mt-6 flex justify-center">
                <Pagination
                    page={page}
                    totalPages={Math.ceil(total / pageSize) || 1}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={(p) => fetchRiders(p)}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setPage(1);
                    }}
                    loading={isLoading}
                />
            </div>

            {/* Profile Detail Modal */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {viewingRider && (
                        <div className="fixed inset-0 z-[9999]">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl hidden sm:block"
                                onClick={() => setViewingRider(null)}
                            />
                            <motion.div
                                initial={{ opacity: 0, y: '100%' }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: '100%' }}
                                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                                className="fixed inset-0 z-10 flex h-[100dvh] flex-col bg-white sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[48px] sm:shadow-3xl"
                            >
                                {/* Mobile sticky header */}
                                <div className="lg:hidden sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Driver Profile</p>
                                        <h2 className="truncate text-base font-black text-slate-900">{viewingRider.name}</h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setViewingRider(null)}
                                        className="rounded-2xl p-2.5 hover:bg-slate-50 transition-all shrink-0"
                                        aria-label="Close"
                                    >
                                        <X className="h-5 w-5 text-slate-400" />
                                    </button>
                                </div>

                                <div
                                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden lg:flex lg:flex-row"
                                    style={{ WebkitOverflowScrolling: 'touch' }}
                                >
                                    {/* Left: Driver Profile Info */}
                                    <div className="lg:w-80 lg:min-h-0 bg-slate-50 p-5 border-b lg:border-b-0 lg:border-r border-slate-100 lg:overflow-y-auto lg:shrink-0">
                                        <div className="text-center mb-6">
                                            <img
                                                src={viewingRider.avatar && !viewingRider.avatar.includes('emoji') && !viewingRider.avatar.includes('avatar') ? viewingRider.avatar : "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                                                alt=""
                                                className="h-24 w-24 rounded-2xl bg-white shadow-xl object-cover ring-4 ring-white mx-auto"
                                            />
                                            <h3 className="ds-h2 mt-3">{viewingRider.name}</h3>
                                            <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">ID: RD-{String(viewingRider.id || '').slice(-6).toUpperCase()}</p>
                                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">Joined: {viewingRider.joinDate}</p>
                                        </div>

                                        {/* Quick Financial Summary Pill */}
                                        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs mb-5 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Wallet Balance</span>
                                                <span className="text-sm font-black text-brand-600">₹{viewingRider.walletBalance.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Today Earnings</span>
                                                <span className="text-xs font-black text-emerald-600">₹{viewingRider.todayEarnings.toLocaleString('en-IN')}</span>
                                            </div>
                                            {viewingRider.cashInHand > 0 && (
                                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">COD Cash in Hand</span>
                                                    <span className="text-xs font-black text-amber-700">₹{viewingRider.cashInHand.toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned / Preferred Area</p>
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                                                    {renderVal(viewingRider.preferredArea || viewingRider.location)}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Work Vehicle</p>
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                                                    {renderVal(viewingRider.vehicle)}
                                                </div>
                                            </div>
                                            <div className="pt-4 border-t border-slate-200">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Driver Status</p>
                                                <Badge variant={viewingRider.status === 'available' ? 'success' : viewingRider.status === 'busy' ? 'warning' : 'neutral'} className="text-[9px] font-black uppercase">
                                                    {viewingRider.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Performance & Registration Details */}
                                    <div className="flex-1 p-5 lg:p-14 bg-white lg:min-h-0 lg:overflow-y-auto">
                                        <div className="flex justify-between items-start gap-3 mb-6">
                                            <div className="min-w-0">
                                                <h2 className="ds-h1 text-xl sm:text-2xl">Driver Intelligence & KYC</h2>
                                                <p className="ds-description mt-1 text-sm">Live performance stats, earnings, wallet balances, and registered KYC credentials.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setViewingRider(null)}
                                                className="hidden sm:inline-flex p-2.5 sm:p-3 hover:bg-slate-50 rounded-2xl transition-all shrink-0"
                                                aria-label="Close"
                                            >
                                                <X className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400" />
                                            </button>
                                        </div>

                                        {/* Dynamic Live Analytics & Financials Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-xl mb-8">
                                            <div className="text-center p-2">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Lifetime Rating</p>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Star className="h-4 w-4 text-amber-400 fill-current" />
                                                    <span className="text-base sm:text-lg font-black text-white">{viewingRider.rating}</span>
                                                </div>
                                            </div>
                                            <div className="text-center p-2 border-l border-slate-700/80">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Deliveries</p>
                                                <div className="flex items-center justify-center gap-1">
                                                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                                    <span className="text-base sm:text-lg font-black text-white">{viewingRider.totalOrders}</span>
                                                </div>
                                            </div>
                                            <div className="text-center p-2 border-t sm:border-t-0 sm:border-l border-slate-700/80">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Wallet Balance</p>
                                                <span className="text-base sm:text-lg font-black text-emerald-400">₹{viewingRider.walletBalance.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="text-center p-2 border-t sm:border-t-0 border-l border-slate-700/80">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Earnings</p>
                                                <span className="text-base sm:text-lg font-black text-amber-400">₹{viewingRider.totalEarnings.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>

                                        {/* Contact & Personal Info Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact & Personal Info</h4>
                                                <div className="p-5 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-primary shrink-0">
                                                            <Phone className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Phone Number</p>
                                                            {renderVal(viewingRider.phone)}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-primary shrink-0">
                                                            <Mail className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Email Address</p>
                                                            {renderVal(viewingRider.email)}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-primary shrink-0">
                                                            <MapPin className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Full Address</p>
                                                            {renderVal(viewingRider.address)}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                                                        <div>
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Date of Birth</p>
                                                            {renderVal(viewingRider.dob)}
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Blood Group</p>
                                                            {renderVal(viewingRider.bloodGroup)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vehicle & License Details</h4>
                                                <div className="p-5 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-brand-600 shrink-0">
                                                            <Truck className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Vehicle Type</p>
                                                            {renderVal(viewingRider.vehicle)}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-brand-600 shrink-0">
                                                            <ShieldCheck className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Vehicle Registration No.</p>
                                                            {renderVal(viewingRider.vehicleNumber || viewingRider.vehicleNum, { isMono: true, isUppercase: true })}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-brand-600 shrink-0">
                                                            <FileText className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Driving License No.</p>
                                                            {renderVal(viewingRider.drivingLicenseNumber, { isMono: true, isUppercase: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Identification & Bank Details Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Government Identification</h4>
                                                <div className="p-5 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-indigo-600 shrink-0">
                                                            <IdCard className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">Aadhaar Card Number</p>
                                                            {renderVal(viewingRider.aadharNumber, { isMono: true })}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-indigo-600 shrink-0">
                                                            <FileSearch className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-slate-400 uppercase">PAN Card Number</p>
                                                            {renderVal(viewingRider.panNumber, { isMono: true, isUppercase: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Bank Account Details</h4>
                                                <div className="p-5 bg-amber-50/50 rounded-2xl space-y-3 border border-amber-100/80">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-amber-600 shrink-0">
                                                            <Building className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-amber-700/80 uppercase">Account Holder Name</p>
                                                            {renderVal(viewingRider.accountHolder)}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-amber-600 shrink-0">
                                                            <CreditCard className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-amber-700/80 uppercase">Account Number</p>
                                                            {renderVal(viewingRider.accountNumber, { isMono: true })}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-amber-600 shrink-0">
                                                            <Hash className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-amber-700/80 uppercase">IFSC Code</p>
                                                            {renderVal(viewingRider.ifsc, { isMono: true, isUppercase: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Financial & Wallet Breakdown */}
                                        <div className="space-y-3 mb-6">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Wallet & Live Financial Breakdown</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="p-4 bg-emerald-50/60 border border-emerald-200/60 rounded-2xl flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                                        <WalletIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider">Available Wallet</p>
                                                        <p className="text-base font-black text-emerald-700 mt-0.5">₹{viewingRider.walletBalance.toLocaleString('en-IN')}</p>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-blue-50/60 border border-blue-200/60 rounded-2xl flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                                        <TrendingUp className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-blue-800 uppercase tracking-wider">Today's Earnings</p>
                                                        <p className="text-base font-black text-blue-700 mt-0.5">₹{viewingRider.todayEarnings.toLocaleString('en-IN')}</p>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-amber-50/60 border border-amber-200/60 rounded-2xl flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                                        <Banknote className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-amber-800 uppercase tracking-wider">Cash In Hand (COD)</p>
                                                        <p className="text-base font-black text-amber-700 mt-0.5">₹{viewingRider.cashInHand.toLocaleString('en-IN')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Submitted KYC Documents */}
                                        <div className="space-y-4 mb-8 lg:mb-10">
                                            {(() => {
                                                const isRealAvatar = viewingRider.avatar
                                                    && !viewingRider.avatar.includes('emoji')
                                                    && !viewingRider.avatar.includes('avatar');
                                                const allDocs = isRealAvatar
                                                    ? [...(viewingRider.documents || []), 'profilePhoto']
                                                    : (viewingRider.documents || []);
                                                const urlFor = (doc) =>
                                                    doc === 'profilePhoto' ? viewingRider.avatar : viewingRider.documentUrls?.[doc];

                                                if (allDocs.length === 0) {
                                                    return (
                                                        <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-100">
                                                            <p className="text-xs font-bold text-slate-400">No documents uploaded during registration.</p>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Submitted Documents ({allDocs.length})</h4>
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                                            {allDocs.map((doc, idx) => {
                                                                const docUrl = urlFor(doc);
                                                                return (
                                                                  <a
                                                                        key={idx}
                                                                        href={docUrl || "#"}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="group relative aspect-[4/3] bg-slate-100 rounded-[24px] overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all flex flex-col items-center justify-center"
                                                                    >
                                                                        {docUrl ? (
                                                                            <img
                                                                                src={docUrl}
                                                                                alt={doc}
                                                                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                                            />
                                                                        ) : (
                                                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                                                                <FileSearch className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors" />
                                                                                <p className="text-[9px] font-black text-slate-500 uppercase mt-2 text-center">{doc}</p>
                                                                            </div>
                                                                        )}
                                                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Open {doc === 'profilePhoto' ? 'Photo' : doc}</span>
                                                                        </div>
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pb-8 sm:pb-8 lg:pb-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const r = viewingRider;
                                                    setViewingRider(null);
                                                    handleAction('edit', r);
                                                }}
                                                className="flex-1 py-4 sm:py-5 bg-slate-900 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                EDIT DRIVER PROFILE
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const r = viewingRider;
                                                    setViewingRider(null);
                                                    handleAction('delete', r);
                                                }}
                                                className="py-4 sm:py-5 px-5 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95"
                                            >
                                                DEACTIVATE DRIVER
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Onboard / Edit Modal */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {(isEditModalOpen || (!isSellerView && isOnboardModalOpen)) && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg"
                                onClick={() => {
                                    setIsOnboardModalOpen(false);
                                    setIsEditModalOpen(false);
                                }}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                className="w-full max-w-lg max-h-[90vh] overflow-y-auto relative z-[10000] bg-white rounded-2xl p-5 shadow-3xl"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                <h3 className="ds-h2 mb-2">
                                    {isEditModalOpen ? 'Edit Rider' : 'Add New Rider'}
                                </h3>
                                <p className="ds-label mt-1 text-slate-500">
                                    {isEditModalOpen ? 'Update rider details below.' : 'Enter details to register a new delivery partner.'}
                                </p>

                                <form onSubmit={isEditModalOpen ? handleEditSubmit : handleOnboardSubmit} className="space-y-5">
                                    <div className="grid grid-cols-1 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Identity Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={formState.name}
                                                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                                className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                                placeholder="e.g. Rahul Sharma"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Contact</label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={formState.phone}
                                                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                                    placeholder="+91..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Vehicle</label>
                                                <select
                                                    required
                                                    value={formState.vehicle}
                                                    onChange={(e) => setFormState({ ...formState, vehicle: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all appearance-none"
                                                >
                                                    <option value="">Select Vehicle</option>
                                                    <option value="Bike">Bike</option>
                                                    <option value="Scooter">Scooter</option>
                                                    <option value="Cycle">Cycle</option>
                                                    <option value="Three Wheeler">Three Wheeler</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                        </div>
                                        {formState.vehicle !== 'Cycle' && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registration Vehicle No.</label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={formState.vehicleNum}
                                                    onChange={(e) => setFormState({ ...formState, vehicleNum: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                                    placeholder="e.g. MH-12-AB-0000"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Operational Area</label>
                                            <input
                                                required
                                                type="text"
                                                value={formState.location}
                                                onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                                                className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                                placeholder="e.g. Bandra West, Mumbai"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="w-full py-4.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all transform active:scale-[0.98] mt-4 disabled:opacity-60 disabled:pointer-events-none"
                                    >
                                        {isEditModalOpen
                                            ? (isSaving ? 'SAVING...' : 'SAVE CHANGES')
                                            : 'ADD RIDER'}
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

export default ActiveDeliveryBoys;
