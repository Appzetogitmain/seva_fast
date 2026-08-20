import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerApi } from '../../services/customerApi';
import { ArrowRight } from 'lucide-react';

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

const LocalServiceProvidersSection = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchCategories = async () => {
            try {
                const res = await customerApi.getProfessionalCategories();
                if (res.data?.success && isMounted) {
                    const items = res.data.result || res.data.results || [];
                    const activeItems = items.filter(c => c.isActive !== false);
                    setCategories(activeItems);
                }
            } catch (err) {
                console.error("Failed to load professional categories for home section", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchCategories();
        return () => { isMounted = false; };
    }, []);

    // Take top 9 categories to leave the 10th slot for "View More" (in 2 rows x 5 columns layout)
    const displayedCategories = categories.slice(0, 9);

    if (!isLoading && categories.length === 0) {
        return null;
    }

    return (
        <section className="w-full my-2 sm:my-3 animate-in fade-in duration-300">
            {/* Section Header */}
            <div className="flex items-center justify-center gap-3 mb-2.5 sm:mb-3">
                <span className="h-[2px] w-8 sm:w-12 bg-amber-600 rounded-full"></span>
                <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-900 uppercase tracking-wide text-center">
                    Local Service Providers
                </h2>
                <span className="h-[2px] w-8 sm:w-12 bg-amber-600 rounded-full"></span>
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch">
                {/* Left Promo Card */}
                <div className="w-full lg:w-[260px] xl:w-[290px] shrink-0 bg-[#FFF7ED] border border-[#FDE6D2] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs relative overflow-hidden group">
                    <div className="relative z-10">
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug tracking-tight">
                            Find Trusted Local Service Providers
                        </h3>
                        <p className="text-xs font-semibold text-slate-600 mt-1.5 leading-normal">
                            Search, Compare & Hire Best Local Experts
                        </p>
                    </div>

                    <div className="mt-4 relative z-10">
                        <button
                            onClick={() => navigate('/professionals')}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FF5A00] hover:bg-[#E04F00] active:scale-95 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
                        >
                            <span>Search Now</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Subtle decorative background pattern */}
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-orange-200/30 rounded-full blur-xl pointer-events-none" />
                </div>

                {/* Right Categories Grid */}
                <div className="flex-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
                        {displayedCategories.map((cat) => {
                            const imgSrc = (cat.icon && cat.icon.startsWith('http')) 
                                ? cat.icon 
                                : getCategoryFallbackImage(cat.name);

                            return (
                                <div
                                    key={cat._id}
                                    onClick={() => navigate(`/professionals?categoryId=${cat._id}`)}
                                    className="bg-white rounded-xl border border-slate-100 p-2 flex flex-col items-center justify-between cursor-pointer hover:border-orange-300 hover:shadow-sm transition-all group select-none"
                                >
                                    <div className="w-full h-16 sm:h-18 md:h-16 lg:h-18 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center mb-1.5">
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
                                    <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-[#FF5A00] transition-colors text-center w-full">
                                        {cat.name}
                                    </span>
                                </div>
                            );
                        })}

                        {/* View More Card (10th slot) */}
                        <div
                            onClick={() => navigate('/professionals')}
                            className="bg-white rounded-xl border border-slate-100 p-2 flex flex-col items-center justify-center cursor-pointer hover:border-orange-300 hover:shadow-sm transition-all group min-h-[90px] select-none"
                        >
                            <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center mb-1.5 group-hover:bg-orange-100 transition-colors">
                                <div className="flex items-center gap-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A00] inline-block animate-pulse"></span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A00] inline-block animate-pulse delay-75"></span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A00] inline-block animate-pulse delay-150"></span>
                                </div>
                            </div>
                            <span className="text-[11px] font-black text-amber-950 group-hover:text-[#FF5A00] transition-colors text-center">
                                View More
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LocalServiceProvidersSection;
