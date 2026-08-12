import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation, useDragControls } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { X, ChevronDown, Share2, Heart, Search, Clock, Minus, Plus, ShoppingBag, Star, MessageSquare, ArrowLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useFirstOrderOffer } from '../context/FirstOrderOfferContext';
import { useToast } from '@shared/components/ui/Toast';
import { useSettings } from '@core/context/SettingsContext';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { customerApi } from '../services/customerApi';
import WriteReviewSheet from '../components/shared/WriteReviewSheet';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { formatDate } from '@shared/utils/formatDate';
import { useLocation as useAppLocation } from '../context/LocationContext';
import {
  effectiveUnitPrice,
  resolveDisplayedProductPrice,
  variantIdentityKey,
  variantsMatch,
  pickListingVariant,
} from '../utils/productPricing';
import { useAuth } from '@core/context/AuthContext';

const ProductDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isLoadingProduct, setIsLoadingProduct] = useState(true);

    const { cart, cartCount, addToCart, updateQuantity, removeFromCart } = useCart();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { showToast } = useToast();
    const { settings } = useSettings();
    const supportEmail = settings?.supportEmail || 'support@example.com';
    const { currentLocation } = useAppLocation();

    // Controls for sheet animation
    const controls = useAnimation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const { user } = useAuth();
    const [isDemanding, setIsDemanding] = useState(false);

    const [reviews, setReviews] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(true);
    const [canReview, setCanReview] = useState(null); // null = loading, true/false
    const [canReviewReason, setCanReviewReason] = useState(null);
    const [showReviewSheet, setShowReviewSheet] = useState(false);
    const [expandedSections, setExpandedSections] = useState(['description']); // Start with description open

    const toggleSection = (section) => {
        setExpandedSections(prev => 
            prev.includes(section) 
                ? prev.filter(s => s !== section) 
                : [...prev, section]
        );
    };

    const scrollRef = useRef(null);

    const allImages = useMemo(() => {
        if (!selectedProduct) return [];
        const images = [];
        if (selectedProduct.mainImage) images.push(selectedProduct.mainImage);
        else if (selectedProduct.image) images.push(selectedProduct.image);

        if (selectedProduct.galleryImages && Array.isArray(selectedProduct.galleryImages)) {
            images.push(...selectedProduct.galleryImages);
        }
        return images.length > 0
          ? images
          : [
              "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
            ];
    }, [selectedProduct]);

    // Fetch Product Data
    useEffect(() => {
        const fetchProduct = async () => {
            if (!id) return;
            try {
                setIsLoadingProduct(true);
                
                const hasValidLocation =
                    Number.isFinite(currentLocation?.latitude) &&
                    Number.isFinite(currentLocation?.longitude);

                const params = hasValidLocation ? {
                    lat: currentLocation.latitude,
                    lng: currentLocation.longitude
                } : {};

                console.log("Fetching product with ID:", id, "params:", params);
                const res = await customerApi.getProductById(id, params);
                
                if (res.data?.success && res.data?.result) {
                    const p = res.data.result;
                    const formatted = {
                        ...p,
                        id: p._id,
                        images: [p.mainImage, ...(p.galleryImages || [])].filter(Boolean)
                    };
                    setSelectedProduct(formatted);
                } else if (res.data?.success && res.data?.data) {
                    setSelectedProduct(res.data.data);
                } else if (res.data) {
                    setSelectedProduct(res.data);
                }
            } catch (error) {
                console.error("Failed to load product:", error);
                showToast("Failed to load product details", "error");
            } finally {
                setIsLoadingProduct(false);
            }
        };
        fetchProduct();
    }, [id, showToast, currentLocation]);

    // Update variant when product changes
    useEffect(() => {
        if (selectedProduct?.variants?.length > 0) {
            const listingSku = String(selectedProduct.listingVariantSku || "").trim();
            const listingVariant = listingSku
              ? selectedProduct.variants.find(
                  (variant) => variantIdentityKey(variant) === listingSku,
                )
              : null;

            setSelectedVariant(
              listingVariant ||
                pickListingVariant(selectedProduct)?.variant ||
                selectedProduct.variants[0],
            );
        } else {
            setSelectedVariant(null);
        }
        setActiveImageIndex(0);

        if (selectedProduct?.id || selectedProduct?._id) {
            const prodId = selectedProduct.id || selectedProduct._id;
            fetchReviews(prodId);
            fetchCanReview(prodId);
        }
    }, [selectedProduct]);

    const fetchReviews = async (productId) => {
        try {
            setReviewLoading(true);
            const res = await customerApi.getProductReviews(productId);
            if (res.data.success) {
                setReviews(res.data.results);
            }
        } catch (error) {
            console.error("Fetch reviews error:", error);
        } finally {
            setReviewLoading(false);
        }
    };

    const fetchCanReview = async (productId) => {
        try {
            setCanReview(null);
            const res = await customerApi.canReviewProduct(productId);
            if (res.data.success) {
                setCanReview(res.data.data?.canReview ?? false);
                setCanReviewReason(res.data.data?.reason ?? null);
            }
        } catch {
            // If not logged in or any error, don't show form
            setCanReview(false);
            setCanReviewReason('not_purchased');
        }
    };

    // If no product selected, don't render anything (well, Context handles isOpen, but still good check)
    // Removed early return to satisfy Rules of Hooks (hooks must be called in same order)
    // if (!selectedProduct && !isOpen) return null;

    // Strip raw RTF/RTF-like codes from description strings from the backend
    const cleanDescription = (text) => {
        if (!text) return null;
        // Detect RTF format
        if (text.trim().startsWith('{\\rtf') || text.includes('\\par')) {
            // Extract readable text: remove RTF control words and braces
            return text
                .replace(/\{\\[^}]*\}/g, '') // Remove groups like {\rtf1 ...}
                .replace(/\\[a-z]+\d*\s?/gi, '') // Remove control words like \par \b \fs22
                .replace(/[{}]/g, '') // Remove remaining braces
                .replace(/\\'/g, "'") // Replace escaped apostrophes
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
        }
        return text;
    };

    const variantKey = variantIdentityKey(selectedVariant);
    const activePricing = useMemo(
        () =>
            selectedProduct
                ? resolveDisplayedProductPrice(selectedProduct, selectedVariant)
                : { unitPrice: 0, originalPrice: 0, hasDiscount: false },
        [selectedProduct, selectedVariant],
    );

    const { isFirstOrder, firstOrderDiscountPercent } = useFirstOrderOffer();
    const firstOrderDiscount = isFirstOrder ? Number(firstOrderDiscountPercent ?? 10) : 0;
    const baseUnitPrice = activePricing.unitPrice;
    const originalPrice = activePricing.hasDiscount ? activePricing.originalPrice : baseUnitPrice;
    const existingDiscountPercent = activePricing.hasDiscount
      ? Math.round(((originalPrice - baseUnitPrice) / originalPrice) * 100)
      : 0;

    const finalUnitPrice = (isFirstOrder && firstOrderDiscount > 0)
      ? Math.round(baseUnitPrice * (1 - firstOrderDiscount / 100))
      : baseUnitPrice;

    const strikeThroughPrice = originalPrice > finalUnitPrice ? originalPrice : 0;

    const detailBadgeText = React.useMemo(() => {
      if (isFirstOrder && firstOrderDiscount > 0) {
        if (existingDiscountPercent > 0) {
          return `${existingDiscountPercent}% + ${firstOrderDiscount}% EXTRA OFF`;
        }
        return `${firstOrderDiscount}% OFF`;
      }
      if (existingDiscountPercent > 0) {
        return `${existingDiscountPercent}% OFF`;
      }
      return null;
    }, [isFirstOrder, firstOrderDiscount, existingDiscountPercent]);

    const cartItem = selectedProduct
        ? cart.find(
            (item) =>
                `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
                `${selectedProduct.id}::${variantKey || ""}`,
        )
        : null;
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = selectedProduct ? isInWishlist(selectedProduct.id) : false;

    const isOutOfStock = selectedVariant
        ? (selectedVariant.stock <= 0)
        : (selectedProduct?.stock <= 0);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    const handleDragEnd = (event, info) => {
        const offset = info.offset.y;
        const velocity = info.velocity.y;

        if (offset > 150 || velocity > 200) {
            // Dragged down significantly -> Close
            navigate(-1);
        } else if (offset < -20 || velocity < -200) {
            // Dragged up -> Expand
            setIsExpanded(true);
        } else {
            // Snap back to current state (expanded or initial)
        }
    };

    const toggleWishlist = (e) => {
        e.stopPropagation();
        toggleWishlistGlobal(selectedProduct);
        showToast(
            isWishlisted ? `${selectedProduct.name} removed from wishlist` : `${selectedProduct.name} added to wishlist`,
            isWishlisted ? 'info' : 'success'
        );
    };

    const handleShare = (e) => {
        if (e) e.stopPropagation();
        const shareUrl = `${window.location.origin}/product/${selectedProduct.slug || selectedProduct.id}`;
        if (navigator.share) {
            navigator.share({
                title: selectedProduct.name,
                text: selectedProduct.description || `Check out ${selectedProduct.name} on Seva!`,
                url: shareUrl,
            }).catch((err) => {
                console.log("Error sharing:", err);
            });
        } else {
            navigator.clipboard.writeText(shareUrl)
                .then(() => {
                    showToast("Product link copied to clipboard!", "success");
                })
                .catch(() => {
                    showToast("Failed to copy link", "error");
                });
        }
    };

    const handleAddToCart = () => {
        addToCart({
            ...selectedProduct,
            variantSku: variantKey,
        });
        showToast(`${selectedProduct.name} added to cart`, 'success');
    };

    const handleNotifyMe = async (e) => {
        e.preventDefault();
        e.stopPropagation();
  
        if (!user) {
          showToast("Please login to get notified", "error");
          navigate("/customer/auth");
          return;
        }
  
        setIsDemanding(true);
        try {
          await customerApi.registerProductDemand({
            productId: selectedProduct.id || selectedProduct._id,
            variantSku: variantKey || "",
          });
          showToast("We will notify you when it's back in stock!", "success");
        } catch (error) {
          showToast(error.response?.data?.message || "Failed to register request", "error");
        } finally {
          setIsDemanding(false);
        }
    };

    const handleIncrement = () =>
        updateQuantity(selectedProduct.id, 1, variantKey);

    const handleDecrement = () => {
        if (quantity === 1) {
            removeFromCart(selectedProduct.id, variantKey);
        } else {
            updateQuantity(selectedProduct.id, -1, variantKey);
        }
    };

    // Scroll handler to expand on scroll
    const handleScroll = (e) => {
        if (!isExpanded && e.currentTarget.scrollTop > 5) {
            setIsExpanded(true);
        }
    };

    // Wheel handler for expansion
    const handleWheel = (e) => {
        if (!isExpanded && e.deltaY > 0) {
            setIsExpanded(true);
            e.stopPropagation();
        } else if (isExpanded) {
            // Allow normal scroll but stop propagation to background
            e.stopPropagation();
        }
    };

    if (!selectedProduct) return null;

    const cleanDesc = cleanDescription(selectedProduct?.description);

    const AccordionItem = ({ title, children, id, icon }) => {
        const isOpen = expandedSections.includes(id);
        return (
            <div className="border-b border-slate-100 last:border-0">
                <button
                    onClick={() => toggleSection(id)}
                    className="w-full py-4 flex items-center justify-between transition-all hover:bg-slate-50/50 rounded-lg group px-2"
                >
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                            isOpen ? "bg-brand-50 text-primary" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                        )}>
                            {icon}
                        </div>
                        <span className={cn(
                            "font-bold text-[13px] uppercase tracking-wider",
                            isOpen ? "text-[#1A1A1A]" : "text-slate-500"
                        )}>{title}</span>
                    </div>
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        className={cn("transition-colors", isOpen ? "text-primary" : "text-slate-300")}
                    >
                        <ChevronDown size={18} strokeWidth={3} />
                    </motion.div>
                </button>
                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                        >
                            <div className="pt-2 pb-6 px-2">
                                {children}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-24 md:pb-8 pt-0 md:pt-[120px]">
            {isLoadingProduct ? (
                <div className="flex h-screen items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : !selectedProduct ? (
                <div className="flex h-screen items-center justify-center text-slate-500 font-bold">
                    Product not found
                </div>
            ) : (
                <>
                    {/* ============================================================ */}
                    {/* RESPONSIVE LAYOUT */}
                    {/* ============================================================ */}
                    <div className="flex flex-col md:flex-row w-full max-w-7xl mx-auto bg-white md:rounded-3xl shadow-sm overflow-hidden md:my-6 min-h-[60vh]">
                        <div className="flex flex-col md:flex-row w-full relative md:items-start">
                                {/* Left: Image Gallery */}
                                <div className="relative w-full md:w-[42%] lg:w-[44%] flex-shrink-0 flex flex-col md:h-[calc(100vh-120px)] md:sticky md:top-6 z-10" style={{ background: 'linear-gradient(145deg, #f9fafb 0%, #f1f8f2 50%, #fafbfc 100%)' }}>
                                    {/* Top bar with back + wishlist */}
                                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-5 z-20">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => navigate(-1)}
                                            className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border border-gray-100/80"
                                        >
                                            <ArrowLeft size={18} className="text-gray-700" strokeWidth={2.5} />
                                        </motion.button>


                                        <div className="flex items-center gap-2">
                                            {/* Share Button */}
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={handleShare}
                                                className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border border-gray-100/80 text-gray-500 hover:text-primary"
                                                title="Share Product"
                                            >
                                                <Share2 size={18} strokeWidth={2.5} />
                                            </motion.button>

                                            {/* Wishlist Button */}
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={toggleWishlist}
                                                className={cn(
                                                    "w-10 h-10 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border",
                                                    isWishlisted ? "bg-red-50/95 border-red-100" : "bg-white/95 border-gray-100/80"
                                                )}
                                            >
                                                <Heart size={18} className={cn(
                                                    "transition-all",
                                                    isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-400'
                                                )} />
                                            </motion.button>
                                        </div>
                                    </div>

                                    {/* Main content area: vertical thumbnails + main image */}
                                    <div className="flex-1 flex flex-col-reverse md:flex-row mt-[64px] mb-3 overflow-hidden">
                                        {/* Thumbnail strip (bottom on mobile, left on desktop) */}
                                        {allImages.length > 1 && (
                                            <div className="flex flex-row md:flex-col gap-3 px-3 py-2 overflow-x-auto md:overflow-y-auto no-scrollbar justify-center md:justify-start">
                                                {allImages.slice(0, 5).map((img, i) => (
                                                    <motion.button
                                                        key={i}
                                                        whileHover={{ scale: 1.08 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => setActiveImageIndex(i)}
                                                        className={cn(
                                                            'w-[52px] h-[52px] lg:w-14 lg:h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all duration-300 border-2',
                                                            i === activeImageIndex
                                                                ? 'border-primary shadow-lg shadow-brand-100/60 ring-2 ring-brand-100 bg-white'
                                                                : 'border-gray-200/60 opacity-50 hover:opacity-90 bg-white/60'
                                                        )}
                                                    >
                                                        <img src={applyCloudinaryTransform(img, "f_auto,q_auto:best,w_160,dpr_auto")} alt="" loading="lazy" className="w-full h-full object-contain p-1.5" />
                                                    </motion.button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Main image viewer */}
                                        <div className="flex-1 flex items-center justify-center p-0 lg:p-4 relative min-h-[350px] w-full">
                                            <AnimatePresence mode="wait">
                                                <motion.img
                                                    key={activeImageIndex}
                                                    initial={{ scale: 0.93, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0.93, opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    src={applyCloudinaryTransform(allImages[activeImageIndex], "f_auto,q_auto:best,w_1200,dpr_auto")}
                                                    alt={`${selectedProduct.name} ${activeImageIndex + 1}`}
                                                    className={cn("w-full h-full object-contain mix-blend-multiply drop-shadow-2xl hover:scale-[1.03] transition-transform duration-500 absolute inset-0 m-auto p-0", isOutOfStock && "grayscale opacity-60")}
                                                />
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* Carousel dot indicators */}
                                    {allImages.length > 1 && (
                                        <div className="flex justify-center gap-2 pb-5">
                                            {allImages.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActiveImageIndex(i)}
                                                    className={cn(
                                                        'rounded-full transition-all duration-400',
                                                        i === activeImageIndex ? 'w-8 h-2 bg-primary' : 'w-2 h-2 bg-gray-300/60 hover:bg-gray-400'
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Product Info (scrollable naturally) */}
                                <div className="flex-1 flex flex-col bg-white">
                                    <div className="flex-1 px-7 py-6 lg:px-8 lg:py-7 space-y-3">

                                        {/* Top badges row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 }}
                                                className="inline-flex items-center gap-1.5 bg-[#ecfeff] border border-brand-200/50 text-primary px-3 py-1.5 rounded-lg text-[10px] font-[700] uppercase tracking-wider"
                                            >
                                                <Clock size={12} strokeWidth={2.5} className="text-primary" />
                                                {selectedProduct.deliveryTime || '8-15 MINS'}
                                            </motion.div>
                                            {activePricing.hasDiscount && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.15 }}
                                                    className="text-[10px] font-[700] text-primary bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200/50 uppercase tracking-wider"
                                                >
                                                    💰 Save ₹{activePricing.originalPrice - activePricing.unitPrice}
                                                </motion.div>
                                            )}
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-[700] border border-orange-100/50"
                                            >
                                                <Star size={10} fill="currentColor" />
                                                {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '4.8'}
                                                <span className="text-orange-400 font-medium">({reviews.length > 0 ? reviews.length : '120+'})</span>
                                            </motion.div>
                                        </div>

                                        {/* Product Name */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.15 }}
                                        >
                                            <h1 className="text-[19px] lg:text-[22px] font-black text-[#111827] leading-[1.2] tracking-tight mb-1">
                                                {selectedProduct.name}
                                            </h1>
                                        </motion.div>

                                        {/* Price + Add-to-Cart Card */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="relative overflow-hidden rounded-[20px] border border-brand-200/60 shadow-sm"
                                            style={{ background: 'linear-gradient(135deg, #f4fcfe 0%, #eefbfb 100%)' }}
                                        >
                                            {/* Decorative subtle patterns */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl" />
                                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl" />

                                            <div className="relative flex items-center justify-between py-4 px-5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[28px] lg:text-[32px] font-[800] text-primary tracking-tight leading-none">
                                                            ₹{finalUnitPrice}
                                                        </span>
                                                        {strikeThroughPrice > finalUnitPrice && (
                                                            <span className="text-sm font-bold text-slate-400 line-through">₹{strikeThroughPrice}</span>
                                                        )}
                                                    </div>
                                                    {detailBadgeText && (
                                                        <div className="mt-1">
                                                            <span className="bg-green-100 text-green-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider inline-block border border-green-200">
                                                                🎉 {detailBadgeText}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    {isOutOfStock ? (
                                                        <motion.button
                                                            whileHover={{ scale: 1.02, y: -2 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={handleNotifyMe}
                                                            disabled={isDemanding}
                                                            className="bg-gray-100 text-gray-500 h-10 px-5 rounded-xl font-black text-[11px] flex items-center gap-2 shadow-sm transition-all uppercase tracking-widest border border-gray-200"
                                                        >
                                                            {isDemanding ? "..." : "NOTIFY ME"}
                                                        </motion.button>
                                                    ) : quantity > 0 ? (
                                                        <div className="flex items-center gap-1 bg-white border border-brand-200 rounded-xl p-1 shadow-sm">
                                                            <motion.button whileTap={{ scale: 0.85 }} onClick={handleDecrement} className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center text-brand-700 hover:bg-brand-100 transition-colors">
                                                                <Minus size={16} strokeWidth={2.5} />
                                                            </motion.button>
                                                            <span className="font-[800] text-base text-gray-800 w-8 text-center">{quantity}</span>
                                                            <motion.button whileTap={{ scale: 0.85 }} onClick={handleIncrement} className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white hover:bg-[var(--brand-400)] transition-colors shadow-sm">
                                                                <Plus size={16} strokeWidth={2.5} />
                                                            </motion.button>
                                                        </div>
                                                    ) : (
                                                    <motion.button
                                                        whileHover={{ scale: 1.02, y: -2 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={handleAddToCart}
                                                        className="bg-gradient-to-r from-primary to-[var(--brand-400)] text-white h-10 px-5 rounded-xl font-black text-[11px] flex items-center gap-2 shadow-md shadow-brand-100 hover:shadow-brand-200 transition-all uppercase tracking-widest border border-white/20"
                                                    >
                                                        <ShoppingBag size={15} strokeWidth={3} />
                                                        Add to Cart
                                                    </motion.button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>

                                        {/* View Cart */}
                                        {cartCount > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex justify-center -mt-1"
                                            >
                                                <Link
                                                    to="/checkout"
                                                    className="w-[80%] bg-gradient-to-r from-primary to-[var(--brand-500)] text-white h-[38px] rounded-xl flex items-center justify-between px-4 shadow-md shadow-brand-200/40 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ShoppingBag size={14} strokeWidth={2.0} />
                                                        <span className="text-[11px] font-[700] uppercase tracking-wider">View Cart</span>
                                                    </div>
                                                    <div className="flex items-center justify-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg">
                                                        <span className="text-[12px] font-[800] tracking-tight">₹{cart.reduce((total, item) => total + (effectiveUnitPrice(item.price, item.salePrice) * Number(item.quantity || 0)), 0)}</span>
                                                        <ChevronRight size={14} strokeWidth={2.5} />
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        )}



                                        {/* Variants Selection (Desktop) */}
                                        {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                                            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 mt-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Select Variant</h4>
                                                <div className="flex gap-2.5 flex-wrap">
                                                    {selectedProduct.variants.map((v, idx) => (
                                                        <motion.button
                                                            key={idx}
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={() => setSelectedVariant(v)}
                                                            className={cn(
                                                                'px-4 py-2 font-black rounded-xl text-xs transition-all border-2',
                                                                selectedVariant && variantsMatch(selectedVariant, v)
                                                                    ? 'bg-white border-primary text-primary shadow-sm shadow-brand-100'
                                                                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                                                            )}
                                                        >
                                                            {v.name}
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Product Information Accordion (Desktop) */}
                                        <div className="mt-8 border-t border-slate-100">
                                            {/* Description */}
                                            {cleanDesc && (
                                                <AccordionItem 
                                                    id="description" 
                                                    title="Product Description" 
                                                    icon={<Clock size={16} />}
                                                >
                                                    <div
                                                        className="text-[13px] text-slate-500 font-medium leading-relaxed whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{ __html: cleanDesc }}
                                                    />
                                                </AccordionItem>
                                            )}

                                            {/* Product Details */}
                                            <AccordionItem 
                                                id="details" 
                                                title="Product Details" 
                                                icon={<Search size={16} />}
                                            >
                                                <div className="grid grid-cols-2 gap-3 mt-1">
                                                    {[
                                                        { label: 'Shelf Life', value: '3 Days', emoji: '📅' },
                                                        { label: 'Country of Origin', value: 'India', emoji: '🇮🇳' },
                                                        { label: 'FSSAI License', value: '1001234567890', emoji: '🛡️' },
                                                        { label: 'Customer Care', value: supportEmail, emoji: '📧' }
                                                    ].map((d) => (
                                                        <div key={d.label} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 group hover:bg-white hover:shadow-sm transition-all">
                                                            <span className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase tracking-wider">{d.label}</span>
                                                            <span className="font-black text-slate-800 text-[12px]">{d.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionItem>

                                            <AccordionItem
                                                id="returns"
                                                title="Return Policy"
                                                icon={<RotateCcw size={16} />}
                                            >
                                                {settings?.returnPolicy ? (
                                                    <div 
                                                        className="text-[13px] text-slate-500 font-medium leading-relaxed quill-content"
                                                        dangerouslySetInnerHTML={{ __html: settings.returnPolicy }}
                                                    />
                                                ) : (
                                                    <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                                                        Request a return from your order details page within the return window after delivery.
                                                        Items should be unused and in original condition with accessories.
                                                    </p>
                                                )}
                                            </AccordionItem>

                                            {/* Customer Reviews */}
                                            <AccordionItem 
                                                id="reviews" 
                                                title={`Customer Reviews (${reviews.length > 0 ? reviews.length : '120+'})`}
                                                icon={<Star size={16} />}
                                            >
                                                <div className="space-y-6 mt-2">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-primary rounded-xl text-xs font-black border border-brand-100">
                                                            <Star size={14} fill="currentColor" />
                                                            {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '4.8'}
                                                        </div>
                                                    </div>

                                                    {/* Review Form - only if customer has purchased & delivered */}
                                                    {canReview === true ? (
                                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                                                        <h4 className="font-black text-slate-800 text-xs mb-3 flex items-center gap-2">
                                                            <MessageSquare size={13} className="text-primary" />
                                                            Rate this product
                                                        </h4>
                                                        <Button
                                                            type="button"
                                                            onClick={() => setShowReviewSheet(true)}
                                                            className="w-full h-10 bg-primary hover:opacity-90 text-white font-black rounded-xl text-[11px] uppercase tracking-[0.1em] transition-all shadow-lg shadow-brand-100"
                                                        >
                                                            Write a Review
                                                        </Button>
                                                    </div>
                                                    ) : canReview === false ? (
                                                    <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 mb-6 flex items-start gap-3">
                                                        <Star size={14} className="text-slate-300 mt-0.5 flex-shrink-0" />
                                                        <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">
                                                            {canReviewReason === 'already_reviewed'
                                                                ? 'You have already submitted a review for this product. Thank you!'
                                                                : 'Only customers who have purchased and received this product can leave a review.'}
                                                        </p>
                                                    </div>
                                                    ) : null}

                                                    {/* Reviews List */}
                                                    <div className="space-y-3">
                                                        {reviewLoading ? (
                                                            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={20} /></div>
                                                        ) : reviews.length > 0 ? (
                                                            reviews.map((r, rIdx) => (
                                                                <div key={r._id} className="p-4 rounded-xl border border-slate-100 bg-white hover:shadow-md hover:translate-x-1 transition-all group">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-8 w-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-black text-primary border border-brand-100">{r.userId?.name?.[0] || 'A'}</div>
                                                                            <div>
                                                                                <p className="text-[12px] font-black text-slate-800">{r.userId?.name || 'Anonymous'}</p>
                                                                                <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={9} className={cn(i < r.rating ? 'text-primary fill-primary' : 'text-slate-200')} />)}</div>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-slate-400">{formatDate(r.createdAt)}</span>
                                                                    </div>
                                                                    <div className="pl-10">
                                                                        <p className="text-[12px] text-slate-600 font-medium leading-relaxed">{r.comment}</p>
                                                                        
                                                                        {((r.images && r.images.length > 0) || r.video) && (
                                                                            <div className="flex gap-2 mt-3 overflow-x-auto pb-2 custom-scrollbar">
                                                                                {r.images?.map((img, i) => (
                                                                                    <a href={img} target="_blank" rel="noopener noreferrer" key={i} className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100 bg-slate-50 cursor-zoom-in hover:opacity-90 transition-opacity block">
                                                                                        <img src={applyCloudinaryTransform(img)} alt={`Review ${i}`} className="w-full h-full object-cover" />
                                                                                    </a>
                                                                                ))}
                                                                                {r.video && (
                                                                                    <video src={r.video} controls preload="metadata" className="h-16 w-auto max-w-[160px] rounded-xl border border-slate-100 bg-black flex-shrink-0 object-contain" />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                                <MessageSquare size={20} className="text-slate-300 mx-auto mb-2" />
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No reviews yet — be the first!</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionItem>
                                        </div>

                                        {/* Bottom spacer */}
                                        <div className="h-6" />
                                    </div>
                                </div>
                            </div>
                        </div>
                </>
            )}

            <AnimatePresence>
                {showReviewSheet && selectedProduct && (
                    <WriteReviewSheet
                        isOpen={showReviewSheet}
                        onClose={(submittedReview) => {
                            setShowReviewSheet(false);
                            if (submittedReview) {
                                setCanReview(false);
                                setCanReviewReason('already_reviewed');
                                fetchReviews(selectedProduct.id);
                            }
                        }}
                        product={{ ...selectedProduct, productId: selectedProduct.id }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProductDetailPage;


