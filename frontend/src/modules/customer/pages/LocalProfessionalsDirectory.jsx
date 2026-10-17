import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import {
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
    X,
    Grid,
    List,
    DollarSign,
    Loader2
} from 'lucide-react';
import { useLockBodyScroll, preventBackdropScroll } from '@shared/hooks/useLockBodyScroll';

const getWhatsAppUrl = (phone, name) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(`Hello ${name || 'Sir'}, I found your profile on SevaFast and would like to inquire about your services.`);
    return `https://wa.me/${fullPhone}?text=${text}`;
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

    // Selected professional catalog view modal state
    const [activeCatalogProfessional, setActiveCatalogProfessional] = useState(null);
    useLockBodyScroll(Boolean(activeCatalogProfessional));

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
                        <div key={pro._id} className="bg-white p-6 rounded-[32px] border border-slate-100 hover:shadow-lg transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-950 leading-tight">{pro.name}</h3>
                                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                            <span className="text-xs font-black text-brand-600 uppercase tracking-wider">{pro.profession}</span>
                                            {pro.categories && pro.categories.length > 0 ? (
                                                pro.categories.map((c) => (
                                                    <span key={c._id} className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                                        {c.name}
                                                    </span>
                                                ))
                                            ) : pro.category?.name ? (
                                                <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                                    {pro.category.name}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2.5 py-1 rounded-xl">
                                        <Star className="h-3.5 w-3.5 fill-amber-500" />
                                        <span className="text-xs font-black">4.9</span>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-2 text-xs font-bold text-slate-500">
                                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {pro.city} ({pro.address})</span>
                                    <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {pro.experienceYears} Years Experience</span>
                                </div>

                                <p className="text-sm text-slate-600 font-semibold mt-4 line-clamp-3 leading-relaxed bg-slate-50/50 p-3 rounded-2xl">
                                    {pro.description}
                                </p>
                            </div>

                            <div className="mt-6 border-t border-slate-50 pt-4 space-y-3">
                                {pro.services?.length > 0 && (
                                    <div className="space-y-1">
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

                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        onClick={() => setActiveCatalogProfessional(pro)}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
                                    >
                                        {t('directory.viewCatalog')}
                                    </button>
                                    <a
                                        href={`tel:${pro.phone}`}
                                        className="p-3 bg-black hover:bg-slate-900 transition-all text-white rounded-xl flex items-center justify-center shadow-sm"
                                        title="Call Service Provider"
                                    >
                                        <Phone className="h-4 w-4" />
                                    </a>
                                    <a
                                        href={getWhatsAppUrl(pro.phone, pro.name)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-3 bg-emerald-600 hover:bg-emerald-700 transition-all text-white rounded-xl flex items-center justify-center shadow-sm"
                                        title="Chat on WhatsApp"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SERVICE CATALOG LIST MODAL */}
            {activeCatalogProfessional && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in overscroll-contain"
                    onWheel={preventBackdropScroll}
                    onTouchMove={preventBackdropScroll}
                    onClick={() => setActiveCatalogProfessional(null)}
                >
                    <div
                        className="bg-white rounded-[45px] p-8 max-w-lg w-full shadow-2xl space-y-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-black text-slate-950">{activeCatalogProfessional.name}</h2>
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    <span className="text-xs font-black text-brand-600 uppercase tracking-wider">{activeCatalogProfessional.profession}</span>
                                    {activeCatalogProfessional.categories && activeCatalogProfessional.categories.length > 0 ? (
                                        activeCatalogProfessional.categories.map((c) => (
                                            <span key={c._id} className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                                {c.name}
                                            </span>
                                        ))
                                    ) : activeCatalogProfessional.category?.name ? (
                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                            {activeCatalogProfessional.category.name}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                            <button onClick={() => setActiveCatalogProfessional(null)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div
                            data-lenis-prevent
                            data-lenis-prevent-wheel
                            className="space-y-4 max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y pr-2"
                        >
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{t('directory.catalog')}</h3>
                            {activeCatalogProfessional.services?.length > 0 ? (
                                activeCatalogProfessional.services.map((svc, i) => (
                                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900">{svc.name}</h4>
                                            {svc.description && <p className="text-xs text-slate-500 font-bold mt-1">{svc.description}</p>}
                                        </div>
                                        <span className="text-sm font-black text-emerald-600">{svc.price === 0 || svc.price === '0' ? 'FREE' : '₹' + svc.price}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-400 italic font-bold py-6 text-center">{t('directory.noCatalog')}</p>
                            )}
                        </div>

                        <div className="flex gap-3 border-t border-slate-100 pt-5">
                            <a
                                href={`tel:${activeCatalogProfessional.phone}`}
                                className="flex-1 py-3.5 bg-black hover:bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2"
                            >
                                <Phone className="h-4 w-4" /> Call Provider
                            </a>
                            <a
                                href={getWhatsAppUrl(activeCatalogProfessional.phone, activeCatalogProfessional.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2"
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
