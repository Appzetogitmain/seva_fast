import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { Search, Mic, ArrowLeft, X, TrendingUp, ChevronRight, History, Sparkles, Filter, SlidersHorizontal, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { customerApi } from '../services/customerApi';
import { mapProductForCustomerListing } from '../utils/productPricing';
import ProductCard from '../components/shared/ProductCard';
import { useProductDetail } from '../context/ProductDetailContext';
import { useSettings } from '@core/context/SettingsContext';
import { cn } from '@/lib/utils';
import { useLocation as useAppLocation } from '../context/LocationContext';
import VoiceSearchModal from '../components/shared/VoiceSearchModal';
import { matchProductWithQuery } from '../utils/searchSynonyms';

const SearchPage = () => {
    const navigate = useNavigate();
    const location = useRouterLocation();
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const { settings } = useSettings();
    const { currentLocation } = useAppLocation();
    const appName = settings?.appName || 'App';

    // Get initial query & voice param from URL state or params
    const searchParams = new URLSearchParams(location.search);
    const initialQuery = location.state?.query || searchParams.get('q') || '';
    const shouldOpenVoice = searchParams.get('voice') === 'true';

    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(shouldOpenVoice);
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

    // Manage Recent Searches with LocalStorage
    const [pastSearches, setPastSearches] = useState(() => {
        const saved = localStorage.getItem('sevafast_recent_searches');
        return saved ? JSON.parse(saved) : [];
    });

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Filters state
    const [priceFilter, setPriceFilter] = useState(''); // 'under50', '50to200', 'over200'
    const [brandFilter, setBrandFilter] = useState('');
    const [ratingFilter, setRatingFilter] = useState(0); // 0, 3, 4
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Instant / Low-latency Debounce Logic (150ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 150); 
        return () => clearTimeout(timer);
    }, [query]);

    // Handle Voice Search Transcript Result
    const handleVoiceResult = (transcript) => {
        if (!transcript) return;
        setQuery(transcript);
        saveSearch(transcript);
    };

    // Fetch initial product set for instant local filtering fallback
    useEffect(() => {
        const fetchProducts = async () => {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);
            setIsLoading(true);
            try {
                const params = { limit: 100 };
                if (hasValidLocation) {
                    params.lat = currentLocation.latitude;
                    params.lng = currentLocation.longitude;
                }
                const response = await customerApi.getProducts(params);
                if (response.data.success) {
                    const rawResult = response.data.result;
                    const dbProds = Array.isArray(response.data.results)
                        ? response.data.results
                        : Array.isArray(rawResult?.items)
                        ? rawResult.items
                        : Array.isArray(rawResult)
                        ? rawResult
                        : [];
                    const formattedProds = dbProds.map((p) => mapProductForCustomerListing(p));
                    setAllProducts(formattedProds);
                }
            } catch (error) {
                console.error('Error fetching products:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProducts();
    }, [currentLocation?.latitude, currentLocation?.longitude]);

    // Save search term to history
    const saveSearch = (term) => {
        if (!term || !term.trim()) return;
        const cleanTerm = term.trim();
        const updated = [cleanTerm, ...pastSearches.filter(s => s.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 10);
        setPastSearches(updated);
        localStorage.setItem('sevafast_recent_searches', JSON.stringify(updated));
    };

    // Remove specific search term
    const handleRemoveSearch = (e, term) => {
        e.stopPropagation();
        const updated = pastSearches.filter(s => s !== term);
        setPastSearches(updated);
        localStorage.setItem('sevafast_recent_searches', JSON.stringify(updated));
    };

    // Trigger save on Enter or clicking a result
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && query.trim()) {
            saveSearch(query);
        }
    };

    // Real-time multi-field search from backend & Hinglish local matching
    useEffect(() => {
        const fetchSearchResults = async () => {
            const cleanQuery = debouncedQuery.trim().replace(/[.,!?;]+$/, '');
            if (!cleanQuery) {
                setResults([]);
                return;
            }
            
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);
                
            setIsLoading(true);
            try {
                const params = { limit: 50, search: cleanQuery };
                if (hasValidLocation) {
                    params.lat = currentLocation.latitude;
                    params.lng = currentLocation.longitude;
                }
                const response = await customerApi.getProducts(params);
                let backendMatches = [];
                if (response.data.success) {
                    const rawResult = response.data.result;
                    const dbProds = Array.isArray(response.data.results)
                        ? response.data.results
                        : Array.isArray(rawResult?.items)
                        ? rawResult.items
                        : Array.isArray(rawResult)
                        ? rawResult
                        : [];
                    backendMatches = dbProds.map((p) => mapProductForCustomerListing(p));
                }
                
                const localMatches = allProducts.filter(p => matchProductWithQuery(p, cleanQuery));
                
                // Merge and deduplicate
                const mergedMap = new Map();
                [...backendMatches, ...localMatches].forEach(p => {
                    if (p && (p.id || p._id)) {
                        mergedMap.set(p.id || p._id, p);
                    }
                });
                
                setResults(Array.from(mergedMap.values()));
            } catch (error) {
                console.error('Error fetching search results:', error);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchSearchResults();
    }, [debouncedQuery, allProducts, currentLocation?.latitude, currentLocation?.longitude]);

    // Derived available brands
    const availableBrands = useMemo(() => {
        const brands = new Set();
        results.forEach(p => { if (p.brand) brands.add(p.brand); });
        return Array.from(brands).sort();
    }, [results]);

    // Filtered results
    const filteredResults = useMemo(() => {
        return results.filter(product => {
            let pass = true;
            
            // Price check (using mapped product.price which is effective price)
            if (priceFilter === 'under50' && product.price > 50) pass = false;
            if (priceFilter === '50to200' && (product.price < 50 || product.price > 200)) pass = false;
            if (priceFilter === 'over200' && product.price < 200) pass = false;
            
            // Brand check
            if (brandFilter && product.brand !== brandFilter) pass = false;
            
            // Rating check (assuming product.rating or product.averageRating exists, defaulting to 0)
            const pRating = product.averageRating || product.rating || 0;
            if (ratingFilter > 0 && pRating < ratingFilter) pass = false;

            return pass;
        });
    }, [results, priceFilter, brandFilter, ratingFilter]);

    // Lowest Price Section
    const lowestPriceProducts = useMemo(() => {
        return [...allProducts]
            .sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price))
            .slice(0, 10);
    }, [allProducts]);

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setPriceFilter('');
        setBrandFilter('');
        setRatingFilter(0);
    };

    return (
        <div className="min-h-screen bg-white font-outfit">
            {/* Header / Search Input */}
            <div className={cn(
                "sticky top-0 z-50 bg-linear-to-r from-primary to-[var(--brand-400)] shadow-[0_4px_20px_rgba(0,0,0,0.12)] relative overflow-hidden",
                isProductDetailOpen && "hidden md:block"
            )}>
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-xl pointer-events-none" />

                <div className="px-4 pt-5 pb-6 flex items-center md:justify-center gap-3 relative z-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md border border-white/10 transition-all flex-shrink-0 shadow-sm active:scale-90"
                    >
                        <ArrowLeft size={22} strokeWidth={2.5} />
                    </button>

                    <div className="flex-1 relative md:flex-none md:w-[500px] lg:w-[600px]">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                            <Search size={18} strokeWidth={3} className="text-slate-400" />
                        </div>
                        <input
                            autoFocus
                            type="text"
                            placeholder='Search items, categories (e.g. Mango, Doodh)...'
                            value={query}
                            onKeyDown={handleKeyDown}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full h-12 bg-white rounded-2xl pl-11 pr-14 shadow-xl shadow-black/10 border-none outline-none text-slate-800 font-bold placeholder:text-slate-400 placeholder:font-medium focus:ring-4 focus:ring-white/20 transition-all text-sm md:text-base"
                        />
                        
                        {/* Integrated Actions inside Search Input */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1">
                            {query && (
                                <button
                                    onClick={handleClear}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <X size={12} strokeWidth={3} className="text-slate-600" />
                                </button>
                            )}
                            <div className="w-[1px] h-6 bg-slate-100 mx-1" />
                            <button 
                                onClick={() => setIsVoiceModalOpen(true)}
                                className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 transition-all rounded-full relative"
                                title="Search by Voice"
                            >
                                <Mic size={20} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-10 pb-24">
                {/* Search Results List */}
                {query ? (
                    <section>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                Search Results
                                {isLoading && <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                            </h2>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredResults.length} found</span>
                                <button 
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={cn("px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border", 
                                        showFilters || priceFilter || brandFilter || ratingFilter > 0
                                        ? "bg-primary/10 border-primary/20 text-primary" 
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
                                >
                                    <SlidersHorizontal size={14} /> Filters 
                                    {(priceFilter || brandFilter || ratingFilter > 0) && (
                                        <span className="w-2 h-2 rounded-full bg-primary" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Filters Panel */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-wrap gap-6">
                                        {/* Price Filter */}
                                        <div>
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Price</h4>
                                            <div className="flex flex-wrap gap-2">
                                                <button onClick={() => setPriceFilter(priceFilter === 'under50' ? '' : 'under50')}
                                                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all border", priceFilter === 'under50' ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
                                                    Under ₹50
                                                </button>
                                                <button onClick={() => setPriceFilter(priceFilter === '50to200' ? '' : '50to200')}
                                                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all border", priceFilter === '50to200' ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
                                                    ₹50 - ₹200
                                                </button>
                                                <button onClick={() => setPriceFilter(priceFilter === 'over200' ? '' : 'over200')}
                                                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all border", priceFilter === 'over200' ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
                                                    Over ₹200
                                                </button>
                                            </div>
                                        </div>

                                        {/* Rating Filter */}
                                        <div>
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Rating</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {[3, 4].map(star => (
                                                    <button key={star} onClick={() => setRatingFilter(ratingFilter === star ? 0 : star)}
                                                        className={cn("px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all border", ratingFilter === star ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
                                                        {star}+ <Star size={12} className={ratingFilter === star ? "fill-white" : "fill-amber-400 text-amber-400"} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Brand Filter */}
                                        {availableBrands.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Brand</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {availableBrands.map(brand => (
                                                        <button key={brand} onClick={() => setBrandFilter(brandFilter === brand ? '' : brand)}
                                                            className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all border", brandFilter === brand ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
                                                            {brand}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Clear Filters */}
                                        {(priceFilter || brandFilter || ratingFilter > 0) && (
                                            <div className="flex items-end ml-auto">
                                                <button 
                                                    onClick={() => { setPriceFilter(''); setBrandFilter(''); setRatingFilter(0); }}
                                                    className="px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {filteredResults.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 md:gap-x-4 gap-y-6 md:gap-y-10">
                                {filteredResults.map((product) => (
                                    <div key={product.id || product._id} onClick={() => saveSearch(query)} className="flex justify-center">
                                        <ProductCard product={product} compact={isMobile} />
                                    </div>
                                ))}
                            </div>
                        ) : !isLoading ? (
                            <div className="py-16 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
                                    <Search size={32} />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">No items found</h3>
                                <p className="text-slate-500 font-medium max-w-xs mb-4">We couldn't find anything matching "{query}". Try searching with different keywords like "Mango" or "Milk"!</p>
                                <button
                                    onClick={() => setIsVoiceModalOpen(true)}
                                    className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-extrabold rounded-xl text-xs flex items-center gap-2 transition-colors"
                                >
                                    <Mic size={16} /> Try Voice Search
                                </button>
                            </div>
                        ) : null}
                    </section>
                ) : (
                    <>
                        {/* 1. Recently Searched Item Section */}
                        {pastSearches.length > 0 && (
                            <section>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recently Searched</h3>
                                    <button
                                        onClick={() => {
                                            setPastSearches([]);
                                            localStorage.removeItem('sevafast_recent_searches');
                                        }}
                                        className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        Clear History
                                    </button>
                                </div>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                    {pastSearches.map((term) => (
                                        <div
                                            key={term}
                                            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-100 shadow-sm hover:border-primary/30 rounded-full whitespace-nowrap active:scale-95 transition-all cursor-pointer"
                                            onClick={() => setQuery(term)}
                                        >
                                            <div className="h-5 w-5 rounded-full flex items-center justify-center bg-primary/10">
                                                <History size={12} className="text-primary" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{term}</span>
                                            <button
                                                onClick={(e) => handleRemoveSearch(e, term)}
                                                className="ml-1 p-0.5 hover:bg-slate-100 rounded-full transition-colors"
                                            >
                                                <X size={12} className="text-slate-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Popular Quick Search Tags */}
                        <section>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Trending Searches</h3>
                            <div className="flex flex-wrap gap-2">
                                {['Mango', 'Doodh', 'Milk', 'Paneer', 'Chips', 'Atta', 'Rice', 'Cold Drink'].map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => setQuery(tag)}
                                        className="px-3.5 py-1.5 bg-slate-50 hover:bg-primary/10 hover:text-primary border border-slate-200/60 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-1.5"
                                    >
                                        <Sparkles size={12} className="text-amber-500" />
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* 2. Lowest Price Ever Section */}
                        <section>
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Lowest Price Ever!</h2>
                                <button 
                                    className="flex items-center gap-1 md:gap-1.5 px-3 py-1 md:px-4 md:py-1.5 bg-slate-50 hover:bg-slate-100 rounded-full text-xs md:text-sm font-black transition-all text-primary" 
                                    onClick={() => navigate('/category/all')}
                                >
                                    See All <ChevronRight size={14} strokeWidth={3} />
                                </button>
                            </div>
                            <div className="flex gap-2 md:gap-4 overflow-x-auto no-scrollbar -mx-5 px-5 pb-3 snap-x">
                                {isLoading && allProducts.length === 0 ? (
                                    [...Array(4)].map((_, i) => (
                                        <div key={i} className="min-w-[126px] sm:min-w-[136px] md:min-w-[148px] h-52 md:h-64 bg-slate-50 rounded-2xl animate-pulse" />
                                    ))
                                ) : lowestPriceProducts.map((product) => (
                                    <div key={product.id || product._id} className="min-w-[126px] sm:min-w-[136px] md:min-w-[148px] snap-start">
                                        <ProductCard product={product} compact={isMobile} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>

            {/* Voice Search Modal */}
            <VoiceSearchModal
                isOpen={isVoiceModalOpen}
                onClose={() => setIsVoiceModalOpen(false)}
                onSearchResult={handleVoiceResult}
            />
        </div>
    );
};

export default SearchPage;
