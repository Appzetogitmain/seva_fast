import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Search,
    Filter,
    CheckCircle,
    XCircle,
    FileSearch,
    Phone,
    Mail,
    Truck,
    MapPin,
    Calendar,
    IdCard,
    RotateCw,
    Check,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';

const PendingDeliveryBoys = () => {
    const [pendingRiders, setPendingRiders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewingRider, setViewingRider] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fetch Pending Riders
    const fetchPendingRiders = async () => {
        setIsLoading(true);
        try {
            // verified=false fetches riders waiting for review
            const params = { verified: 'false' };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            const response = await adminApi.getDeliveryPartners(params);
            const payload = response.data.result || {};
            const list = Array.isArray(payload.items) ? payload.items : (response.data.results || []);

            // Map backend data to frontend format
            const mappedRiders = list.map(r => ({
                id: r._id,
                name: r.name,
                phone: r.phone,
                email: r.email,
                avatar: r.profileImage,
                appliedDate: new Date(r.createdAt).toLocaleDateString(),
                location: r.currentArea || 'Unknown',
                vehicle: r.vehicleType ? r.vehicleType.charAt(0).toUpperCase() + r.vehicleType.slice(1) : 'Bike',
                documents: Object.keys(r.documents || {}).filter(key => r.documents[key]),
                documentUrls: r.documents || {},
                status: r.isVerified ? 'approved' : 'pending_review',
                experience: 'Not Specified', // Mock for now
                preferredArea: r.currentArea || 'Not Specified'
            }));

            setPendingRiders(mappedRiders);
        } catch (error) {
            console.error('Fetch Pending Riders Error:', error);
            toast.error('Failed to load applications');
        } finally {
            setIsLoading(false);
        }
    };


React.useEffect(() => {
    const timer = setTimeout(() => {
        fetchPendingRiders();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchTerm, filterStatus]);

// Lock body scroll when modal is open
React.useEffect(() => {
    if (viewingRider) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
}, [viewingRider]);


const filteredRiders = useMemo(() => {
    return pendingRiders.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm);
        const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
        return matchesSearch && matchesStatus;
    });
}, [pendingRiders, searchTerm, filterStatus]);

const handleApprove = async (id) => {
    setIsProcessing(true);
    try {
        await adminApi.approveDeliveryPartner(id);
        toast.success('Rider Approved & Activated!');
        setPendingRiders(pendingRiders.filter(r => r.id !== id));
        setViewingRider(null);
    } catch (error) {
        console.error('Approval Error:', error);
        toast.error('Failed to approve rider');
    } finally {
        setIsProcessing(false);
    }
};

const handleReject = async (id) => {
    if (window.confirm('Are you sure you want to reject this application?')) {
        setIsProcessing(true);
        try {
            await adminApi.rejectDeliveryPartner(id);
            toast.success('Application Rejected');
            setPendingRiders(pendingRiders.filter(r => r.id !== id));
            setViewingRider(null);
        } catch (error) {
            console.error('Rejection Error:', error);
            toast.error('Failed to reject rider');
        } finally {
            setIsProcessing(false);
        }
    }
};

return (
    <div className="ds-section-spacing animate-in fade-in duration-700">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
                <h1 className="ds-h1 flex flex-wrap items-center gap-2 sm:gap-3 text-xl sm:text-2xl">
                    Rider Applications
                    <Badge variant="primary" className="text-[10px] px-2 py-0.5 uppercase">Pending Review</Badge>
                </h1>
                <p className="ds-description mt-1 text-sm">Review documents for new delivery partners.</p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
                <button
                    type="button"
                    onClick={fetchPendingRiders}
                    className="p-3 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-400 hover:text-primary transition-all shadow-sm active:rotate-180 duration-500"
                >
                    <RotateCw className="h-5 w-5" />
                </button>
                <div className="h-10 w-px bg-slate-200" />
                <div className="flex flex-col items-end">
                    <p className="ds-label">Total Pending</p>
                    <h4 className="ds-h2">{pendingRiders.length}</h4>
                </div>
            </div>
        </div>

        {/* Utility Bar */}
        <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100 bg-white/50 backdrop-blur-xl">
            <div className="flex flex-col gap-4">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by name or mobile..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-100/50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                </div>
                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                    <div className="bg-slate-100/50 p-1 rounded-2xl flex items-center shrink-0">
                        {['all', 'pending', 'missing_info'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={cn(
                                    "px-3 sm:px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                                    filterStatus === status
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {status === 'pending' ? 'PENDING' : status.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                    <button className="p-3.5 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-600 hover:text-primary transition-all shrink-0">
                        <Filter className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </Card>

        {/* Applications — mobile cards */}
        <div className="lg:hidden space-y-3 relative min-h-[200px]">
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Applications...</p>
                    </div>
                </div>
            )}
            {!isLoading && filteredRiders.length === 0 ? (
                <Card className="border-none shadow-sm ring-1 ring-slate-100 bg-white p-10 text-center">
                    <FileSearch className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-500">No pending applications found.</p>
                </Card>
            ) : (
                filteredRiders.map((rider) => (
                    <Card
                        key={rider.id}
                        className="border-none shadow-sm ring-1 ring-slate-100 bg-white p-4 space-y-4"
                    >
                        <div className="flex items-start gap-3">
                            <img
                                src={rider.avatar && !rider.avatar.includes('emoji') && !rider.avatar.includes('avatar') ? rider.avatar : "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                                alt=""
                                className="h-14 w-14 rounded-xl bg-gray-100 ring-2 ring-white shadow-sm object-cover flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-slate-900 truncate">{rider.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                    <span className="text-xs font-bold text-slate-500">{rider.phone}</span>
                                </div>
                                <Badge variant={rider.status === 'pending_review' ? 'primary' : 'warning'} className="mt-2 text-[8px] font-black uppercase">
                                    {rider.status.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                            <div className="flex items-center gap-2 text-slate-600 min-w-0">
                                <Truck className="h-4 w-4 flex-shrink-0" />
                                <span className="text-xs font-bold truncate capitalize">{rider.vehicle}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 min-w-0">
                                <MapPin className="h-4 w-4 flex-shrink-0" />
                                <span className="text-xs font-bold truncate">{rider.location}</span>
                            </div>
                        </div>

                        {rider.documents.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {rider.documents.slice(0, 3).map((doc, i) => (
                                    <div key={i} className="h-6 px-2.5 bg-slate-100 rounded-md text-[9px] font-bold text-slate-500 flex items-center capitalize">
                                        {doc}
                                    </div>
                                ))}
                                {rider.documents.length > 3 && (
                                    <div className="h-6 px-2.5 bg-slate-100 rounded-md text-[9px] font-bold text-slate-400 flex items-center">
                                        +{rider.documents.length - 3} more
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setViewingRider(rider)}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl text-[11px] font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98]"
                        >
                            VIEW APPLICATION
                        </button>
                    </Card>
                ))
            )}
        </div>

        {/* Applications — desktop table */}
        <Card className="hidden lg:block border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl relative min-h-[400px]">
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Applications...</p>
                    </div>
                </div>
            )}
            <div className="w-full overflow-x-auto">
                {/* Header Row */}
                <div className="grid grid-cols-4 min-w-[720px] bg-slate-50/50 border-b border-slate-100 px-8 py-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Applicant Details</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operational Intel</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Submission Status</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</span>
                </div>

                {/* Body Rows */}
                <div className="divide-y divide-slate-50">
                    {!isLoading && filteredRiders.length === 0 ? (
                        <div className="py-20 text-center">
                            <FileSearch className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500">No pending applications found.</p>
                        </div>
                    ) : (
                        filteredRiders.map((rider) => (
                            <div key={rider.id} className="group grid grid-cols-4 min-w-[720px] items-center px-8 py-5 hover:bg-slate-50/50 transition-colors">
                                {/* Col 1: Applicant Details */}
                                <div className="flex items-center gap-4 min-w-0">
                                    <img
                                        src={rider.avatar && !rider.avatar.includes('emoji') && !rider.avatar.includes('avatar') ? rider.avatar : "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                                        alt=""
                                        className="h-12 w-12 rounded-lg bg-gray-100 ring-2 ring-white shadow-sm object-cover flex-shrink-0 group-hover:scale-110 transition-all"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900 truncate">{rider.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                            <span className="text-[10px] font-bold text-slate-500">{rider.phone}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Col 2: Operational Intel */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Truck className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span className="text-[10px] font-bold">{rider.vehicle}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span className="text-[10px] font-bold">{rider.location}</span>
                                    </div>
                                </div>

                                {/* Col 3: Submission Status */}
                                <div className="flex flex-col gap-2">
                                    <Badge variant={rider.status === 'pending_review' ? 'primary' : 'warning'} className="w-fit text-[8px] font-black uppercase">
                                        {rider.status.replace('_', ' ')}
                                    </Badge>
                                    <div className="flex flex-wrap gap-1">
                                        {rider.documents.slice(0, 2).map((doc, i) => (
                                            <div key={i} className="h-5 px-2 bg-slate-100 rounded-md text-[8px] font-bold text-slate-500 flex items-center">
                                                {doc}
                                            </div>
                                        ))}
                                        {rider.documents.length > 2 && (
                                            <div className="h-5 px-2 bg-slate-100 rounded-md text-[8px] font-bold text-slate-400 flex items-center">
                                                +{rider.documents.length - 2} More
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Col 4: Action */}
                                <div className="flex items-center justify-end">
                                    <button
                                        onClick={() => setViewingRider(rider)}
                                        className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
                                    >
                                        VIEW APPLICATION
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Card>

        {/* Application Review Modal */}
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
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Application Review</p>
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
                        {/* Left: Applicant Profile Info */}
                        <div className="lg:w-80 lg:min-h-0 bg-slate-50 p-5 border-b lg:border-b-0 lg:border-r border-slate-100 lg:overflow-y-auto lg:shrink-0">
                            <div className="text-center mb-10">
                                <img 
                                   src={viewingRider.avatar && !viewingRider.avatar.includes('emoji') && !viewingRider.avatar.includes('avatar') ? viewingRider.avatar : "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                                   alt="" 
                                   className="h-24 w-24 rounded-2xl bg-white shadow-xl object-cover ring-4 ring-white" 
                                />
                                <h3 className="ds-h2">{viewingRider.name}</h3>
                                <p className="ds-label text-primary mt-1">Applicant Node</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preferred Area</p>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <MapPin className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold">{viewingRider.preferredArea}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience</p>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <Calendar className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold">{viewingRider.experience}</span>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">System Confidence</p>
                                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-500 w-[85%]" />
                                    </div>
                                    <p className="text-[9px] font-bold text-brand-600 mt-2">85% Verification Score</p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Document & Action Section */}
                        <div className="flex-1 p-5 lg:p-14 bg-white lg:min-h-0 lg:overflow-y-auto">
                            <div className="flex justify-between items-start gap-3 mb-8 lg:mb-10">
                                <div className="min-w-0">
                                    <h2 className="ds-h1 text-xl sm:text-2xl">Verification Protocol</h2>
                                    <p className="ds-description mt-1 text-sm">Check submitted legal documents for platform entry.</p>
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 lg:mb-12">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact Records</h4>
                                    <div className="p-6 bg-slate-50 rounded-xl space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary">
                                                <Phone className="h-5 w-5" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-900">{viewingRider.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary">
                                                <Mail className="h-5 w-5" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-900">{viewingRider.email}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vehicle Identification</h4>
                                    <div className="p-6 bg-slate-50 rounded-xl border-2 border-brand-500/10">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-brand-600">
                                                <Truck className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-900">{viewingRider.vehicle}</p>
                                                <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest mt-0.5">Eco-Friendly Ready</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                             <div className="space-y-4 mb-8 lg:mb-14">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Submitted Documents ({viewingRider.documents.length})</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                    {viewingRider.documents.map((doc, idx) => {
                                        const docUrl = viewingRider.documentUrls?.[doc];
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
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Open {doc}</span>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pb-8 sm:pb-8 lg:pb-0">
                                <button
                                    disabled={isProcessing}
                                    onClick={() => handleApprove(viewingRider.id)}
                                    className="flex-1 py-4 sm:py-5 bg-slate-900 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Processing Verification...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" />
                                            APPROVE & ACTIVATE RIDER
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => handleReject(viewingRider.id)}
                                    className="py-4 sm:py-5 px-5 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95"
                                >
                                    REJECT APPLICATION
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
    </div>
);
};

export default PendingDeliveryBoys;
