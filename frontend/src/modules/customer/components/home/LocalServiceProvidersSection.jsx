import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { customerApi } from '../../services/customerApi';
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Star,
    Sparkles,
    Phone,
    MessageCircle,
    MapPin,
    Calendar,
    CheckCircle2
} from 'lucide-react';
import { trackAdInteraction } from '../../../../core/utils/analyticsTracker';

const FALLBACK_CATEGORY_IMAGES = {
    'transport': 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80',
    'travel': 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80',
    'event': 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&auto=format&fit=crop&q=80',
    'packers': 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&auto=format&fit=crop&q=80',
    'movers': 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&auto=format&fit=crop&q=80',
    'tutor': 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&auto=format&fit=crop&q=80',
    'catering': 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&auto=format&fit=crop&q=80',
    'salon': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&auto=format&fit=crop&q=80',
    'beauty': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&auto=format&fit=crop&q=80',
    'fitness': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&auto=format&fit=crop&q=80',
    'yoga': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&auto=format&fit=crop&q=80',
    'security': 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=400&auto=format&fit=crop&q=80',
    'car': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&auto=format&fit=crop&q=80',
    'plumb': 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=400&auto=format&fit=crop&q=80',
    'electr': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&auto=format&fit=crop&q=80',
    'clean': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&auto=format&fit=crop&q=80',
    'repair': 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=400&auto=format&fit=crop&q=80',
};

const getCategoryFallbackImage = (name = '') => {
    const lower = name.toLowerCase();
    for (const [key, url] of Object.entries(FALLBACK_CATEGORY_IMAGES)) {
        if (lower.includes(key)) return url;
    }
    return 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=400&auto=format&fit=crop&q=80';
};

const getWhatsAppUrl = (phone, name) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(`Hello ${name || 'Sir'}, I found your profile on SevaFast and would like to inquire about your services.`);
    return `https://wa.me/${fullPhone}?text=${text}`;
};

const LocalServiceProvidersSection = () => {
    const { t } = useTranslation('customer');
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [featuredPros, setFeaturedPros] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const categoriesScrollRef = useRef(null);
    const prosScrollRef = useRef(null);

    const scrollTrack = (ref, direction) => {
        if (ref.current) {
            const amount = direction === 'left' ? -280 : 280;
            ref.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const [catRes, prosRes] = await Promise.allSettled([
                    customerApi.getProfessionalCategories(),
                    customerApi.searchProfessionals({ limit: 8 })
                ]);

                if (isMounted) {
                    if (catRes.status === 'fulfilled' && catRes.value?.data?.success) {
                        const items = catRes.value.data.result || catRes.value.data.results || [];
                        setCategories(items.filter(c => c.isActive !== false));
                    }
                    if (prosRes.status === 'fulfilled' && prosRes.value?.data?.success) {
                        const pros = prosRes.value.data.result || prosRes.value.data.results || [];
                        setFeaturedPros(pros);
                    }
                }
            } catch (err) {
                console.error("Failed to load local services data for home section", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, []);

    if (!isLoading && categories.length === 0 && featuredPros.length === 0) {
        return null;
    }

    return (
        <section
            className="w-full my-3 sm:my-4 animate-in fade-in duration-300"
            aria-roledescription="carousel"
            aria-label="Local Services & Experts"
        >
            {/* Header: Title + Subtitle + View All CTA */}
            <div className="flex items-center justify-between mb-2.5 sm:mb-3.5 px-0.5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#FF5A00] animate-pulse"></span>
                        <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-900 uppercase tracking-wide">
                            {t('home.localServices.title', { defaultValue: 'Local Services & Experts' })}
                        </h2>
                    </div>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
                        {t('home.localServices.sub', { defaultValue: 'Search, compare & hire trusted local professionals' })}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/professionals')}
                    className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-black text-[#FF5A00] hover:text-[#E04F00] transition-colors shrink-0 group cursor-pointer"
                >
                    <span>{t('common.seeAll', { defaultValue: 'See All' })}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>

            {/* 1. HORIZONTAL SERVICE CATEGORIES SLIDER (Left-to-Right Swipe on Mobile) */}
            <div className="relative group/cats">
                {/* Desktop Left Button */}
                <button
                    type="button"
                    aria-label="Scroll categories left"
                    onClick={() => scrollTrack(categoriesScrollRef, 'left')}
                    className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white/95 border border-slate-200 shadow-md items-center justify-center text-slate-700 hover:text-black hover:bg-white hover:scale-105 active:scale-95 transition-all opacity-0 group-hover/cats:opacity-100 cursor-pointer"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Horizontal Scroll Track */}
                <div
                    ref={categoriesScrollRef}
                    role="region"
                    aria-label="Service categories slider"
                    className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth snap-x touch-pan-x py-1 px-0.5"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {categories.map((cat) => {
                        const imgSrc = (cat.icon && cat.icon.startsWith('http'))
                            ? cat.icon
                            : getCategoryFallbackImage(cat.name);

                        return (
                            <button
                                key={cat._id}
                                type="button"
                                onClick={() => navigate(`/professionals?categoryId=${cat._id}`)}
                                className="snap-start shrink-0 w-[92px] sm:w-[108px] md:w-[116px] bg-white rounded-2xl border border-slate-100 hover:border-orange-300 p-2 sm:p-2.5 flex flex-col items-center justify-between text-center hover:shadow-sm active:scale-95 transition-all cursor-pointer group select-none"
                            >
                                <div className="w-full h-14 sm:h-16 md:h-16 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center mb-1.5 border border-slate-100/80">
                                    <img
                                        src={imgSrc}
                                        alt={cat.name}
                                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = getCategoryFallbackImage(cat.name);
                                        }}
                                    />
                                </div>
                                <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-[#FF5A00] transition-colors w-full">
                                    {cat.name}
                                </span>
                            </button>
                        );
                    })}

                    {/* View All Categories Slide at the end */}
                    <button
                        type="button"
                        onClick={() => navigate('/professionals')}
                        className="snap-start shrink-0 w-[92px] sm:w-[108px] md:w-[116px] bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200/80 p-2 sm:p-2.5 flex flex-col items-center justify-center text-center hover:shadow-sm active:scale-95 transition-all cursor-pointer group select-none min-h-[96px] sm:min-h-[110px]"
                    >
                        <div className="w-9 h-9 rounded-full bg-white shadow-xs border border-orange-200 flex items-center justify-center mb-1.5 group-hover:bg-[#FF5A00] group-hover:text-white group-hover:border-[#FF5A00] transition-all text-[#FF5A00]">
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-black text-amber-950 group-hover:text-[#FF5A00] transition-colors">
                            {t('home.localServices.viewMore', { defaultValue: 'View All' })}
                        </span>
                    </button>
                </div>

                {/* Desktop Right Button */}
                <button
                    type="button"
                    aria-label="Scroll categories right"
                    onClick={() => scrollTrack(categoriesScrollRef, 'right')}
                    className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white/95 border border-slate-200 shadow-md items-center justify-center text-slate-700 hover:text-black hover:bg-white hover:scale-105 active:scale-95 transition-all opacity-0 group-hover/cats:opacity-100 cursor-pointer"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* 2. TOP FEATURED CARDS SLIDER (Horizontal Left-to-Right Swipe) */}
            {featuredPros.length > 0 && (
                <div className="mt-3.5 sm:mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2 px-0.5">
                        <div className="flex items-center gap-1.5">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                                {t('home.localServices.featuredPros', { defaultValue: 'Top Rated Experts' })}
                            </h3>
                            <span className="text-[10px] font-bold text-slate-400">
                                ({featuredPros.length})
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 hidden sm:inline">
                            Swipe to explore →
                        </span>
                    </div>

                    <div className="relative group/pros">
                        {/* Desktop Left Button */}
                        <button
                            type="button"
                            aria-label="Scroll featured professionals left"
                            onClick={() => scrollTrack(prosScrollRef, 'left')}
                            className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white/95 border border-slate-200 shadow-md items-center justify-center text-slate-700 hover:text-black hover:bg-white hover:scale-105 active:scale-95 transition-all opacity-0 group-hover/pros:opacity-100 cursor-pointer"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        {/* Horizontal Cards Scroll Track */}
                        <div
                            ref={prosScrollRef}
                            role="region"
                            aria-label="Top rated professionals slider"
                            className="flex items-stretch gap-3 sm:gap-3.5 overflow-x-auto no-scrollbar scroll-smooth snap-x touch-pan-x py-1.5 px-0.5"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            {featuredPros.map((pro) => {
                                const photo = pro.mediaUrl || (Array.isArray(pro.portfolioImages) && pro.portfolioImages[0]) || '';
                                return (
                                    <div
                                        key={pro._id}
                                        className="snap-start shrink-0 w-[240px] sm:w-[265px] md:w-[280px] bg-white rounded-2xl border border-slate-100 hover:border-amber-200 p-3 sm:p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all select-none group/card"
                                    >
                                        <div>
                                            {/* Top info: Avatar + Name + Rating */}
                                            <div className="flex items-start gap-2.5">
                                                {photo ? (
                                                    <img
                                                        src={photo}
                                                        alt={pro.name}
                                                        className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl object-cover border border-slate-100 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-orange-50 border border-orange-100 text-[#FF5A00] font-black text-base flex items-center justify-center shrink-0">
                                                        {pro.name?.charAt(0)?.toUpperCase() || 'P'}
                                                    </div>
                                                )}

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1">
                                                        <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate leading-tight">
                                                            {pro.name}
                                                        </h4>
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-[#FF5A00] block truncate uppercase tracking-wider mt-0.5">
                                                        {pro.profession}
                                                    </span>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[10px] font-black border border-amber-200/50">
                                                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500" />
                                                            <span>
                                                                {pro.ratingCount > 0 ? Number(pro.rating || 5.0).toFixed(1) : '5.0'}
                                                            </span>
                                                        </div>
                                                        {pro.ratingCount > 0 && (
                                                            <span className="text-[9px] text-slate-400 font-bold">
                                                                ({pro.ratingCount})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Location & Experience */}
                                            <div className="flex items-center gap-2 text-[10.5px] font-bold text-slate-500 mt-2.5 pt-2 border-t border-slate-50">
                                                <span className="flex items-center gap-1 truncate">
                                                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                                    {pro.city || 'Indore'}
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span className="truncate">
                                                    {pro.experienceYears || 1}+ Yrs Exp
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-50">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/professionals?category=${pro.category?._id || ''}`)}
                                                className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all text-center cursor-pointer"
                                            >
                                                View
                                            </button>
                                            <a
                                                href={`tel:${pro.phone}`}
                                                onClick={() => trackAdInteraction({ targetType: 'ProfessionalAd', targetId: pro._id, interactionType: 'call' })}
                                                className="p-2 bg-black hover:bg-slate-900 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                                title="Call Provider"
                                            >
                                                <Phone className="h-3.5 w-3.5" />
                                            </a>
                                            <a
                                                href={getWhatsAppUrl(pro.phone, pro.name)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => trackAdInteraction({ targetType: 'ProfessionalAd', targetId: pro._id, interactionType: 'whatsapp' })}
                                                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                                title="WhatsApp Provider"
                                            >
                                                <MessageCircle className="h-3.5 w-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Right Button */}
                        <button
                            type="button"
                            aria-label="Scroll featured professionals right"
                            onClick={() => scrollTrack(prosScrollRef, 'right')}
                            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white/95 border border-slate-200 shadow-md items-center justify-center text-slate-700 hover:text-black hover:bg-white hover:scale-105 active:scale-95 transition-all opacity-0 group-hover/pros:opacity-100 cursor-pointer"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default LocalServiceProvidersSection;
