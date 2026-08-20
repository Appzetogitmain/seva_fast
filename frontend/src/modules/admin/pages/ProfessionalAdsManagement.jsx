import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { useToast } from '@shared/components/ui/Toast';


import {
    Plus,
    Search,
    Loader2,
    Sparkles,
    Briefcase,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Edit3,
    Trash2,
    ArrowRight,
    MapPin,
    Calendar,
    DollarSign,
    Phone,
    Mail,
    ChevronDown,
    X,
    Upload,
    User,
    Crop
} from 'lucide-react';
import ImageCropperModal from '@shared/components/ui/ImageCropperModal';

const ProfessionalAdsManagement = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('moderation'); // 'moderation', 'categories', or 'platformBanners'
    const [isLoading, setIsLoading] = useState(true);

    // Categories State
    const [categories, setCategories] = useState([]);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryName, setCategoryName] = useState('');
    const [categoryDesc, setCategoryDesc] = useState('');
    const [categoryIcon, setCategoryIcon] = useState('');
    const [categoryPriceType, setCategoryPriceType] = useState('free');
    const [categoryPrice, setCategoryPrice] = useState('');
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);

    // Ads Moderation State
    const [ads, setAds] = useState([]);
    const [statusFilter, setStatusFilter] = useState(''); // 'pending', 'approved', 'rejected'
    const [paymentFilter, setPaymentFilter] = useState(''); // 'unpaid', 'paid', 'expired'
    const [moderationSearch, setModerationSearch] = useState('');
    const [selectedAdForDetail, setSelectedAdForDetail] = useState(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedAdForReject, setSelectedAdForReject] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Platform Ads (Banners) State
    const [platformAds, setPlatformAds] = useState([]);
    const [isPlatRejectModalOpen, setIsPlatRejectModalOpen] = useState(false);
    const [selectedPlatAdForReject, setSelectedPlatAdForReject] = useState(null);
    const [platRejectionReason, setPlatRejectionReason] = useState('');
    const [selectedPlatAdForDetail, setSelectedPlatAdForDetail] = useState(null);

    const fetchData = async (showSpinner = true) => {
        try {
            if (showSpinner) setIsLoading(true);
            const catRes = await adminApi.getProfessionalCategories();
            if (catRes.data?.success) {
                setCategories(catRes.data.result || catRes.data.results || []);
            }

            const adsRes = await adminApi.getProfessionalAds({
                status: statusFilter || undefined,
                paymentStatus: paymentFilter || undefined
            });
            if (adsRes.data?.success) {
                setAds(adsRes.data.result || adsRes.data.results || []);
            }

            const platAdsRes = await adminApi.getPlatformAds({
                status: statusFilter || undefined,
                paymentStatus: paymentFilter || undefined
            });
            if (platAdsRes.data?.success) {
                setPlatformAds(platAdsRes.data.result || platAdsRes.data.results || []);
            }
        } catch (error) {
            console.error("Failed to load professional data", error);
            if (showSpinner) showToast('Failed to load listings', 'error');
        } finally {
            if (showSpinner) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData(true);

        const intervalId = setInterval(() => {
            fetchData(false);
        }, 5000);

        return () => clearInterval(intervalId);
    }, [statusFilter, paymentFilter]);

    useEffect(() => {
        const isAnyModalOpen = isCategoryModalOpen || !!selectedAdForDetail || isRejectModalOpen || !!selectedPlatAdForDetail || isPlatRejectModalOpen;
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isCategoryModalOpen, selectedAdForDetail, isRejectModalOpen, selectedPlatAdForDetail, isPlatRejectModalOpen]);

    // Categories Logic
    const handleOpenCategoryModal = (cat = null) => {
        if (cat) {
            setSelectedCategory(cat);
            setCategoryName(cat.name);
            setCategoryDesc(cat.description || '');
            setCategoryIcon(cat.icon || '');
            setCategoryPriceType(cat.priceType || 'free');
            setCategoryPrice(cat.price !== undefined ? cat.price : '');
        } else {
            setSelectedCategory(null);
            setCategoryName('');
            setCategoryDesc('');
            setCategoryIcon('');
            setCategoryPriceType('free');
            setCategoryPrice('');
        }
        setIsCategoryModalOpen(true);
    };

    const handleSelectIconFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
            showToast('File size is too large! Please choose a smaller image.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setImageToCrop(reader.result);
            setCropModalOpen(true);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleCropComplete = async (croppedFile) => {
        setCropModalOpen(false);
        try {
            setIsUploadingIcon(true);
            const formData = new FormData();
            formData.append('file', croppedFile);

            const res = await adminApi.uploadMedia(formData);
            if (res.data?.success && (res.data.result?.secureUrl || res.data.result?.url)) {
                setCategoryIcon(res.data.result.secureUrl || res.data.result.url);
                showToast('Image cropped & uploaded successfully', 'success');
            } else if (res.data?.secureUrl || res.data?.url) {
                setCategoryIcon(res.data.secureUrl || res.data.url);
                showToast('Image cropped & uploaded successfully', 'success');
            } else {
                showToast('Failed to upload cropped image', 'error');
            }
        } catch (error) {
            console.error("Icon upload error:", error);
            showToast('Error uploading image file', 'error');
        } finally {
            setIsUploadingIcon(false);
        }
    };

    const handleOpenCropperForExisting = () => {
        if (categoryIcon && categoryIcon.startsWith('http')) {
            setImageToCrop(categoryIcon);
            setCropModalOpen(true);
        }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        if (!categoryName.trim()) {
            return showToast('Category name is required', 'error');
        }
        if (categoryPriceType === 'paid' && (!categoryPrice || Number(categoryPrice) <= 0)) {
            return showToast('Please enter a valid price for a paid category', 'error');
        }
        try {
            const payload = {
                name: categoryName,
                description: categoryDesc,
                icon: categoryIcon,
                priceType: categoryPriceType,
                price: categoryPriceType === 'paid' ? Number(categoryPrice) : 0
            };

            if (selectedCategory) {
                await adminApi.updateProfessionalCategory(selectedCategory._id, payload);
                showToast('Category updated successfully', 'success');
            } else {
                await adminApi.createProfessionalCategory(payload);
                showToast('Category created successfully', 'success');
            }
            setIsCategoryModalOpen(false);
            fetchData();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save category', 'error');
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm('Are you sure you want to delete this category? Any existing ads in this category will lose reference.')) return;
        try {
            await adminApi.deleteProfessionalCategory(id);
            showToast('Category deleted successfully', 'success');
            fetchData();
        } catch (error) {
            showToast('Failed to delete category', 'error');
        }
    };

    // Moderation Logic
    const handleApproveAd = async (id) => {
        if (!window.confirm('Approve this professional advertisement? It will be published once payment is validated.')) return;
        try {
            const res = await adminApi.approveProfessionalAd(id);
            if (res.data?.success) {
                showToast('Advertisement listing approved successfully', 'success');
                if (selectedAdForDetail?._id === id) {
                    setSelectedAdForDetail(null);
                }
                fetchData();
            }
        } catch (error) {
            showToast('Failed to approve listing', 'error');
        }
    };

    const handleRejectAdSubmit = async (e) => {
        e.preventDefault();
        if (!rejectionReason.trim()) {
            return showToast('Rejection reason is required', 'error');
        }
        try {
            const res = await adminApi.rejectProfessionalAd(selectedAdForReject._id, { reason: rejectionReason });
            if (res.data?.success) {
                showToast('Listing rejected successfully', 'success');
                setIsRejectModalOpen(false);
                setRejectionReason('');
                setSelectedAdForReject(null);
                setSelectedAdForDetail(null);
                fetchData();
            }
        } catch (error) {
            showToast('Failed to reject listing', 'error');
        }
    };

    // Platform Ads Moderation Logic
    const handleApprovePlatAd = async (id) => {
        if (!window.confirm('Approve this platform promotional banner? It will be active once payment is made.')) return;
        try {
            const res = await adminApi.approvePlatformAd(id);
            if (res.data?.success) {
                showToast('Promotional banner approved successfully', 'success');
                if (selectedPlatAdForDetail?._id === id) {
                    setSelectedPlatAdForDetail(null);
                }
                fetchData();
            }
        } catch (error) {
            showToast('Failed to approve platform banner', 'error');
        }
    };

    const handleRejectPlatAdSubmit = async (e) => {
        e.preventDefault();
        if (!platRejectionReason.trim()) {
            return showToast('Rejection reason is required', 'error');
        }
        try {
            const res = await adminApi.rejectPlatformAd(selectedPlatAdForReject._id, { reason: platRejectionReason });
            if (res.data?.success) {
                showToast('Promotional banner rejected successfully', 'success');
                setIsPlatRejectModalOpen(false);
                setPlatRejectionReason('');
                setSelectedPlatAdForReject(null);
                setSelectedPlatAdForDetail(null);
                fetchData();
            }
        } catch (error) {
            showToast('Failed to reject platform banner', 'error');
        }
    };

    // Filtering Ads
    const filteredAds = ads.filter(ad => {
        const query = moderationSearch.toLowerCase();
        return (
            ad.name?.toLowerCase().includes(query) ||
            ad.profession?.toLowerCase().includes(query) ||
            ad.city?.toLowerCase().includes(query) ||
            ad.phone?.includes(query)
        );
    });

    const filteredPlatformAds = platformAds.filter(ad => {
        const query = moderationSearch.toLowerCase();
        return (
            ad.title?.toLowerCase().includes(query) ||
            ad.content?.toLowerCase().includes(query) ||
            ad.city?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Local Service Professionals
                        <div className="p-2 bg-brand-50 rounded-xl">
                            <Briefcase className="h-5 w-5 text-brand-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Review professional ads, approve catalogs, and configure local service directories.</p>
                </div>
                {activeTab === 'categories' && (
                    <button
                        onClick={() => handleOpenCategoryModal()}
                        className="flex items-center gap-3 px-8 py-4 bg-black text-white rounded-[24px] text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-100 hover:scale-[1.02] active:scale-95"
                    >
                        <Plus className="h-5 w-5" />
                        Add Service Category
                    </button>
                )}
            </div>

            {/* Tabs Bar */}
            <div className="flex border-b border-slate-100 gap-8 mt-6">
                <button
                    onClick={() => setActiveTab('moderation')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                        activeTab === 'moderation' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    Listing Moderation ({ads.length})
                    {activeTab === 'moderation' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-black rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('categories')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                        activeTab === 'categories' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    Service Categories ({categories.length})
                    {activeTab === 'categories' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-black rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('platformBanners')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                        activeTab === 'platformBanners' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    Platform Banner Ads ({platformAds.length})
                    {activeTab === 'platformBanners' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-black rounded-full" />}
                </button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="h-12 w-12 text-brand-500 animate-spin" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading details...</p>
                </div>
            ) : activeTab === 'categories' ? (
                /* CATEGORIES LIST TAB */
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map((cat) => (
                        <div key={cat._id} className="bg-white p-6 rounded-[32px] border border-slate-100 hover:shadow-lg transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-50 rounded-2xl text-brand-600 h-12 w-12 flex items-center justify-center overflow-hidden shrink-0">
                                        {cat.icon ? (
                                            cat.icon.startsWith('http') ? (
                                                <img src={cat.icon} alt={cat.name} className="h-full w-full object-cover rounded-xl" />
                                            ) : (
                                                <span className="text-xl">{cat.icon}</span>
                                            )
                                        ) : (
                                            <Briefcase className="h-5 w-5 text-brand-600" />
                                        )}
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">{cat.name}</h3>
                                </div>
                                <p className="text-sm text-slate-500 mt-4 leading-relaxed font-bold">
                                    {cat.description || "No description provided."}
                                </p>
                                <div className="mt-4 flex items-center gap-2 flex-wrap">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                        cat.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                    }`}>
                                        {cat.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                        cat.priceType === 'paid' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                                    }`}>
                                        {cat.priceType === 'paid' ? `Paid (₹${cat.price})` : 'Free'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-6 border-t border-slate-50 pt-4">
                                <button
                                    onClick={() => handleOpenCategoryModal(cat)}
                                    className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit3 className="h-4 w-4" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDeleteCategory(cat._id)}
                                    className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : activeTab === 'platformBanners' ? (
                /* PLATFORM BANNERS LIST TAB */
                <div className="mt-8 space-y-6">
                    {/* Filters Toolbar */}
                    <div className="flex flex-col xl:flex-row items-center gap-4 bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm w-full">
                        <div className="relative flex-1 group w-full">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by title, content, city..."
                                value={moderationSearch}
                                onChange={(e) => setModerationSearch(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-5 py-4 bg-slate-50 text-slate-600 rounded-[20px] text-xs font-black uppercase tracking-widest outline-none hover:bg-slate-100 cursor-pointer"
                            >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending Approval</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                className="px-5 py-4 bg-slate-50 text-slate-600 rounded-[20px] text-xs font-black uppercase tracking-widest outline-none hover:bg-slate-100 cursor-pointer"
                            >
                                <option value="">All Payments</option>
                                <option value="unpaid">Unpaid</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                    </div>

                    {filteredPlatformAds.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100">
                            <ShieldAlert className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-black text-slate-900">No Banner Requests Found</h3>
                            <p className="text-sm font-bold text-slate-400 mt-2">Adjust your filters or query.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredPlatformAds.map((adItem) => (
                                <div key={adItem._id} className="bg-white p-6 rounded-[32px] border border-slate-100 hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center relative">
                                            {adItem.imageUrl || adItem.mediaUrl ? (
                                                <img src={adItem.imageUrl || adItem.mediaUrl} alt="" className="w-full h-full object-cover" />
                                            ) : adItem.videoUrl ? (
                                                <video src={adItem.videoUrl} className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="text-[9px] font-black uppercase text-slate-400">No Media</span>
                                            )}
                                        </div>
                                        <div className="space-y-1 flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className="text-base font-black text-slate-900">{adItem.title}</h3>
                                                <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider">{adItem.city}</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                    adItem.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                                    adItem.approvalStatus === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                    {adItem.approvalStatus}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                    adItem.paymentStatus === 'paid' ? 'bg-sky-50 text-sky-600' : 'bg-slate-50 text-slate-500'
                                                }`}>
                                                    {adItem.paymentStatus}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 line-clamp-2 leading-relaxed">{adItem.content}</p>
                                            {adItem.targetUrl && (
                                                <a href={adItem.targetUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-brand-500 underline hover:text-brand-600 block truncate max-w-xs">
                                                    Target link: {adItem.targetUrl}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full lg:w-auto self-stretch lg:self-center shrink-0">
                                        <button
                                            onClick={() => setSelectedPlatAdForDetail(adItem)}
                                            className="flex-1 lg:flex-none px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                        >
                                            View Details
                                        </button>
                                        {adItem.approvalStatus === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleApprovePlatAd(adItem._id)}
                                                    className="flex-1 lg:flex-none px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedPlatAdForReject(adItem);
                                                        setIsPlatRejectModalOpen(true);
                                                    }}
                                                    className="flex-1 lg:flex-none px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* ADS LIST MODERATION TAB */
                <div className="mt-8 space-y-6">
                    {/* Filters Toolbar */}
                    <div className="flex flex-col xl:flex-row items-center gap-4 bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm w-full">
                        <div className="relative flex-1 group w-full">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by name, profession, city..."
                                value={moderationSearch}
                                onChange={(e) => setModerationSearch(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-5 py-4 bg-slate-50 text-slate-600 rounded-[20px] text-xs font-black uppercase tracking-widest outline-none hover:bg-slate-100 cursor-pointer"
                            >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending Approval</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                className="px-5 py-4 bg-slate-50 text-slate-600 rounded-[20px] text-xs font-black uppercase tracking-widest outline-none hover:bg-slate-100 cursor-pointer"
                            >
                                <option value="">All Payments</option>
                                <option value="unpaid">Unpaid</option>
                                <option value="paid">Paid</option>
                                <option value="expired">Expired</option>
                            </select>
                        </div>
                    </div>

                    {/* Listings Table / Cards */}
                    {filteredAds.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100">
                            <ShieldAlert className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-black text-slate-900">No Listings Found</h3>
                            <p className="text-sm font-bold text-slate-400 mt-2">Adjust your search or filter options.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredAds.map((ad) => (
                                <div key={ad._id} className="bg-white p-6 rounded-[32px] border border-slate-100 hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h3 className="text-lg font-black text-slate-950">{ad.name}</h3>
                                            <span className="text-sm font-black text-brand-600">({ad.profession})</span>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                ad.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                                ad.approvalStatus === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                            }`}>
                                                {ad.approvalStatus}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                ad.paymentStatus === 'paid' ? 'bg-sky-50 text-sky-600' : 'bg-slate-50 text-slate-500'
                                            }`}>
                                                {ad.paymentStatus}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500 flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" /> {ad.city} ({ad.address})
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" /> Exp: {ad.experienceYears} Years
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" /> {ad.phone}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full lg:w-auto self-stretch lg:self-center">
                                        <button
                                            onClick={() => setSelectedAdForDetail(ad)}
                                            className="flex-1 lg:flex-none px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                        >
                                            View Details
                                        </button>
                                        {ad.approvalStatus === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleApproveAd(ad._id)}
                                                    className="flex-1 lg:flex-none px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedAdForReject(ad);
                                                        setIsRejectModalOpen(true);
                                                    }}
                                                    className="flex-1 lg:flex-none px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* CATEGORY EDITOR MODAL */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
                    <div 
                        className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4 md:space-y-6 max-h-[85vh] overflow-y-auto scrollbar-thin"
                        data-lenis-prevent
                        data-lenis-prevent-touch
                        data-lenis-prevent-wheel
                    >
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-900">
                                {selectedCategory ? 'Edit Service Category' : 'Create Service Category'}
                            </h2>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveCategory} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Category Name</label>
                                <input
                                    type="text"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    placeholder="e.g. Plumbing Fixes"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Description</label>
                                <textarea
                                    value={categoryDesc}
                                    onChange={(e) => setCategoryDesc(e.target.value)}
                                    placeholder="Provide detailed description..."
                                    rows="3"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
                                />
                            </div>
                             <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Icon / Emoji / Image</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="text"
                                        value={categoryIcon}
                                        onChange={(e) => setCategoryIcon(e.target.value)}
                                        placeholder="e.g. 🔧 or Image URL"
                                        className="flex-1 px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                    
                                    {categoryIcon && categoryIcon.startsWith('http') && (
                                        <button
                                            type="button"
                                            onClick={handleOpenCropperForExisting}
                                            className="h-14 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-[16px] border border-amber-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                                            title="Crop & Re-position image"
                                        >
                                            <Crop className="h-4 w-4" />
                                            <span className="hidden sm:inline">Crop</span>
                                        </button>
                                    )}

                                    <label className="cursor-pointer shrink-0 flex flex-col items-center justify-center h-14 w-14 bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed rounded-[16px] transition-all relative overflow-hidden group">
                                        {isUploadingIcon ? (
                                            <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />
                                        ) : categoryIcon && categoryIcon.startsWith('http') ? (
                                            <img src={categoryIcon} alt="Uploaded Icon" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-slate-600">
                                                <Upload className="h-5 w-5" />
                                                <span className="text-[8px] font-black uppercase mt-0.5">Upload</span>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleSelectIconFile}
                                            disabled={isUploadingIcon}
                                        />
                                    </label>
                                </div>
                                {categoryIcon && !categoryIcon.startsWith('http') && (
                                    <div className="text-[10px] font-bold text-slate-500 mt-1">
                                        Emoji Preview: <span className="text-base">{categoryIcon}</span>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Category Type</label>
                                    <select
                                        value={categoryPriceType}
                                        onChange={(e) => setCategoryPriceType(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all cursor-pointer"
                                    >
                                        <option value="free">Free</option>
                                        <option value="paid">Paid</option>
                                    </select>
                                </div>
                                {categoryPriceType === 'paid' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Price (₹)</label>
                                        <input
                                            type="number"
                                            value={categoryPrice}
                                            onChange={(e) => setCategoryPrice(e.target.value)}
                                            placeholder="e.g. 499"
                                            min="1"
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="w-full py-4 bg-black text-white rounded-[20px] text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.01] mt-4"
                            >
                                Save Category
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* AD DETAIL VIEW MODAL */}
            {selectedAdForDetail && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[24px] md:rounded-[40px] max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                        {/* Fixed Header */}
                        <div className="p-6 md:p-8 pb-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">{selectedAdForDetail.name}</h2>
                                <span className="text-xs font-black text-brand-600">{selectedAdForDetail.profession}</span>
                            </div>
                            <button onClick={() => setSelectedAdForDetail(null)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div 
                            className="flex-1 overflow-y-auto p-6 md:p-8 pr-4 md:pr-6 space-y-6 scrollbar-thin"
                            data-lenis-prevent
                            data-lenis-prevent-touch
                            data-lenis-prevent-wheel
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Profile Details</h3>
                                    <div className="space-y-3 font-bold text-sm text-slate-700">
                                        {selectedAdForDetail.categories && selectedAdForDetail.categories.length > 0 ? (
                                            <p className="flex items-start gap-2">
                                                <Briefcase className="h-4 w-4 text-slate-400 mt-0.5" />
                                                <span>
                                                    <span className="text-slate-400 font-medium mr-1">Categories:</span>
                                                    {selectedAdForDetail.categories.map(c => c.name).join(', ')}
                                                </span>
                                            </p>
                                        ) : selectedAdForDetail.category?.name ? (
                                            <p className="flex items-center gap-2">
                                                <Briefcase className="h-4 w-4 text-slate-400" />
                                                <span className="text-slate-400 font-medium mr-1">Category:</span> {selectedAdForDetail.category.name}
                                            </p>
                                        ) : null}
                                        <p className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                                            <span>
                                                <span className="text-slate-400 font-medium">Address:</span> {selectedAdForDetail.address}, {selectedAdForDetail.city}
                                            </span>
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-indigo-400" />
                                            <span>
                                                <span className="text-slate-400 font-medium">Coordinates:</span> {selectedAdForDetail.lat || '22.7196'}, {selectedAdForDetail.lng || '75.8577'}
                                            </span>
                                        </p>
                                        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> <span className="text-slate-400 font-medium">Phone:</span> {selectedAdForDetail.phone}</p>
                                        {selectedAdForDetail.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> <span className="text-slate-400 font-medium">Email:</span> {selectedAdForDetail.email}</p>}
                                        <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" /> <span className="text-slate-400 font-medium">Experience:</span> {selectedAdForDetail.experienceYears} Years</p>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Description</h3>
                                        <p className="text-sm text-slate-600 leading-relaxed font-semibold bg-slate-50 p-4 rounded-2xl">{selectedAdForDetail.description}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Service Catalog ({selectedAdForDetail.services?.length || 0} Items)</h3>
                                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2 scrollbar-thin">
                                        {selectedAdForDetail.services?.length > 0 ? (
                                            selectedAdForDetail.services.map((svc, i) => (
                                                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900">{svc.name}</p>
                                                        {svc.description && <p className="text-[11px] text-slate-500 font-bold">{svc.description}</p>}
                                                    </div>
                                                    <span className="text-sm font-black text-emerald-600">₹{svc.price}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-slate-400 font-bold italic">No catalog services added yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {selectedAdForDetail.mediaUrl && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Submitted Advertisement Media</h3>
                                    <div className="max-w-xl mx-auto rounded-3xl overflow-hidden border border-slate-100 bg-slate-50 relative aspect-video flex items-center justify-center">
                                        {selectedAdForDetail.mediaType === 'image' ? (
                                            <img src={selectedAdForDetail.mediaUrl} alt={selectedAdForDetail.name} className="w-full h-full object-cover" />
                                        ) : selectedAdForDetail.mediaType === 'video' ? (
                                            <video src={selectedAdForDetail.mediaUrl} controls className="w-full h-full object-contain" />
                                        ) : (
                                            <span className="text-xs font-bold text-slate-400">No media attached</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedAdForDetail.owner && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/85 space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Account Submitter Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-bold text-sm text-slate-700">
                                    <p className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-100 truncate">
                                        <User className="h-4 w-4 text-indigo-500 shrink-0" />
                                        <span className="text-slate-400 font-medium shrink-0">Name:</span> 
                                        <span className="text-slate-800 truncate">{selectedAdForDetail.owner.name}</span>
                                    </p>
                                    <p className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-100 truncate">
                                        <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                                        <span className="text-slate-400 font-medium shrink-0">Phone:</span> 
                                        <span className="text-slate-800 truncate">{selectedAdForDetail.owner.phone}</span>
                                    </p>
                                    <p className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-100 truncate">
                                        <Mail className="h-4 w-4 text-amber-500 shrink-0" />
                                        <span className="text-slate-400 font-medium shrink-0">Email:</span> 
                                        <span className="text-slate-800 truncate">{selectedAdForDetail.owner.email}</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Fixed Footer */}
                        <div className="p-6 md:p-8 pt-4 border-t border-slate-100 flex gap-4 shrink-0">
                            <button
                                onClick={() => setSelectedAdForDetail(null)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Close View
                            </button>
                            {selectedAdForDetail.approvalStatus === 'pending' && (
                                <>
                                    <button
                                        onClick={() => handleApproveAd(selectedAdForDetail._id)}
                                        className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedAdForReject(selectedAdForDetail);
                                            setIsRejectModalOpen(true);
                                        }}
                                        className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-[20px] text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* REJECT MODAL */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
                    <div 
                        className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4 md:space-y-6 max-h-[85vh] overflow-y-auto scrollbar-thin"
                        data-lenis-prevent
                        data-lenis-prevent-touch
                        data-lenis-prevent-wheel
                    >
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-900">Provide Rejection Reason</h2>
                            <button onClick={() => setIsRejectModalOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleRejectAdSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rejection Reason</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="e.g. Inappropriate description or catalog pricing mismatch."
                                    rows="4"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
                                />
                            </div>
                            <div className="flex gap-4 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-rose-600 text-white rounded-[20px] text-xs font-black uppercase tracking-widest transition-all hover:bg-rose-700"
                                >
                                    Confirm Reject
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PLATFORM AD DETAIL MODAL */}
            {selectedPlatAdForDetail && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[24px] md:rounded-[40px] max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                        {/* Fixed Header */}
                        <div className="p-6 md:p-8 pb-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">{selectedPlatAdForDetail.title}</h2>
                                <span className="text-xs font-black text-brand-600">Platform Banner Request</span>
                            </div>
                            <button onClick={() => setSelectedPlatAdForDetail(null)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div 
                            className="flex-1 overflow-y-auto p-6 md:p-8 pr-4 md:pr-6 space-y-6 scrollbar-thin"
                            data-lenis-prevent
                            data-lenis-prevent-touch
                            data-lenis-prevent-wheel
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Campaign Details</h3>
                                    <div className="space-y-3 font-bold text-sm text-slate-700">
                                        <p className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-slate-400" />
                                            <span className="text-slate-400 font-medium">Target City:</span> {selectedPlatAdForDetail.city}
                                        </p>
                                        {selectedPlatAdForDetail.targetUrl && (
                                            <p className="flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-indigo-400" />
                                                <span className="text-slate-400 font-medium">Target URL:</span>
                                                <a href={selectedPlatAdForDetail.targetUrl} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline truncate max-w-xs">
                                                    {selectedPlatAdForDetail.targetUrl}
                                                </a>
                                            </p>
                                        )}
                                        <p className="flex items-center gap-2">
                                            <ShieldAlert className="h-4 w-4 text-slate-400" />
                                            <span className="text-slate-400 font-medium">Approval Status:</span>
                                            <span className="capitalize">{selectedPlatAdForDetail.approvalStatus}</span>
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <DollarSign className="h-4 w-4 text-slate-400" />
                                            <span className="text-slate-400 font-medium">Payment Status:</span>
                                            <span className="capitalize">{selectedPlatAdForDetail.paymentStatus}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Ad Description / Call-To-Action</h3>
                                    <p className="text-sm text-slate-600 leading-relaxed font-semibold bg-slate-50 p-4 rounded-2xl">
                                        {selectedPlatAdForDetail.content}
                                    </p>
                                </div>
                            </div>

                            {selectedPlatAdForDetail.owner && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/85 space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Advertiser Details (Requested By)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-bold text-sm text-slate-700">
                                        <p className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-100 truncate">
                                            <User className="h-4 w-4 text-indigo-500 shrink-0" />
                                            <span className="text-slate-400 font-medium shrink-0">Name:</span> 
                                            <span className="text-slate-800 truncate">{selectedPlatAdForDetail.owner.name}</span>
                                        </p>
                                        <p className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-100 truncate">
                                            <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                                            <span className="text-slate-400 font-medium shrink-0">Phone:</span> 
                                            <span className="text-slate-800 truncate">{selectedPlatAdForDetail.owner.phone}</span>
                                        </p>
                                        <p className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-100 truncate">
                                            <Mail className="h-4 w-4 text-amber-500 shrink-0" />
                                            <span className="text-slate-400 font-medium shrink-0">Email:</span> 
                                            <span className="text-slate-800 truncate">{selectedPlatAdForDetail.owner.email}</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {(selectedPlatAdForDetail.imageUrl || selectedPlatAdForDetail.videoUrl || selectedPlatAdForDetail.mediaUrl) && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Creative Media</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(selectedPlatAdForDetail.imageUrl || (selectedPlatAdForDetail.mediaUrl && selectedPlatAdForDetail.mediaType === 'image')) ? (
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Banner Photo (Image)</h4>
                                                <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 relative aspect-video flex items-center justify-center">
                                                    <img src={selectedPlatAdForDetail.imageUrl || selectedPlatAdForDetail.mediaUrl} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 opacity-50">
                                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Banner Photo (Image)</h4>
                                                <div className="rounded-2xl border border-slate-200 border-dashed relative aspect-video flex items-center justify-center bg-slate-50">
                                                    <span className="text-[10px] font-bold text-slate-400">No Image Uploaded</span>
                                                </div>
                                            </div>
                                        )}
                                        {(selectedPlatAdForDetail.videoUrl || (selectedPlatAdForDetail.mediaUrl && selectedPlatAdForDetail.mediaType === 'video')) ? (
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Banner Video</h4>
                                                <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 relative aspect-video flex items-center justify-center">
                                                    <video src={selectedPlatAdForDetail.videoUrl || selectedPlatAdForDetail.mediaUrl} controls className="w-full h-full object-contain" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 opacity-50">
                                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Banner Video</h4>
                                                <div className="rounded-2xl border border-slate-200 border-dashed relative aspect-video flex items-center justify-center bg-slate-50">
                                                    <span className="text-[10px] font-bold text-slate-400">No Video Uploaded</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Fixed Footer */}
                        <div className="p-6 md:p-8 pt-4 border-t border-slate-100 flex gap-4 shrink-0">
                            <button
                                onClick={() => setSelectedPlatAdForDetail(null)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Close View
                            </button>
                            {selectedPlatAdForDetail.approvalStatus === 'pending' && (
                                <>
                                    <button
                                        onClick={() => handleApprovePlatAd(selectedPlatAdForDetail._id)}
                                        className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedPlatAdForReject(selectedPlatAdForDetail);
                                            setIsPlatRejectModalOpen(true);
                                        }}
                                        className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-[20px] text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PLATFORM AD REJECT MODAL */}
            {isPlatRejectModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[310] p-4 animate-in fade-in">
                    <div 
                        className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4 md:space-y-6 max-h-[85vh] overflow-y-auto scrollbar-thin"
                        data-lenis-prevent
                        data-lenis-prevent-touch
                        data-lenis-prevent-wheel
                    >
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-900">Reject Banner Request</h2>
                            <button onClick={() => setIsPlatRejectModalOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleRejectPlatAdSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rejection Reason</label>
                                <textarea
                                    value={platRejectionReason}
                                    onChange={(e) => setPlatRejectionReason(e.target.value)}
                                    placeholder="e.g. Media resolution too low or target URL is invalid."
                                    rows="4"
                                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-[16px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
                                />
                            </div>
                            <div className="flex gap-4 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsPlatRejectModalOpen(false)}
                                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-rose-600 text-white rounded-[20px] text-xs font-black uppercase tracking-widest transition-all hover:bg-rose-700"
                                >
                                    Confirm Reject
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* IMAGE CROPPER MODAL */}
            <ImageCropperModal
                isOpen={cropModalOpen}
                imageSrc={imageToCrop}
                aspectRatio={16 / 10}
                title="Crop Service Category Image"
                onCropComplete={handleCropComplete}
                onClose={() => setCropModalOpen(false)}
            />
        </div>
    );
};

export default ProfessionalAdsManagement;
