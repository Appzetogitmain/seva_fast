import React from "react";
import { Heart, Plus, Minus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  hasProductVariants,
  variantIdentityKey,
  variantEffectiveUnitPrice,
  pickListingVariant,
} from "../../utils/productPricing";

const ProductCard = React.memo(
  ({ product, badge, className, compact = false, neutralBg = false }) => {
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } =
      useWishlist();
    const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
    const { showToast } = useToast();
    const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();

    const navigate = useNavigate();
    const [showHeartPopup, setShowHeartPopup] = React.useState(false);

    const imageRef = React.useRef(null);

    const requiresVariantSelection =
      product?.hasVariants ?? hasProductVariants(product);

    const productId = product.id || product._id;

    const defaultVariant = React.useMemo(() => {
      if (!requiresVariantSelection) return null;
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (!variants.length) return null;

      const listingSku = String(product?.listingVariantSku || "").trim();
      if (listingSku) {
        const listingVariant = variants.find(
          (variant) => variantIdentityKey(variant) === listingSku,
        );
        if (listingVariant) return listingVariant;
      }

      const targetPrice = Number(product?.price || 0);
      const pricedVariant = variants.find(
        (variant) => variantEffectiveUnitPrice(variant) === targetPrice,
      );
      return pricedVariant || pickListingVariant(product)?.variant || variants[0];
    }, [
      product?.variants,
      product?.price,
      product?.listingVariantSku,
      requiresVariantSelection,
    ]);

    const defaultVariantSku = defaultVariant
      ? variantIdentityKey(defaultVariant)
      : "";

    const displayPrice = defaultVariant
      ? (Number(defaultVariant.salePrice) > 0 && Number(defaultVariant.salePrice) < Number(defaultVariant.price)
        ? Number(defaultVariant.salePrice)
        : Number(defaultVariant.price))
      : Number(product.price || 0);

    const displayOriginalPrice = defaultVariant
      ? Number(defaultVariant.price || 0)
      : Number(product.originalPrice || product.basePrice || product.mrp || 0);

    const cartKey = `${productId}::${requiresVariantSelection ? defaultVariantSku : ""}`;

    const cartItem = React.useMemo(() => {
      return cart.find(
        (item) =>
          `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
          cartKey,
      );
    }, [cart, cartKey]);

    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = isInWishlist(product.id || product._id);

    const handleProductClick = React.useCallback(
      (e) => {
          e.preventDefault();
          navigate(`/product/${product.id || product._id}`);
      },
      [navigate, product],
    );

    const toggleWishlist = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isWishlisted) {
          setShowHeartPopup(true);
          setTimeout(() => setShowHeartPopup(false), 1000);
        }

        toggleWishlistGlobal(product);
        showToast(
          isWishlisted
            ? `${product.name} removed from wishlist`
            : `${product.name} added to wishlist`,
          isWishlisted ? "info" : "success",
        );
      },
      [isWishlisted, toggleWishlistGlobal, product, showToast],
    );

    const handleAddToCart = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (requiresVariantSelection && !defaultVariant) {
          navigate(`/product/${product.id || product._id}`);
          return;
        }

        if (imageRef.current) {
          animateAddToCart(
            imageRef.current.getBoundingClientRect(),
            product.image,
          );
        }
        addToCart({
          ...product,
          variantSku: defaultVariantSku,
        });
      },
      [
        animateAddToCart,
        product,
        addToCart,
        requiresVariantSelection,
        defaultVariant,
        defaultVariantSku,
        defaultVariantSku,
        navigate,
      ],
    );

    const handleIncrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateQuantity(productId, 1, defaultVariantSku);
      },
      [updateQuantity, productId, defaultVariantSku],
    );

    const handleDecrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (quantity === 1) {
          animateRemoveFromCart(product.image);
          removeFromCart(productId, defaultVariantSku);
        } else {
          updateQuantity(productId, -1, defaultVariantSku);
        }
      },
      [
        quantity,
        animateRemoveFromCart,
        product.image,
        removeFromCart,
        productId,
        defaultVariantSku,
        updateQuantity,
      ],
    );

    return (
      <div
        className={cn(
          "flex-shrink-0 w-full rounded-xl sm:rounded-2xl overflow-hidden flex flex-col h-full shadow-sm cursor-pointer transition-all duration-300 hover:scale-[1.02]",
          compact
            ? "bg-white border-[1.5px] border-brand-50 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)]"
            : neutralBg
              ? "bg-white border border-slate-100 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)]"
              : "bg-primary/10 border border-primary/20",
          className,
        )}
        onClick={handleProductClick}>
        <div className="relative">
          {(badge ||
            product.discount ||
            displayOriginalPrice > displayPrice) && (
              <div
                className={cn(
                  "absolute z-10 bg-primary text-primary-foreground font-[900] rounded-md shadow-sm uppercase tracking-wider flex items-center justify-center",
                  compact
                    ? "top-2 left-2 px-1.5 py-0.5 text-[7px]"
                    : "top-2 left-2 px-1 py-0.5 text-[7px] sm:top-3 sm:left-3 sm:px-2 sm:py-1 sm:text-[9px]",
                )}>
                {badge ||
                  product.discount ||
                  `${Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100)}% OFF`}
              </div>
            )}

          <button
            onClick={toggleWishlist}
            className={cn(
              "absolute z-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-white transition-all active:scale-90",
              compact
                ? "top-2 right-2 h-7 w-7"
                : "top-2 right-2 h-6.5 w-6.5 sm:top-3 sm:right-3 sm:h-8 sm:w-8",
            )}>
            <motion.div
              whileTap={{ scale: 0.8 }}
              animate={isWishlisted ? { scale: [1, 1.2, 1] } : {}}>
              <Heart
                size={compact ? 12 : 14}
                className={cn(
                  isWishlisted
                    ? "text-red-500 fill-current"
                    : "text-neutral-400",
                )}
              />
            </motion.div>
          </button>

          <AnimatePresence>
            {showHeartPopup && (
              <motion.div
                initial={{ scale: 0.5, opacity: 1, y: 0 }}
                animate={{ scale: 2, opacity: 0, y: -40 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute top-3 right-3 z-50 pointer-events-none text-red-500">
                <Heart size={24} fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={cn(
              "block w-full overflow-hidden flex items-center justify-center transition-transform duration-500 group-hover:scale-105 aspect-square",
              compact || neutralBg ? "bg-white/70" : "bg-white/50",
            )}>
            <img
              ref={imageRef}
              src={applyCloudinaryTransform(product.image)}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover mix-blend-multiply"
            />
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col flex-1",
            compact
              ? "p-2 pt-1 gap-0"
              : "bg-white/40 p-1.5 pt-2 sm:p-3 sm:pt-4 gap-0.5",
          )}>
          <div className="flex items-center gap-1 mb-0.5 sm:gap-1.5 sm:mb-1">
            <div
              className={cn(
                "border-2 border-primary rounded-full flex items-center justify-center",
                compact ? "h-2.5 w-2.5" : "h-2.5 w-2.5 sm:h-3.5 sm:w-3.5",
              )}>
              <div
                className={cn(
                  "bg-primary rounded-full",
                  compact ? "h-0.5 w-0.5" : "h-1 w-1",
                )}
              />
            </div>
            <div
              className={cn(
                "bg-brand-50 text-brand-600 font-bold rounded px-1.5 py-0 tracking-wide",
                compact ? "text-[8px]" : "text-[8px] sm:text-[9px]",
              )}>
              {product.weight || "1 unit"}
            </div>
          </div>

          <div className={cn(compact ? "h-8" : "h-8 sm:h-9")}>
            <h4
              className={cn(
                "font-[600] text-[#1A1A1A] leading-tight line-clamp-2",
                compact ? "text-[10.5px]" : "text-[12px] sm:text-[13px]",
              )}>
              {product.name}
            </h4>
          </div>

          <div className="flex items-center gap-1 text-gray-500 mt-0.5 mb-1 sm:gap-1.5 sm:mt-1 sm:mb-2">
            <Clock size={compact ? 9 : 10} className="text-primary/80" />
            <span
              className={cn(
                "font-semibold",
                compact ? "text-[8px]" : "text-[9px] sm:text-[10px]",
              )}>
              {product.deliveryTime || "8-12 mins"}
            </span>
          </div>

          <div className="mt-auto flex items-center justify-between gap-1">
            <div className="flex flex-col">
              <span
                className={cn(
                  "font-[1000] text-[#1A1A1A]",
                  compact ? "text-[11px]" : "text-[13px] sm:text-sm",
                )}>
                ₹{displayPrice}
              </span>
              {displayOriginalPrice > displayPrice && (
                <span
                  className={cn(
                    "font-medium text-gray-400 line-through leading-none",
                    compact ? "text-[8px]" : "text-[9px] sm:text-[10px]",
                  )}>
                  ₹{displayOriginalPrice}
                </span>
              )}
            </div>

            <div className="flex">
              {quantity > 0 ? (
                <div
                  className={cn(
                    "flex items-center bg-white border-[1.5px] border-primary rounded-lg p-0.5 justify-between",
                    compact
                      ? "min-w-[60px]"
                      : "min-w-[68px] sm:min-w-[90px] md:min-w-[100px]",
                  )}>
                  <button
                    onClick={handleDecrement}
                    className="p-0.5 px-0.5 text-primary active:scale-90 transition-transform sm:p-1 sm:px-1">
                    <Minus size={compact ? 10 : 12} strokeWidth={3.5} />
                  </button>
                  <span
                    className={cn(
                      "font-black text-primary",
                      compact
                        ? "text-[10px]"
                        : "text-[11px] sm:text-[13px] md:text-sm",
                    )}>
                    {quantity}
                  </span>
                  <button
                    onClick={handleIncrement}
                    className="p-0.5 px-0.5 text-primary active:scale-90 transition-transform sm:p-1 sm:px-1">
                    <Plus size={compact ? 10 : 12} strokeWidth={3.5} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  className={cn(
                    "bg-white border-[1.5px] border-primary text-primary rounded-lg font-black shadow-sm hover:bg-primary/5 mb-0 transition-all uppercase tracking-wide leading-none active:scale-95",
                    compact
                      ? "px-2.5 py-1 text-[10px]"
                      : "px-3.5 py-1.5 text-[11px] sm:px-7 sm:py-2 sm:text-[13px] md:text-sm md:px-8 md:py-2.5",
                  )}>
                  ADD
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default ProductCard;
