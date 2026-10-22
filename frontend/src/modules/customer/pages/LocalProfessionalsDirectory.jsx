import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import {
    Image as ImageIcon,
    Search,
    MapPin,
    Briefcase,
    Phone,
    MessageCircle,
    Star,
    Compass,
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    X,
    Grid,
    List,
    DollarSign,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Edit3,
    Trash2,
    ShieldCheck
} from 'lucide-react';
import { useLockBodyScroll, preventBackdropScroll } from '@shared/hooks/useLockBodyScroll';
import { trackAdInteraction, getVisitorId } from '../../../core/utils/analyticsTracker';
import { useAuth } from '@core/context/AuthContext';

const getWhatsAppUrl = (phone, name) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(`Hello ${name || 'Sir'}, I found your profile on SevaFast and would like to inquire about your services.`);
    return `https://wa.me/${fullPhone}?text=${text}`;
};

const ProfessionalCard = ({ pro, onOpenCatalog, t, getWhatsAppUrl, categories }) => {
    const resolveCategoryName = (c) => {
        if (!c) return null;
        if (typeof c === 'object' && c.name) return c.name;
        const id = typeof c === 'string' ? c : (c._id || c.id);
        const found = categories?.find(cat => String(cat._id || cat.id) === String(id));
        if (found?.name) return found.name;
        if (typeof c === 'string' && /^[0-9a-fA-F]{24}$/.test(c)) return null;
        return typeof c === 'string' ? c : null;
    };
    const photos = React.useMemo(() => {
        const list = [];
        if (pro.mediaUrl) list.push(pro.mediaUrl);
        if (Array.isArray(pro.portfolioImages)) {
            pro.portfolioImages.forEach(img => {
                if (img && !list.includes(img)) list.push(img);
            });
        }
        if (Array.isArray(pro.services)) {
            pro.services.forEach(svc => {
                if (Array.isArray(svc.images)) {
                    svc.images.forEach(img => {
                        if (img && !list.includes(img)) list.push(img);
                    });
                } else if (svc.image && !list.includes(svc.image)) {
                    list.push(svc.image);
                }
            });
        }
        return list;
    }, [pro]);

    const [photoIndex, setPhotoIndex] = useState(0);

    const handlePrevPhoto = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setPhotoIndex(prev => (prev - 1 + photos.length) % photos.length);
    };

    const handleNextPhoto = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setPhotoIndex(prev => (prev + 1) % photos.length);
    };

    return (
        <div className="bg-white rounded-[32px] border border-slate-100 hover:shadow-xl transition-all overflow-hidden flex flex-col justify-between group">
            <div>
                {/* 1ST ROW: PHOTOS CAROUSEL */}
                <div className="relative aspect-[16/10] w-full bg-slate-100 overflow-hidden select-none">
                    {photos.length > 0 ? (
                        <>
                            <img
                                src={photos[photoIndex] || photos[0]}
                                alt={pro.name}
                                className="w-full h-full object-cover transition-all duration-300"
                            />
                            {photos.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handlePrevPhoto}
                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all active:scale-90 shadow-lg z-10"
                                        title="Previous Photo"
                                        aria-label="Previous"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNextPhoto}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all active:scale-90 shadow-lg z-10"
                                        title="Next Photo"
                                        aria-label="Next"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[9px] font-black text-white uppercase tracking-wider shadow-sm z-10">
                                        {photoIndex + 1} / {photos.length}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 p-4 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-brand-600 font-black text-2xl mb-1 border border-slate-200/60">
                                {pro.name?.charAt(0)?.toUpperCase() || 'P'}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{pro.profession}</span>
                        </div>
                    )}

                    {/* Rating Pill overlay (Dynamic Verified Ratings) */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenCatalog(pro, 'reviews');
                        }}
                        className="absolute top-3 right-3 flex items-center gap-1.5 text-amber-500 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-sm border border-slate-100 z-10 hover:bg-white hover:scale-105 transition-all cursor-pointer shadow-sm"
                        title="View verified customer reviews"
                    >
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        {pro.ratingCount > 0 ? (
                            <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                                {Number(pro.rating || 5.0).toFixed(1)}
                                <span className="text-[10px] text-slate-400 font-bold">({pro.ratingCount})</span>
                            </span>
                        ) : (
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">NEW</span>
                        )}
                    </button>

                    {/* Profession Tag overlay */}
                    <div className="absolute top-3 left-3 flex items-center gap-1 z-10">
                        <span className="px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                            {pro.profession}
                        </span>
                    </div>
                </div>

                {/* 2ND ROW: DETAILS BELOW THE CAROUSEL */}
                <div className="p-5 md:p-6 space-y-4">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-black text-slate-955 leading-tight truncate">{pro.name}</h3>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {(() => {
                                    const catsList = (Array.isArray(pro.categories) && pro.categories.length > 0)
                                        ? pro.categories
                                        : (pro.category ? [pro.category] : []);
                                    const names = catsList
                                        .map(resolveCategoryName)
                                        .filter(Boolean);
                                    if (names.length === 0) return null;
                                    return names.map((catName, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                            {catName}
                                        </span>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-1.5 truncate">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {pro.city} ({pro.address})
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {pro.experienceYears} Years Experience
                        </span>
                    </div>

                    <p className="text-sm text-slate-600 font-semibold line-clamp-2 leading-relaxed bg-slate-50/70 p-3 rounded-2xl">
                        {pro.description}
                    </p>

                    {/* Featured Services */}
                    {pro.services?.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{t('directory.featured')}</span>
                            <div className="flex flex-wrap gap-1.5">
                                {pro.services.slice(0, 2).map((svc, idx) => (
                                    <span key={idx} className="text-[11px] font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                        {svc.name} ({svc.price === 0 || svc.price === '0' ? t('directory.free') : '₹' + svc.price})
                                    </span>
                                ))}
                                {pro.services.length > 2 && (
                                    <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">
                                        {t('directory.more', { count: pro.services.length - 2 })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-5 md:p-6 pt-0">
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                        onClick={() => onOpenCatalog(pro)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
                    >
                        {t('directory.viewCatalog')}
                    </button>
                    <a
                        href={`tel:${pro.phone}`}
                        onClick={() => trackAdInteraction({ targetType: 'ProfessionalAd', targetId: pro._id, interactionType: 'call' })}
                        className="p-3 bg-black hover:bg-slate-900 transition-all text-white rounded-xl flex items-center justify-center shadow-sm"
                        title="Call Service Provider"
                    >
                        <Phone className="h-4 w-4" />
                    </a>
                    <a
                        href={getWhatsAppUrl(pro.phone, pro.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackAdInteraction({ targetType: 'ProfessionalAd', targetId: pro._id, interactionType: 'whatsapp' })}
                        className="p-3 bg-emerald-600 hover:bg-emerald-700 transition-all text-white rounded-xl flex items-center justify-center shadow-sm"
                        title="Chat on WhatsApp"
                    >
                        <MessageCircle className="h-4 w-4" />
                    </a>
                </div>
            </div>
        </div>
    );
};

const LocalProfessionalsDirectory = () => {
    const { t } = useTranslation(['customer', 'common']);
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const urlCategoryId = searchParams.get('categoryId') || searchParams.get('category') || '';

    const [isLoading, setIsLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [professionals, setProfessionals] = useState([]);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState(urlCategoryId);
    const [selectedCity, setSelectedCity] = useState('Indore'); // Default to Indore
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [isGeoActive, setIsGeoActive] = useState(false);

    useEffect(() => {
        const idFromUrl = searchParams.get('categoryId') || searchParams.get('category') || '';
        if (idFromUrl) {
            setSelectedCategoryId(idFromUrl);
        }
    }, [searchParams]);

    const { user, isAuthenticated } = useAuth();

    // Selected professional catalog view modal state & dynamic reviews
    const [activeCatalogProfessional, setActiveCatalogProfessional] = useState(null);
    const [activeModalTab, setActiveModalTab] = useState('catalog'); // 'catalog' | 'reviews'
    const [reviewsData, setReviewsData] = useState({
        reviews: [],
        totalCount: 0,
        averageRating: 5.0,
        ratingCount: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    });
    const [canReviewInfo, setCanReviewInfo] = useState({
        canReview: false,
        hasContacted: false,
        existingReview: null,
        reason: '',
        message: ''
    });
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [isWritingReview, setIsWritingReview] = useState(false);
    const [ratingScore, setRatingScore] = useState(5);
    const [ratingHover, setRatingHover] = useState(0);
    const [reviewComment, setReviewComment] = useState('');

    const formatReviewDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 30) return `${diffDays} days ago`;
            return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
    };

    const loadReviewsAndEligibility = async (providerId) => {
        if (!providerId) return;
        setIsLoadingReviews(true);
        try {
            const [revRes, canRes] = await Promise.allSettled([
                customerApi.getProfessionalReviews(providerId),
                customerApi.checkCanReviewProfessional(providerId, { visitorId: getVisitorId() })
            ]);

            if (revRes.status === 'fulfilled' && revRes.value?.data?.success) {
                const res = revRes.value.data.result;
                setReviewsData(res || { reviews: [], totalCount: 0, averageRating: 5.0, ratingCount: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
            }

            if (canRes.status === 'fulfilled' && canRes.value?.data?.success) {
                const canData = canRes.value.data.result;
                setCanReviewInfo(canData || { canReview: false, hasContacted: false, existingReview: null });
                if (canData?.existingReview) {
                    setRatingScore(canData.existingReview.rating || 5);
                    setReviewComment(canData.existingReview.comment || '');
                } else {
                    setRatingScore(5);
                    setReviewComment('');
                }
            }
        } catch (err) {
            console.error('Error loading reviews:', err);
        } finally {
            setIsLoadingReviews(false);
        }
    };

    const handleOpenCatalog = (pro, initialTab = 'catalog') => {
        setActiveCatalogProfessional(pro);
        setActiveModalTab(initialTab);
        setIsWritingReview(false);
        if (pro?._id) {
            trackAdInteraction({ targetType: 'ProfessionalAd', targetId: pro._id, interactionType: 'visit' });
            loadReviewsAndEligibility(pro._id);
        }
    };

    const handleContactClick = (type) => {
        if (!activeCatalogProfessional?._id) return;
        trackAdInteraction({
            targetType: 'ProfessionalAd',
            targetId: activeCatalogProfessional._id,
            interactionType: type
        });
        setTimeout(() => {
            loadReviewsAndEligibility(activeCatalogProfessional._id);
        }, 1200);
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (!ratingScore || ratingScore < 1 || ratingScore > 5) {
            showToast('Please select a rating between 1 and 5 stars', 'error');
            return;
        }
        setIsSubmittingReview(true);
        try {
            const res = await customerApi.submitProfessionalReview(activeCatalogProfessional._id, {
                rating: ratingScore,
                comment: reviewComment,
                visitorId: getVisitorId(),
            });
            showToast('Thank you! Your verified review has been published.', 'success');
            setIsWritingReview(false);
            const resData = res.data?.result;
            if (resData) {
                setProfessionals(prev =>
                    prev.map(p =>
                        p._id === activeCatalogProfessional._id
                            ? { ...p, rating: resData.averageRating, ratingCount: resData.ratingCount }
                            : p
                    )
                );
                setActiveCatalogProfessional(prev =>
                    prev ? { ...prev, rating: resData.averageRating, ratingCount: resData.ratingCount } : null
                );
            }
            loadReviewsAndEligibility(activeCatalogProfessional._id);
        } catch (err) {
            showToast(err.response?.data?.message || 'Unable to submit review. Verified contact is required.', 'error');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleDeleteReview = async (reviewId) => {
        if (!window.confirm('Are you sure you want to remove your review?')) return;
        try {
            const res = await customerApi.deleteProfessionalReview(activeCatalogProfessional._id, reviewId);
            showToast('Your review has been removed', 'info');
            const resData = res.data?.result;
            if (resData) {
                setProfessionals(prev =>
                    prev.map(p =>
                        p._id === activeCatalogProfessional._id
                            ? { ...p, rating: resData.averageRating, ratingCount: resData.ratingCount }
                            : p
                    )
                );
                setActiveCatalogProfessional(prev =>
                    prev ? { ...prev, rating: resData.averageRating, ratingCount: resData.ratingCount } : null
                );
            }
            setIsWritingReview(false);
            setRatingScore(5);
            setReviewComment('');
            loadReviewsAndEligibility(activeCatalogProfessional._id);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to remove review', 'error');
        }
    };
    const [activeVideoPreview, setActiveVideoPreview] = useState(null);
    useLockBodyScroll(Boolean(activeCatalogProfessional || activeVideoPreview));

    const loadData = async () => {
        try {
            setIsLoading(true);
            const catRes = await customerApi.getProfessionalCategories();
            if (catRes.data?.success) {
                setCategories(catRes.data.result || catRes.data.results || []);
            }

            const searchParams = {
                city: selectedCity,
                categoryId: selectedCategoryId || undefined,
                q: searchQuery || undefined,
                lat: lat || undefined,
                lng: lng || undefined
            };

            const adsRes = await customerApi.searchProfessionals(searchParams);
            if (adsRes.data?.success) {
                setProfessionals(adsRes.data.result || adsRes.data.results || []);
            }
        } catch (error) {
            console.error("Failed to load local directory data", error);
            showToast(t('directory.loadFailed'), "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedCategoryId, selectedCity, lat, lng]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadData();
    };

    const handleTriggerGeolocation = () => {
        if (!navigator.geolocation) {
            return showToast(t('addresses.errors.noGeo'), "error");
        }
        setIsGeoActive(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLat(position.coords.latitude.toString());
                setLng(position.coords.longitude.toString());
                showToast(t('directory.locationCaptured'), "success");
            },
            (error) => {
                console.error("Geolocation failed", error);
                setIsGeoActive(false);
                showToast(t('directory.locationFailed'), "error");
            }
        );
    };

    const handleClearLocation = () => {
        setLat('');
        setLng('');
        setIsGeoActive(false);
    };

    const handleBack = () => {
        if (window.history.length > 1 && window.history.state?.idx > 0) {
            navigate(-1);
        } else {
            navigate('/', { replace: true });
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-700 pb-20">
            {/* Top Navigation Bar with Back Button */}
            <div className="flex items-center justify-between gap-3 mb-6">
                <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl text-xs font-black uppercase tracking-wider transition border border-slate-200/80 shadow-sm active:scale-95 group"
                    title={t('actions.back', { defaultValue: 'Back' })}
                    aria-label="Back"
                >
                    <ChevronLeft size={20} className="text-slate-800 transition-transform group-hover:-translate-x-0.5" />
                    <span>{t('actions.back', { defaultValue: 'Back' })}</span>
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/professionals/panel')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-sm active:scale-95"
                >
                    <Briefcase size={14} />
                    <span>Provider Panel</span>
                </button>
            </div>

            {/* Page Header */}
            <div className="text-center space-y-4 mb-10">
                <h1 className="text-3xl md:text-4xl font-black text-slate-950 tracking-tight flex items-center justify-center gap-3">
                    {t('directory.title')}
                    <div className="p-2 bg-brand-50 rounded-xl">
                        <Briefcase className="h-6 w-6 text-brand-600" />
                    </div>
                </h1>
                <p className="text-sm font-bold text-slate-400 max-w-md mx-auto leading-relaxed">
                    {t('directory.subtitle')}
                </p>
                <div className="pt-3 max-w-xl mx-auto">
                    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-md border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                                <Briefcase size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 justify-center sm:justify-start">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Offer Services Near You</span>
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded-full border border-emerald-500/30 uppercase">100% Free</span>
                                </div>
                                <p className="text-xs text-slate-300 font-medium mt-0.5">Electricians, Plumbers, Doctors, Tailors — Register your profile</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/professionals/panel')}
                            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-95 whitespace-nowrap shrink-0"
                        >
                            Register Free →
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Filters Bar */}
            <div className="bg-white p-6 rounded-[36px] border border-slate-100 shadow-sm space-y-4 mb-8">
                <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-4">
                    {/* Keyword search input */}
                    <div className="relative flex-1 group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('directory.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-[20px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        {/* City filter input */}
                        <div className="relative w-full sm:w-44">
                            <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder={t('addresses.city')}
                                value={selectedCity}
                                onChange={(e) => setSelectedCity(e.target.value)}
                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-[20px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                            />
                        </div>

                        {/* Geolocation near trigger */}
                        {isGeoActive ? (
                            <button
                                type="button"
                                onClick={handleClearLocation}
                                className="w-full sm:w-auto px-6 py-4 bg-emerald-50 text-emerald-600 rounded-[20px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all"
                            >
                                <Compass className="h-4 w-4 animate-pulse" /> {t('directory.nearMe')}
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleTriggerGeolocation}
                                className="w-full sm:w-auto px-6 py-4 bg-slate-50 text-slate-600 rounded-[20px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"
                            >
                                <Compass className="h-4 w-4" /> {t('directory.nearMe')}
                            </button>
                        )}

                        <button
                            type="submit"
                            className="w-full sm:w-auto px-8 py-4 bg-black text-white rounded-[20px] text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md"
                        >
                            {t('directory.find')}
                        </button>
                    </div>
                </form>

                {/* Categories Pills Carousel */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-t border-slate-50 pt-4">
                    <button
                        onClick={() => setSelectedCategoryId('')}
                        className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${!selectedCategoryId ? 'bg-black text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        {t('directory.allCategories')}
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat._id}
                            onClick={() => setSelectedCategoryId(cat._id)}
                            className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${selectedCategoryId === cat._id ? 'bg-black text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            {cat.icon && (
                                cat.icon.startsWith('http') ? (
                                    <img src={cat.icon} alt="" className="h-4.5 w-4.5 rounded-md object-cover inline-block align-middle" />
                                ) : (
                                    <span>{cat.icon}</span>
                                )
                            )}
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Grid */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="h-12 w-12 text-brand-500 animate-spin" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{t('directory.searching')}</p>
                </div>
            ) : professionals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-slate-100">
                    <Briefcase className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-black text-slate-900">{t('directory.emptyTitle')}</h3>
                    <p className="text-sm font-bold text-slate-400 mt-2 max-w-xs text-center">
                        {t('directory.emptyMessage')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {professionals.map((pro) => (
                        <ProfessionalCard
                            key={pro._id}
                            pro={pro}
                            onOpenCatalog={handleOpenCatalog}
                            t={t}
                            getWhatsAppUrl={getWhatsAppUrl}
                            categories={categories}
                        />
                    ))}
                </div>
            )}

            {/* VIDEO PREVIEW MODAL */}
            {activeVideoPreview && (
                <div
                    className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setActiveVideoPreview(null)}
                >
                    <button
                        onClick={() => setActiveVideoPreview(null)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <div className="max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl bg-black" onClick={(e) => e.stopPropagation()}>
                        <video src={activeVideoPreview} controls autoPlay className="w-full aspect-video object-contain" />
                    </div>
                </div>
            )}

            {/* SERVICE CATALOG & VERIFIED REVIEWS MODAL */}
            {activeCatalogProfessional && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in overscroll-contain"
                    onWheel={preventBackdropScroll}
                    onTouchMove={preventBackdropScroll}
                    onClick={() => setActiveCatalogProfessional(null)}
                >
                    <div
                        className="bg-white rounded-[36px] sm:rounded-[45px] p-6 sm:p-8 max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl space-y-5 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Provider Info & Overall Rating */}
                        <div className="flex justify-between items-start gap-3 shrink-0">
                            <div className="flex items-start gap-3 min-w-0">
                                {activeCatalogProfessional.mediaUrl ? (
                                    <img
                                        src={activeCatalogProfessional.mediaUrl}
                                        alt={activeCatalogProfessional.name}
                                        className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-sm"
                                    />
                                ) : (
                                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0 text-brand-600 font-black text-xl">
                                        {activeCatalogProfessional.name?.charAt(0)?.toUpperCase() || 'P'}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-lg sm:text-xl font-black text-slate-950 truncate">{activeCatalogProfessional.name}</h2>
                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200/60 rounded-lg text-amber-700 text-xs font-black shrink-0">
                                            <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                                            <span>
                                                {reviewsData.ratingCount > 0 || activeCatalogProfessional.ratingCount > 0
                                                    ? Number(reviewsData.averageRating || activeCatalogProfessional.rating || 5.0).toFixed(1)
                                                    : '5.0 (New)'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                        <span className="text-xs font-black text-brand-600 uppercase tracking-wider">{activeCatalogProfessional.profession}</span>
                                        {(() => {
                                            const catsList = (Array.isArray(activeCatalogProfessional.categories) && activeCatalogProfessional.categories.length > 0)
                                                ? activeCatalogProfessional.categories
                                                : (activeCatalogProfessional.category ? [activeCatalogProfessional.category] : []);
                                            const names = catsList
                                                .map(c => {
                                                    if (!c) return null;
                                                    if (typeof c === 'object' && c.name) return c.name;
                                                    const id = typeof c === 'string' ? c : (c._id || c.id);
                                                    const found = categories?.find(cat => String(cat._id || cat.id) === String(id));
                                                    if (found?.name) return found.name;
                                                    if (typeof c === 'string' && /^[0-9a-fA-F]{24}$/.test(c)) return null;
                                                    return typeof c === 'string' ? c : null;
                                                })
                                                .filter(Boolean);
                                            return names.map((catName, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                                    {catName}
                                                </span>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveCatalogProfessional(null)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* TAB SELECTOR: SERVICES vs REVIEWS */}
                        <div className="flex border-b border-slate-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveModalTab('catalog')}
                                className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 text-center ${
                                    activeModalTab === 'catalog'
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                {t('directory.catalog', 'Services')} ({activeCatalogProfessional.services?.length || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveModalTab('reviews')}
                                className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                                    activeModalTab === 'reviews'
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                                Verified Reviews ({reviewsData.totalCount ?? (activeCatalogProfessional.ratingCount || 0)})
                            </button>
                        </div>

                        {/* TAB 1: CATALOG SERVICES */}
                        {activeModalTab === 'catalog' && (
                            <div
                                data-lenis-prevent
                                data-lenis-prevent-wheel
                                className="flex-1 space-y-3 overflow-y-auto overscroll-contain touch-pan-y pr-1 min-h-[220px]"
                            >
                                {activeCatalogProfessional.services?.length > 0 ? (
                                    activeCatalogProfessional.services.map((svc, i) => {
                                        const servicePhotos = Array.isArray(svc.images) && svc.images.length > 0
                                            ? svc.images
                                            : (svc.image ? [svc.image] : []);
                                        return (
                                            <div key={i} className="p-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                                <div className="flex items-start sm:items-center gap-3 min-w-0">
                                                    {servicePhotos.length > 0 ? (
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {servicePhotos.map((pUrl, pIdx) => (
                                                                <img
                                                                    key={pIdx}
                                                                    src={pUrl}
                                                                    alt={`${svc.name} ${pIdx + 1}`}
                                                                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover border border-slate-200 shadow-sm"
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                                            <ImageIcon className="h-5 w-5" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-black text-slate-900 truncate">{svc.name}</h4>
                                                        {svc.description && <p className="text-xs text-slate-500 font-bold mt-0.5 line-clamp-2">{svc.description}</p>}
                                                    </div>
                                                </div>
                                                <span className="text-sm font-black text-emerald-600 shrink-0 self-end sm:self-auto">{svc.price === 0 || svc.price === '0' ? 'FREE' : '₹' + svc.price}</span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-xs text-slate-400 italic font-bold py-12 text-center">{t('directory.noCatalog', 'No service items listed yet.')}</p>
                                )}
                            </div>
                        )}

                        {/* TAB 2: VERIFIED REVIEWS & RATINGS */}
                        {activeModalTab === 'reviews' && (
                            <div
                                data-lenis-prevent
                                data-lenis-prevent-wheel
                                className="flex-1 space-y-4 overflow-y-auto overscroll-contain touch-pan-y pr-1 min-h-[220px]"
                            >
                                {/* Overall Rating Summary Card */}
                                <div className="p-4 bg-gradient-to-br from-amber-50/60 to-orange-50/30 rounded-2xl border border-amber-100 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                    <div className="text-center sm:text-left shrink-0">
                                        <div className="flex items-baseline justify-center sm:justify-start gap-1">
                                            <span className="text-3xl sm:text-4xl font-black text-slate-900">
                                                {reviewsData.ratingCount > 0 ? reviewsData.averageRating.toFixed(1) : '5.0'}
                                            </span>
                                            <span className="text-sm font-bold text-slate-400">/ 5</span>
                                        </div>
                                        <div className="flex items-center justify-center sm:justify-start gap-1 mt-1 text-amber-400">
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <Star
                                                    key={s}
                                                    className={`h-4 w-4 ${
                                                        s <= Math.round(reviewsData.averageRating || 5)
                                                            ? 'fill-amber-400 text-amber-500'
                                                            : 'text-slate-200'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-500 block mt-1">
                                            {reviewsData.totalCount > 0 ? `${reviewsData.totalCount} Verified Reviews` : 'New Provider (No Reviews Yet)'}
                                        </span>
                                    </div>

                                    {/* Star Breakdown Bars */}
                                    <div className="flex-1 w-full space-y-1 text-xs">
                                        {[5, 4, 3, 2, 1].map((star) => {
                                            const count = reviewsData.breakdown?.[star] || 0;
                                            const pct = reviewsData.totalCount > 0 ? Math.round((count / reviewsData.totalCount) * 100) : 0;
                                            return (
                                                <div key={star} className="flex items-center gap-2 text-slate-600 font-semibold">
                                                    <span className="w-5 text-[11px] text-right font-black">{star}★</span>
                                                    <div className="flex-1 h-2 bg-white rounded-full overflow-hidden border border-slate-200/60">
                                                        <div
                                                            className="h-full bg-amber-400 rounded-full transition-all"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-8 text-[10px] text-slate-400 text-right">{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Review Eligibility / Submission Area (Verified Contact Model) */}
                                {!isAuthenticated ? (
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-slate-900">Sign in to rate this provider</p>
                                            <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                                                Only verified customers who contacted this provider via Call or WhatsApp can share reviews.
                                            </p>
                                        </div>
                                        <Link
                                            to="/login"
                                            className="px-4 py-2 bg-black hover:bg-slate-800 text-white text-xs font-black rounded-xl uppercase tracking-wider shrink-0 transition"
                                        >
                                            Sign In
                                        </Link>
                                    </div>
                                ) : !canReviewInfo.hasContacted ? (
                                    <div className="p-4 bg-amber-50/70 border border-amber-200/70 rounded-2xl space-y-2.5">
                                        <div className="flex items-start gap-2.5">
                                            <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-black text-amber-950">Verified Reviews Only</p>
                                                <p className="text-[11px] text-amber-800 font-bold mt-0.5 leading-relaxed">
                                                   Please Contact via Call and Whatapp for review and rating.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pt-1">
                                            <a
                                                href={`tel:${activeCatalogProfessional.phone}`}
                                                onClick={() => handleContactClick('call')}
                                                className="px-3.5 py-1.5 bg-black hover:bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition"
                                            >
                                                <Phone className="h-3 w-3" /> Call Provider
                                            </a>
                                            <a
                                                href={getWhatsAppUrl(activeCatalogProfessional.phone, activeCatalogProfessional.name)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => handleContactClick('whatsapp')}
                                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition"
                                            >
                                                <MessageCircle className="h-3 w-3" /> WhatsApp
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    /* Verified Customer Review Action - Directly Available */
                                    <div className="space-y-3">
                                        {canReviewInfo.existingReview && !isWritingReview ? (
                                            /* If review already submitted, show summary with Edit & Delete options */
                                            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                                        <div className="min-w-0">
                                                            <span className="text-xs font-black text-slate-900 block truncate">
                                                                Your Verified Review
                                                            </span>
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                <div className="flex items-center text-amber-400">
                                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                                        <Star
                                                                            key={s}
                                                                            className={`h-3 w-3 ${
                                                                                s <= canReviewInfo.existingReview.rating
                                                                                    ? 'fill-amber-400 text-amber-500'
                                                                                    : 'text-slate-200'
                                                                            }`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-500">
                                                                    ({canReviewInfo.existingReview.rating}.0)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsWritingReview(true)}
                                                            className="px-3.5 py-1.5 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                                                        >
                                                            <Edit3 className="h-3 w-3" /> Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteReview(canReviewInfo.existingReview._id)}
                                                            className="p-1.5 text-rose-500 hover:text-rose-700 transition"
                                                            title="Delete Review"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {canReviewInfo.existingReview.comment && (
                                                    <p className="text-xs text-slate-700 font-semibold bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                                        "{canReviewInfo.existingReview.comment}"
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            /* Review Submission Form (Always Visible for Verified Customers) */
                                            <form onSubmit={handleSubmitReview} className="p-4 sm:p-5 bg-gradient-to-br from-amber-50/40 via-white to-slate-50 rounded-2xl border-2 border-amber-200 shadow-sm space-y-3.5 animate-in fade-in">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-black text-slate-900 block">
                                                                {canReviewInfo.existingReview ? 'Update Your Rating' : `Rate ${activeCatalogProfessional.name || 'Provider'}`}
                                                            </span>
                                                            <span className="text-[10px] text-emerald-700 font-bold block">
                                                                ✓ Verified Contact Customer
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 shrink-0">
                                                        {(ratingHover || ratingScore) === 5 && '★★★★★ Excellent'}
                                                        {(ratingHover || ratingScore) === 4 && '★★★★☆ Very Good'}
                                                        {(ratingHover || ratingScore) === 3 && '★★★☆☆ Average'}
                                                        {(ratingHover || ratingScore) === 2 && '★★☆☆☆ Poor'}
                                                        {(ratingHover || ratingScore) === 1 && '★☆☆☆☆ Terrible'}
                                                    </span>
                                                </div>

                                                {/* 5 Big Gold Clickable Stars */}
                                                <div className="flex items-center gap-2 py-1.5 bg-white p-2 rounded-xl border border-slate-200/90 justify-center shadow-xs">
                                                    {[1, 2, 3, 4, 5].map((s) => {
                                                        const active = s <= (ratingHover || ratingScore);
                                                        return (
                                                            <button
                                                                key={s}
                                                                type="button"
                                                                onMouseEnter={() => setRatingHover(s)}
                                                                onMouseLeave={() => setRatingHover(0)}
                                                                onClick={() => setRatingScore(s)}
                                                                className="p-1.5 hover:scale-125 transition-transform cursor-pointer"
                                                                title={`${s} Star${s > 1 ? 's' : ''}`}
                                                            >
                                                                <Star
                                                                    className={`h-7 w-7 ${
                                                                        active
                                                                            ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                                                                            : 'text-slate-200 hover:text-amber-200'
                                                                    }`}
                                                                />
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Feedback comment */}
                                                <textarea
                                                    rows={3}
                                                    value={reviewComment}
                                                    onChange={(e) => setReviewComment(e.target.value)}
                                                    placeholder="Share your experience (quality of work, punctuality, pricing, communication)..."
                                                    maxLength={600}
                                                    className="w-full text-xs font-bold p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 placeholder:text-slate-400"
                                                />

                                                {/* Submit & Cancel Actions */}
                                                <div className="flex items-center justify-between gap-2 pt-1">
                                                    <div>
                                                        {canReviewInfo.existingReview && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsWritingReview(false)}
                                                                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="submit"
                                                        disabled={isSubmittingReview}
                                                        className="px-5 py-2.5 bg-black hover:bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-sm hover:shadow disabled:opacity-50 cursor-pointer ml-auto"
                                                    >
                                                        {isSubmittingReview ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                                                        ) : (
                                                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                                        )}
                                                        {canReviewInfo.existingReview ? 'Update Review' : 'Submit Verified Review'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}

                                {/* Customer Reviews Feed */}
                                <div className="space-y-3 pt-1">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                                        Customer Feedback ({reviewsData.totalCount || 0})
                                    </h4>

                                    {isLoadingReviews ? (
                                        <div className="py-8 flex justify-center text-slate-400">
                                            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                                        </div>
                                    ) : reviewsData.reviews?.length > 0 ? (
                                        reviewsData.reviews.map((rev) => {
                                            const isMyReview = user?.id && rev.userId && String(rev.userId) === String(user.id);
                                            return (
                                                <div
                                                    key={rev._id}
                                                    className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100/90 space-y-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="h-7 w-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                                                                {rev.userName?.charAt(0)?.toUpperCase() || 'C'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-black text-slate-900 truncate">
                                                                        {rev.userName || 'Customer'}
                                                                    </span>
                                                                    {isMyReview && (
                                                                        <span className="text-[9px] font-black bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                                                                            You
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 font-bold block">
                                                                    {formatReviewDate(rev.createdAt)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Stars & Verified Badge */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/50">
                                                                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                                                                Verified Contact
                                                            </span>
                                                            <div className="flex items-center gap-0.5 text-amber-400">
                                                                {[1, 2, 3, 4, 5].map((s) => (
                                                                    <Star
                                                                        key={s}
                                                                        className={`h-3 w-3 ${
                                                                            s <= rev.rating
                                                                                ? 'fill-amber-400 text-amber-500'
                                                                                : 'text-slate-200'
                                                                        }`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {rev.comment && (
                                                        <p className="text-xs text-slate-700 font-semibold leading-relaxed pl-9">
                                                            {rev.comment}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 text-center text-slate-400 space-y-1">
                                            <p className="text-xs font-bold">No customer reviews yet.</p>
                                            <p className="text-[11px] text-slate-400">Be the first verified customer to connect and leave feedback!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Modal Footer Actions: Call & WhatsApp */}
                        <div className="flex gap-3 border-t border-slate-100 pt-4 shrink-0">
                            <a
                                href={`tel:${activeCatalogProfessional.phone}`}
                                onClick={() => handleContactClick('call')}
                                className="flex-1 py-3.5 bg-black hover:bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Phone className="h-4 w-4" /> Call Provider
                            </a>
                            <a
                                href={getWhatsAppUrl(activeCatalogProfessional.phone, activeCatalogProfessional.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleContactClick('whatsapp')}
                                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-sm"
                            >
                                <MessageCircle className="h-4 w-4" /> WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocalProfessionalsDirectory;
