import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    HiOutlineBuildingOffice2,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineEye,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineDocumentText,
    HiOutlineMapPin,
    HiOutlineCalendarDays,
    HiOutlineClock,
    HiOutlineXMark,
    HiOutlineArrowPath,
    HiOutlineArrowTopRightOnSquare,
    HiOutlineCloudArrowUp
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import AuthorisedSellerCertificateView from '@shared/components/AuthorisedSellerCertificateView';

const PendingSellers = () => {
    const navigate = useNavigate();
    const [pendingSellers, setPendingSellers] = useState([]);
    const [summaryStats, setSummaryStats] = useState({
        totalApplications: 0,
        receivedToday: 0,
        missingInfo: 0,
        avgReviewTimeHours: 24
    });
    const [searchTerm, setSearchTerm] = useState('');
    // Bug #72: "Filter by Date" — same preset-range dropdown pattern as OrdersList.jsx
    const [dateRange, setDateRange] = useState('All Time');
    const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [viewingSeller, setViewingSeller] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploadingKyc, setIsUploadingKyc] = useState(false);

    // Certificate Approval Modal states
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [showCertPreview, setShowCertPreview] = useState(false);
    const [certFormData, setCertFormData] = useState({
        certificateNo: '',
        sellerId: '',
        sellerName: '',
        shopName: '',
        category: '',
        cityLocation: '',
        issueDate: '',
        validFrom: '',
        validUntil: '',
        signatoryName: 'SEVAFAST Operations',
    });

    const handleKycFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast.error('Please upload a PDF document only.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size exceeds 2 MB limit. Please select a smaller PDF document.');
            return;
        }
        const formData = new FormData();
        formData.append('kycDocument', file);

        setIsUploadingKyc(true);
        try {
            const res = await adminApi.uploadSellerKycDocument(viewingSeller.id, formData);
            const updated = res.data?.result || res.data;
            setViewingSeller((prev) => ({
                ...prev,
                officialKycDocumentUrl: updated.officialKycDocumentUrl || updated.officialKycDocumentUrl,
                kycUploadedAt: updated.kycUploadedAt
            }));
            toast.success('Official KYC Document PDF uploaded successfully! Seller notified.');
            await fetchPendingSellers();
        } catch (error) {
            console.error('Failed to upload KYC document', error);
            toast.error(error.response?.data?.message || 'Failed to upload KYC document');
        } finally {
            setIsUploadingKyc(false);
        }
    };

    const fetchPendingSellers = async () => {
        setIsLoading(true);
        try {
            const response = await adminApi.getPendingSellers({ q: searchTerm || undefined });
            const payload = response.data.result || {};
            const items = Array.isArray(payload.items) ? payload.items : [];
            setPendingSellers(items);
            setSummaryStats({
                totalApplications: payload.stats?.totalApplications ?? items.length,
                receivedToday: payload.stats?.receivedToday ?? 0,
                missingInfo: payload.stats?.missingInfo ?? items.filter((s) => (s.documents || []).length < 3).length,
                avgReviewTimeHours: payload.stats?.avgReviewTimeHours ?? 24
            });
        } catch (error) {
            console.error('Failed to fetch pending sellers', error);
            toast.error(error.response?.data?.message || 'Failed to load seller applications');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingSellers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isReviewModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isReviewModalOpen]);

    const stats = useMemo(() => ({
        total: summaryStats.totalApplications,
        today: summaryStats.receivedToday,
        urgent: summaryStats.missingInfo
    }), [summaryStats]);

    const matchesDateRange = (createdAt, range) => {
        if (range === 'All Time') return true;
        if (!createdAt) return false;
        const applied = new Date(createdAt);
        if (Number.isNaN(applied.getTime())) return false;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (range === 'Today') {
            return applied >= startOfToday;
        }
        if (range === 'Yesterday') {
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);
            return applied >= startOfYesterday && applied < startOfToday;
        }
        if (range === 'Last 7 Days') {
            const sevenDaysAgo = new Date(startOfToday);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            return applied >= sevenDaysAgo;
        }
        if (range === 'This Month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return applied >= startOfMonth;
        }
        return true;
    };

    const filteredSellers = useMemo(() => {
        return pendingSellers.filter(s =>
            (String(s.shopName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(s.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
            matchesDateRange(s.createdAt, dateRange)
        );
    }, [pendingSellers, searchTerm, dateRange]);

    const reviewDocuments = useMemo(() => {
        if (!viewingSeller) {
            return [];
        }

        if (Array.isArray(viewingSeller.documentFiles) && viewingSeller.documentFiles.length) {
            return viewingSeller.documentFiles;
        }

        return (viewingSeller.documents || []).map((label, index) => ({
            key: `legacy-${index}`,
            label,
            url: '',
            fileName: label,
            isViewable: false,
            fileType: 'unknown'
        }));
    }, [viewingSeller]);

    const handleOpenApprovalModal = (seller) => {
        const targetSeller = seller || viewingSeller;
        if (!targetSeller) return;
        setViewingSeller(targetSeller);

        const todayStr = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
        const nextYearDate = new Date();
        nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
        const nextYearStr = nextYearDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });

        const sellerCode = targetSeller.sellerCode || targetSeller.id || `SF-${Date.now().toString().slice(-6)}`;
        const certNo = `SF-AS-${String(sellerCode).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

        setCertFormData({
            certificateNo: certNo,
            sellerId: sellerCode,
            sellerName: targetSeller.ownerName || targetSeller.name || '',
            shopName: targetSeller.shopName || '',
            category: targetSeller.category || 'General',
            cityLocation: targetSeller.location || targetSeller.city || 'Registered Location',
            issueDate: todayStr,
            validFrom: todayStr,
            validUntil: nextYearStr,
            signatoryName: 'SEVAFAST Operations',
        });

        setShowCertPreview(false);
        setIsApproveModalOpen(true);
    };

    const handleConfirmApproval = async () => {
        if (!viewingSeller?.id) return;
        setIsProcessing(true);
        try {
            await adminApi.approveSeller(viewingSeller.id, certFormData);
            setIsApproveModalOpen(false);
            setIsReviewModalOpen(false);
            setViewingSeller(null);
            toast.success('Seller approved & Authorised Certificate issued!');
            await fetchPendingSellers();
        } catch (error) {
            console.error('Failed to approve seller', error);
            toast.error(error.response?.data?.message || 'Failed to approve seller');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (id) => {
        if (window.confirm('Are you sure you want to reject this application?')) {
            setIsProcessing(true);
            try {
                const reason = window.prompt('Optional rejection reason (leave blank if not needed):') || '';
                await adminApi.rejectSeller(id, { reason });
                setIsReviewModalOpen(false);
                setViewingSeller(null);
                toast.success('Seller application rejected');
                await fetchPendingSellers();
            } catch (error) {
                console.error('Failed to reject seller', error);
                toast.error(error.response?.data?.message || 'Failed to reject seller');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Pending Approvals
                        <Badge variant="warning" className="admin-tiny px-1.5 py-0 font-bold animate-pulse">Action Required</Badge>
                    </h1>
                    <p className="ds-description mt-0.5">Check new seller applications before they can start selling.</p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl ring-1 ring-amber-100">
                    <HiOutlineClock className="h-4 w-4 text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Avg Review Time: {summaryStats.avgReviewTimeHours}h</span>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Applications', val: stats.total, icon: HiOutlineDocumentText, color: 'text-brand-600', bg: 'bg-brand-50' },
                    { label: 'Received Today', val: stats.today, icon: HiOutlineCalendarDays, color: 'text-brand-600', bg: 'bg-brand-50' },
                    { label: 'Missing Info', val: stats.urgent, icon: HiOutlineXCircle, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="ds-label">{stat.label}</p>
                                <h4 className="ds-stat-medium mt-1">{stat.val}</h4>
                            </div>
                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner", stat.bg, stat.color)}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Content Area */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
                    <div className="relative flex-1 w-full max-w-md">
                        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by shop name or owner..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                        >
                            <HiOutlineFunnel className="h-4 w-4" />
                            <span>{dateRange === 'All Time' ? 'Filter by Date' : dateRange}</span>
                        </button>

                        <AnimatePresence>
                            {isDateMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsDateMenuOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-100 p-2 z-20"
                                    >
                                        {['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'This Month'].map((range) => (
                                            <button
                                                key={range}
                                                onClick={() => {
                                                    setDateRange(range);
                                                    setIsDateMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                                    dateRange === range ? "bg-brand-50 text-brand-600" : "text-slate-500 hover:bg-slate-50"
                                                )}
                                            >
                                                {range}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="ds-table-header-cell px-6">Applicant Store</th>
                                <th className="ds-table-header-cell px-6">Documentation</th>
                                <th className="ds-table-header-cell px-6">Applied On</th>
                                <th className="ds-table-header-cell px-6 !text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <HiOutlineArrowPath className="h-8 w-8 text-slate-300 animate-spin" />
                                            <p className="text-slate-500 font-bold text-sm">Loading seller applications...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSellers.length > 0 ? filteredSellers.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/30 transition-colors group">
                                    <td className="px-6 py-5 align-middle">
                                        <div
                                            className="flex items-center gap-4 cursor-pointer group/name"
                                            onClick={() => navigate(`/admin/sellers/active/${s.id}`)}
                                        >
                                            <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-slate-100 group-hover:ring-primary/20 transition-all">
                                                <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400">
                                                    <HiOutlineBuildingOffice2 className="h-5 w-5" />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 group-hover/name:text-primary transition-colors">{s.shopName}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{s.ownerName}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {(s.documents || []).map((doc, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[8px] font-bold rounded-full ring-1 ring-brand-100 uppercase">{doc}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        <div className="flex flex-col justify-center">
                                            <span className="text-xs font-bold text-slate-700">{s.applicationDate}</span>
                                            <span className="text-[9px] font-medium text-slate-400">Received {s.receivedAt || 'Recently'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right align-middle">
                                        <div className="flex items-center justify-end gap-3 h-full">
                                            {s.documents && s.documents.length > 0 && (
                                                <button
                                                    onClick={() => handleOpenApprovalModal(s)}
                                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all ring-1 ring-emerald-100"
                                                    title="Approve & Issue Certificate"
                                                >
                                                    <HiOutlineCheckCircle className="h-5 w-5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleReject(s.id)}
                                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all ring-1 ring-rose-100"
                                                title="Quick Reject"
                                            >
                                                <HiOutlineXCircle className="h-5 w-5" />
                                            </button>
                                            <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                                            <button
                                                onClick={() => { setViewingSeller(s); setIsReviewModalOpen(true); }}
                                                className="h-9 px-4 bg-black  text-primary-foreground rounded-xl text-[10px] font-bold hover:bg-brand-700 transition-all shadow-md shadow-brand-100 hover:-translate-y-0.5 flex items-center gap-2"
                                            >
                                                <HiOutlineEye className="h-4 w-4" />
                                                REVIEW
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                <HiOutlineCheckCircle className="h-8 w-8 text-slate-200" />
                                            </div>
                                            <p className="text-slate-500 font-bold text-sm">All caught up! No pending applications.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Review Modal */}
            <AnimatePresence>
                {isReviewModalOpen && viewingSeller && (
                    <div className="fixed inset-0 z-[100] overflow-y-auto">
                        <div className="min-h-full flex items-center justify-center p-4 lg:p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-slate-900/80 backdrop-blur-md"
                                onClick={() => setIsReviewModalOpen(false)}
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                className="w-full max-w-4xl relative z-10 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto max-h-[90vh] custom-scrollbar">
                                    {/* Sidebar Info */}
                                    <div className="lg:col-span-4 bg-slate-50 p-4 border-r border-slate-100 lg:overflow-y-auto lg:max-h-[90vh] custom-scrollbar">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="h-20 w-20 rounded-xl bg-white shadow-xl flex items-center justify-center ds-stat-large font-bold text-primary border-4 border-white">
                                                {(viewingSeller.shopName || 'S').charAt(0)}
                                            </div>
                                            <button
                                                onClick={() => setIsReviewModalOpen(false)}
                                                className="lg:hidden p-2 hover:bg-slate-200 rounded-full"
                                            >
                                                <HiOutlineXMark className="h-5 w-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="ds-h2 leading-tight">{viewingSeller.shopName}</h3>
                                                <p className="text-xs font-bold text-primary mt-1 uppercase tracking-widest">{viewingSeller.category || 'General'} PARTNER</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <HiOutlineBuildingOffice2 className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-700">{viewingSeller.ownerName}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <HiOutlineEnvelope className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-500">{viewingSeller.email}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <HiOutlinePhone className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-700">{viewingSeller.phone}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <HiOutlineMapPin className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-500">{viewingSeller.location}</span>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-200">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Application Memo</h4>
                                                <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
                                                    "{viewingSeller.description}"
                                                </p>
                                            </div>

                                            <div className="pt-6 border-t border-slate-200 space-y-4">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">KYC & Registration</h4>
                                                
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">Business Type</span>
                                                        <span className="text-xs font-bold text-slate-700 capitalize">{viewingSeller.businessType || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">Seller Type</span>
                                                        <span className="text-xs font-bold text-slate-700 capitalize">{viewingSeller.sellerType || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">WhatsApp</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.whatsappNumber || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">PAN Number</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.panNumber || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">Aadhaar Number</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.aadhaarNumber || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">GSTIN</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.gstinNumber || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">Udyam No.</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.udyamNumber || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-200">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Bank Details</h4>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">Bank Name</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.bankDetails?.bankName || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">Account No.</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.bankDetails?.accountNumber || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">IFSC Code</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.bankDetails?.ifscCode || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                                                        <span className="text-xs text-slate-500">Branch</span>
                                                        <span className="text-xs font-bold text-slate-700">{viewingSeller.bankDetails?.branch || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Main Review Section */}
                                    <div className="lg:col-span-8 p-4 lg:p-5 bg-white relative lg:overflow-y-auto lg:max-h-[90vh] custom-scrollbar">
                                        <button
                                            onClick={() => setIsReviewModalOpen(false)}
                                            className="hidden lg:block absolute right-8 top-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                                        >
                                            <HiOutlineXMark className="h-6 w-6 text-slate-300" />
                                        </button>

                                        <div className="ds-section-spacing">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <HiOutlineDocumentText className="h-5 w-5 text-brand-500" />
                                                    <h4 className="text-sm font-bold text-slate-900">Submitted Verification Documents</h4>
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium">Check each document before final approval.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {reviewDocuments.length > 0 ? reviewDocuments.map((doc) => (
                                                    <div
                                                        key={doc.key}
                                                        className={`p-4 rounded-2xl border-2 transition-all group ${doc.isViewable
                                                                ? 'border-slate-50 bg-slate-50/50 hover:bg-white hover:border-brand-100'
                                                                : 'border-slate-100 bg-slate-50/70'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-110 transition-transform">
                                                                    <HiOutlineDocumentText className="h-5 w-5 text-brand-400" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-slate-700">{doc.label}</p>
                                                                    <p className={`text-[9px] font-bold uppercase tracking-tighter truncate ${doc.isViewable ? 'text-brand-500' : 'text-amber-500'
                                                                        }`}>
                                                                        {doc.isViewable
                                                                            ? doc.fileType === 'pdf'
                                                                                ? 'SECURE PDF'
                                                                                : 'SECURE IMAGE'
                                                                            : 'FILE LINK NOT AVAILABLE'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {doc.isViewable ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors shrink-0"
                                                                >
                                                                    <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5" />
                                                                    <span>View</span>
                                                                </button>
                                                            ) : (
                                                                <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                                                    <HiOutlineXMark className="h-3.5 w-3.5" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                                                        <p className="text-sm font-bold text-slate-500">No documents were submitted with this application.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Official KYC Document Upload Card */}
                                            <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <HiOutlineCloudArrowUp className="h-5 w-5 text-brand-400" />
                                                            <h5 className="text-xs font-bold text-white uppercase tracking-wider">Official Seller KYC Form (PDF)</h5>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                                                            Upload the signed & verified 2-page KYC document for this seller. The seller will be notified and can view it in their profile.
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {viewingSeller.officialKycDocumentUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() => window.open(viewingSeller.officialKycDocumentUrl, '_blank', 'noopener,noreferrer')}
                                                                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 ring-1 ring-white/10"
                                                            >
                                                                <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5 text-brand-400" />
                                                                <span>View KYC PDF</span>
                                                            </button>
                                                        )}

                                                        <label className="cursor-pointer px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ring-2 ring-brand-400/30">
                                                            {isUploadingKyc ? (
                                                                <>
                                                                    <HiOutlineArrowPath className="h-3.5 w-3.5 animate-spin" />
                                                                    <span>Uploading...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <HiOutlineCloudArrowUp className="h-3.5 w-3.5" />
                                                                    <span>{viewingSeller.officialKycDocumentUrl ? 'Replace KYC PDF' : 'Upload KYC PDF'}</span>
                                                                </>
                                                            )}
                                                            <input
                                                                type="file"
                                                                accept="application/pdf"
                                                                onChange={handleKycFileUpload}
                                                                disabled={isUploadingKyc}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-amber-50 rounded-xl p-6 border border-amber-100/50">
                                                <div className="flex gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                                                        <HiOutlineCheckCircle className="h-6 w-6 text-amber-700" />
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs font-bold text-amber-900">Initial Review Passed</h5>
                                                        <p className="text-[10px] text-amber-700/80 font-medium mt-1 leading-relaxed">
                                                            Our system automatically checked all basic identity and shop locations. You need to check documents manually now.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Bar */}
                                            <div className="flex items-center gap-4 pt-6">
                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() => handleReject(viewingSeller.id)}
                                                    className="flex-1 py-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-2xl text-[10px] font-bold tracking-widest transition-all uppercase"
                                                >
                                                    REJECT APPLICATION
                                                </button>
                                                {reviewDocuments.length > 0 && (
                                                    <button
                                                        disabled={isProcessing}
                                                        onClick={() => handleOpenApprovalModal(viewingSeller)}
                                                        className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-bold tracking-widest shadow-2xl hover:bg-slate-800 transition-all transform active:scale-[0.98] uppercase flex items-center justify-center gap-2"
                                                    >
                                                        {isProcessing ? (
                                                            <>
                                                                <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                                                                <span>PROCESSING...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <HiOutlineCheckCircle className="h-4 w-4" />
                                                                <span>APPROVE &amp; ISSUE CERTIFICATE</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Certificate Approval & Issuance Modal */}
            {isApproveModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col h-[90vh] max-h-[90vh] overflow-hidden border border-amber-200 animate-in fade-in zoom-in-95">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white flex items-center justify-between shrink-0 shadow">
                            <div>
                                <h3 className="font-bold text-lg">Approve Seller &amp; Issue Certificate</h3>
                                <p className="text-xs text-amber-100 font-medium">Verify auto-filled details and set certificate dates before approval.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsApproveModalOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition"
                            >
                                <HiOutlineXMark className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4 text-xs font-sans bg-slate-50 overscroll-contain">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-slate-500 font-semibold">Auto-filled from seller application data</span>
                                <button
                                    type="button"
                                    onClick={() => setShowCertPreview(!showCertPreview)}
                                    className="px-4 py-2 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs hover:bg-amber-200 transition shadow-sm"
                                >
                                    {showCertPreview ? "← Back to Edit Details" : "👁 Preview Certificate Layout"}
                                </button>
                            </div>

                            {showCertPreview ? (
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                    <AuthorisedSellerCertificateView certificate={certFormData} showPrintButton={false} />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Certificate No.</label>
                                        <input
                                            type="text"
                                            value={certFormData.certificateNo}
                                            onChange={(e) => setCertFormData({ ...certFormData, certificateNo: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-slate-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Seller ID</label>
                                        <input
                                            type="text"
                                            value={certFormData.sellerId}
                                            onChange={(e) => setCertFormData({ ...certFormData, sellerId: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-slate-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Seller / Owner Name</label>
                                        <input
                                            type="text"
                                            value={certFormData.sellerName}
                                            onChange={(e) => setCertFormData({ ...certFormData, sellerName: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Shop / Business Name</label>
                                        <input
                                            type="text"
                                            value={certFormData.shopName}
                                            onChange={(e) => setCertFormData({ ...certFormData, shopName: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Business Category</label>
                                        <input
                                            type="text"
                                            value={certFormData.category}
                                            onChange={(e) => setCertFormData({ ...certFormData, category: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Registered City / Location</label>
                                        <input
                                            type="text"
                                            value={certFormData.cityLocation}
                                            onChange={(e) => setCertFormData({ ...certFormData, cityLocation: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                                        />
                                    </div>

                                    <div className="md:col-span-2 border-t border-slate-200 pt-3 mt-2">
                                        <h4 className="font-extrabold text-amber-800 uppercase tracking-wider mb-2">Certificate Validity Dates</h4>
                                    </div>

                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Issue Date</label>
                                        <input
                                            type="text"
                                            value={certFormData.issueDate}
                                            onChange={(e) => setCertFormData({ ...certFormData, issueDate: e.target.value })}
                                            placeholder="DD / MM / YYYY"
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Valid From</label>
                                        <input
                                            type="text"
                                            value={certFormData.validFrom}
                                            onChange={(e) => setCertFormData({ ...certFormData, validFrom: e.target.value })}
                                            placeholder="DD / MM / YYYY"
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Valid Until</label>
                                        <input
                                            type="text"
                                            value={certFormData.validUntil}
                                            onChange={(e) => setCertFormData({ ...certFormData, validUntil: e.target.value })}
                                            placeholder="DD / MM / YYYY"
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-700 font-bold mb-1">Authorized Signatory Name</label>
                                        <input
                                            type="text"
                                            value={certFormData.signatoryName}
                                            onChange={(e) => setCertFormData({ ...certFormData, signatoryName: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsApproveModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl bg-slate-200 font-bold text-slate-700 hover:bg-slate-300 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isProcessing}
                                onClick={handleConfirmApproval}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-bold text-white shadow-lg hover:from-emerald-700 hover:to-teal-700 transition active:scale-95 flex items-center gap-2"
                            >
                                {isProcessing ? 'Processing...' : 'Confirm Approval & Issue Certificate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PendingSellers;
