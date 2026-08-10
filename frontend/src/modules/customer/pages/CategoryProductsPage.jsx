import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Heart, Search, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

import ProductCard from '../components/shared/ProductCard';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import { mapProductForCustomerListing } from '../utils/productPricing';
import MiniCart from '../components/shared/MiniCart';
import SectionRenderer from "../components/experience/SectionRenderer";
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useSettings } from '@core/context/SettingsContext';
import ServiceUnavailableSection from '@shared/components/ServiceUnavailableSection';

const CategoryProductsPage = () => {
    const { categoryName: catId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentLocation } = useAppLocation();
    const { settings } = useSettings();
    const initialSubcategoryId = location.state?.activeSubcategoryId || 'all';
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubcategoryId);
    const [category, setCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const productParams = { categoryId: catId };
            if (hasValidLocation) {
                productParams.lat = currentLocation.latitude;
                productParams.lng = currentLocation.longitude;
            }

            // Fetch products and categories in parallel instead of sequentially
            const [prodRes, catRes] = await Promise.all([
                customerApi.getProducts(productParams),
                customerApi.getCategories({ tree: true }),
            ]);

            if (prodRes.data.success) {
                const rawResult = prodRes.data.result;
                const dbProds = Array.isArray(prodRes.data.results)
                    ? prodRes.data.results
                    : Array.isArray(rawResult?.items)
                    ? rawResult.items
                    : Array.isArray(rawResult)
                    ? rawResult
                    : [];

                const formattedProds = dbProds.map((p) => mapProductForCustomerListing(p));
                setProducts(Array.isArray(formattedProds) ? formattedProds : []);
            } else {
                setProducts([]);
            }

            if (catRes.data.success) {
                const tree = catRes.data.results || catRes.data.result || [];
                let currentCat = null;
                for (const header of tree) {
                    const found = (header.children || []).find(c => c._id === catId);
                    if (found) {
                        currentCat = found;
                        break;
                    }
                }

                if (currentCat) {
                    setCategory(currentCat);
                    const subs = (currentCat.children || []).map(s => ({
                        id: s._id,
                        name: s.name,
                        icon: s.image || 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png'
                    }));
                    setSubCategories([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }, ...subs]);
                }
            }
        } catch (error) {
            console.error("Error fetching category data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setSelectedSubCategory(location.state?.activeSubcategoryId || 'all');
    }, [catId, location.state?.activeSubcategoryId, currentLocation?.latitude, currentLocation?.longitude]);

    const safeProducts = Array.isArray(products) ? products : [];

    const filteredProducts = safeProducts.filter(p =>
        selectedSubCategory === 'all' || p.subcategoryId?._id === selectedSubCategory || p.subcategoryId === selectedSubCategory
    );

    const productsById = React.useMemo(() => {
        const map = {};
        safeProducts.forEach(p => {
            map[p._id || p.id] = p;
        });
        return map;
    }, [safeProducts]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 relative font-sans w-full">
            {/* Header */}
            <header className={cn(
                "sticky top-0 z-50 bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs",
                isProductDetailOpen && "hidden md:flex"
            )}>
                <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-800"
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">
                                {category?.name || catId}
                            </h1>
                            {filteredProducts.length > 0 && (
                                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                                    Showing {filteredProducts.length} items
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 w-full max-w-7xl mx-auto relative items-start">
                {(safeProducts.length === 0 && !isLoading) ? (
                    <div className="w-full flex-1">
                        <ServiceUnavailableSection
                            embedded
                            description={`${settings?.appName || 'Our service'} is not available in your area yet. We're expanding fast!`}
                            buttonLabel="Try Refreshing"
                            onRetry={fetchData}
                        />
                    </div>
                ) : (
                    <>
                        {/* Sidebar */}
                        <aside className="w-[75px] md:w-56 lg:w-64 border-r border-slate-100 flex flex-col bg-white overflow-y-auto hide-scrollbar sticky top-[57px] h-[calc(100vh-57px)] pb-32 shrink-0">
                            {subCategories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedSubCategory(cat.id)}
                                    className={cn(
                                        "flex flex-col md:flex-row items-center py-3.5 px-1 md:px-4 gap-2 transition-all relative border-l-4 md:border-l-4 md:rounded-r-xl my-0.5",
                                        selectedSubCategory === cat.id
                                            ? "bg-[#F7FCF5] border-primary text-primary font-bold"
                                            : "border-transparent text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    <div className={cn(
                                        "w-12 h-12 md:w-9 md:h-9 rounded-2xl flex items-center justify-center p-1 transition-all duration-300 shrink-0",
                                        selectedSubCategory === cat.id ? "scale-105" : "opacity-90"
                                    )}>
                                        <img src={applyCloudinaryTransform(cat.icon)} alt={cat.name} loading="lazy" className="w-full h-full object-contain" />
                                    </div>
                                    <span className={cn(
                                        "text-[10px] md:text-xs text-center md:text-left font-bold font-sans leading-tight px-1 min-w-0 truncate",
                                        selectedSubCategory === cat.id ? "text-primary font-extrabold" : "text-slate-700"
                                    )}>
                                        {cat.name}
                                    </span>
                                </button>
                            ))}
                        </aside>

                        {/* Content */}
                        <main className="flex-1 p-2 sm:p-4 md:p-6 pb-28 bg-white min-h-[calc(100vh-57px)]">
                            {isLoading ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                        <div key={n} className="h-64 bg-slate-100 animate-pulse rounded-2xl" />
                                    ))}
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="text-center py-16 text-slate-500 font-medium">
                                    No products found in this subcategory.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-4">
                                    {filteredProducts.map((product) => (
                                        <ProductCard key={product.id} product={product} compact={true} />
                                    ))}
                                </div>
                            )}
                        </main>
                    </>
                )}
            </div>

            <MiniCart />

            <style dangerouslySetInnerHTML={{
                __html: `
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .hide-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}} />
        </div>
    );
};

export default CategoryProductsPage;

