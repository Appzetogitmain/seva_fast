import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "../../../core/context/AuthContext";
import { toast } from "sonner";
import {
  cartItemUnitPrice,
  resolveVariantPricing as getVariantPricing,
  getAvailableStock,
} from "../utils/productPricing";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem("cart");
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error("Failed to load cart from localStorage", error);
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const pendingRequestsRef = React.useRef(0);
  const lsDebounceRef = useRef(null);

  // Clear cart locally when user logs out is handled by the useEffect dependency on isAuthenticated
  const normalizeBackendCart = (items) => {
    if (!items) return [];
    return items.map((item) => {
      const product = item.productId;
      const variantKey = String(item.variantSku || "").trim();
      const { price, salePrice, variantName } = getVariantPricing(product, variantKey);
      return {
        ...product,
        id: product?._id, // Normalize ID
        quantity: item.quantity,
        variantSku: variantKey,
        variantName,
        price,
        salePrice,
        image: product?.mainImage, // Handle mapping for frontend
      };
    });
  };

  const syncCart = (backendItems) => {
    // Only update state from backend if no more pending optimistic updates
    if (pendingRequestsRef.current === 0) {
      setCart(normalizeBackendCart(backendItems));
    }
  };

  const fetchCart = async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        const response = await customerApi.getCart();
        setCart(normalizeBackendCart(response.data.result.items));
      } catch (error) {
        console.error("Failed to fetch cart from backend", error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Fetch cart from backend on mount or authentication change
  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      // Clear cart state and load from local storage for guests
      try {
        const savedCart = localStorage.getItem("cart");
        setCart(savedCart ? JSON.parse(savedCart) : []);
      } catch (error) {
        setCart([]);
      }
    }
  }, [isAuthenticated]);

  // Save local cart to localStorage (fallback/guest mode) — debounced to 300 ms
  useEffect(() => {
    if (isAuthenticated) return;           // backend is source of truth

    clearTimeout(lsDebounceRef.current);
    lsDebounceRef.current = setTimeout(() => {
      localStorage.setItem("cart", JSON.stringify(cart));
    }, 300);

    return () => {
      if (isAuthenticated) return;
      // Flush on unmount — no data loss
      clearTimeout(lsDebounceRef.current);
      localStorage.setItem("cart", JSON.stringify(cart));
    };
  }, [cart, isAuthenticated]);

  const addToCart = async (product, { skipConfirm = false } = {}) => {
    // Bug 238 Check: Prevent multi-store ordering
    if (cart.length > 0) {
      const extractId = (val) => (val && typeof val === 'object' && val._id ? String(val._id) : String(val || ''));
      const existingSellerId = extractId(cart[0].sellerId) || extractId(cart[0].seller);
      const newSellerId = extractId(product.sellerId) || extractId(product.seller);

      if (existingSellerId && newSellerId && existingSellerId !== newSellerId) {
        // skipConfirm=true is used by chatbot to silently clear-and-replace
        if (!skipConfirm) {
          const confirmReplace = window.confirm(
            "Your cart contains items from another store. Do you want to clear your cart and add this item instead?"
          );
          if (!confirmReplace) return false;
        }

        // Clear cart first (backend + local)
        if (isAuthenticated) {
          try {
            await customerApi.clearCart();
          } catch (error) {
            console.error("Failed to clear backend cart:", error);
          }
        }
        setCart([]); // Reset local state
      }
    }

    const variantSku = String(product?.variantSku || product?.variantName || "").trim();
    const id = product.id || product._id;
    const key = `${id}::${variantSku || ""}`;
    const deltaQty = Math.max(1, Number(product?.quantity) || 1);

    const existingItem = cart.find(
      (item) => `${item.id || item._id}::${String(item.variantSku || "").trim()}` === key,
    );
    const currentQty = existingItem ? existingItem.quantity : 0;
    const mergedProduct = { ...existingItem, ...product };
    const maxStock = getAvailableStock(mergedProduct, variantSku);

    if (maxStock <= 0) {
      toast.error("This product is currently out of stock");
      return false;
    }

    if (currentQty + deltaQty > maxStock) {
      toast.error(`Cannot add more than available stock (${maxStock} in stock)`);
      return false;
    }

    const { price, salePrice, variantName } = getVariantPricing(product, variantSku);

    // Optimistic UI update for instant feedback
    setCart((prev) => {
      if (existingItem) {
        return prev.map((item) =>
          `${item.id || item._id}::${String(item.variantSku || "").trim()}` === key
            ? { ...item, quantity: item.quantity + deltaQty }
            : item,
        );
      }

      return [
        ...prev,
        {
          ...product,
          id,
          variantSku,
          variantName,
          price,
          salePrice,
          quantity: deltaQty,
          image: product.image || product.mainImage,
        },
      ];
    });

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        let response = null;
        try {
          response = await customerApi.addToCart({
            productId: id,
            variantSku,
            quantity: deltaQty,
          });
        } catch (apiErr) {
          const errMsg = String(apiErr?.response?.data?.message || apiErr?.message || "");
          if (skipConfirm || errMsg.toLowerCase().includes("another store")) {
            try {
              await customerApi.clearCart();
              response = await customerApi.addToCart({
                productId: id,
                variantSku,
                quantity: deltaQty,
              });
            } catch (retryErr) {
              throw retryErr;
            }
          } else {
            throw apiErr;
          }
        }
        pendingRequestsRef.current -= 1;
        if (response?.data?.result?.items) {
          await syncCart(response.data.result.items);
        }
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error adding to cart on backend", error);
        // Re-fetch entire cart to ensure consistency on error
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const batchAddToCart = async (items = [], { skipConfirm = false } = {}) => {
    if (!Array.isArray(items) || items.length === 0) return { success: false, message: "No items provided" };

    // Check multi-store constraint with first item
    if (cart.length > 0 && items[0]) {
      const extractId = (val) => (val && typeof val === 'object' && val._id ? String(val._id) : String(val || ''));
      const existingSellerId = extractId(cart[0].sellerId) || extractId(cart[0].seller);
      const newSellerId = extractId(items[0].sellerId) || extractId(items[0].seller);

      if (existingSellerId && newSellerId && existingSellerId !== newSellerId) {
        if (!skipConfirm) {
          const confirmReplace = window.confirm(
            "Your cart contains items from another store. Do you want to clear your cart and add these items instead?"
          );
          if (!confirmReplace) return { success: false, message: "Action cancelled" };
        }

        if (isAuthenticated) {
          try {
            await customerApi.clearCart();
          } catch (error) {
            console.error("Failed to clear backend cart:", error);
          }
        }
        setCart([]);
      }
    }

    if (isAuthenticated) {
      setLoading(true);
      try {
        const payload = items.map((it) => ({
          productId: it.productId || it.id || it._id,
          variantSku: String(it.variantSku || it.variantName || "").trim(),
          quantity: Math.max(Number(it.quantity) || 1, 1),
        }));

        let res;
        try {
          res = await customerApi.batchAddToCart({ items: payload });
        } catch (apiErr) {
          const errMsg = String(apiErr?.response?.data?.message || apiErr?.message || "");
          if (skipConfirm || errMsg.toLowerCase().includes("another store")) {
            await customerApi.clearCart();
            res = await customerApi.batchAddToCart({ items: payload });
          } else {
            throw apiErr;
          }
        }

        if (res?.data?.result?.cart?.items) {
          setCart(normalizeBackendCart(res.data.result.cart.items));
        } else {
          await fetchCart();
        }
        return { success: true, count: items.length };
      } catch (error) {
        console.error("Failed to batch add items to cart:", error);
        await fetchCart();
        return {
          success: false,
          message: error?.response?.data?.message || "Failed to add items to cart",
        };
      } finally {
        setLoading(false);
      }
    } else {
      // Guest mode: update local cart state
      setCart((prev) => {
        let updated = [...prev];
        items.forEach((item) => {
          const id = item.productId || item.id || item._id;
          const variantSku = String(item.variantSku || item.variantName || "").trim();
          const key = `${id}::${variantSku}`;
          const qty = Math.max(Number(item.quantity) || 1, 1);
          const { price, salePrice, variantName } = getVariantPricing(item, variantSku);

          const maxStock = getAvailableStock(item, variantSku);
          if (maxStock <= 0) return;

          const existingIndex = updated.findIndex(
            (ci) => `${ci.id || ci._id}::${String(ci.variantSku || "").trim()}` === key
          );

          if (existingIndex > -1) {
            const newQty = Math.min(updated[existingIndex].quantity + qty, maxStock);
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: newQty,
            };
          } else {
            updated.push({
              ...item,
              id,
              variantSku,
              variantName,
              price: item.price || price,
              salePrice: item.salePrice || salePrice,
              quantity: Math.min(qty, maxStock),
              image: item.image || item.mainImage,
            });
          }
        });
        return updated;
      });
      return { success: true, count: items.length };
    }
  };

  const removeFromCart = async (productId, variantSku = "") => {
    const normalizedVariantSku = String(variantSku || "").trim();
    const key = `${productId}::${normalizedVariantSku || ""}`;

    // Optimistic update (remove only the matching line when variantSku is provided).
    setCart((prev) =>
      prev.filter(
        (item) =>
          `${item.id || item._id}::${String(item.variantSku || "").trim()}` !==
          key,
      ),
    );

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.removeFromCart(
          productId,
          normalizedVariantSku,
        );
        pendingRequestsRef.current -= 1;
        await syncCart(response.data.result.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error removing from cart on backend", error);
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const updateQuantity = async (productId, delta, variantSku = "") => {
    const normalizedVariantSku = String(variantSku || "").trim();
    const key = `${productId}::${normalizedVariantSku || ""}`;
    const currentItem = cart.find(
      (item) =>
        `${item.id || item._id}::${String(item.variantSku || "").trim()}` === key,
    );
    if (!currentItem) return;

    const newQty = Math.max(0, currentItem.quantity + delta);

    if (newQty === 0) {
      removeFromCart(productId, normalizedVariantSku);
      return;
    }

    if (delta > 0) {
      const maxStock = getAvailableStock(currentItem, normalizedVariantSku);
      if (newQty > maxStock) {
        toast.error(`Cannot exceed available stock (${maxStock} in stock)`);
        return false;
      }
    }

    // Optimistic update
    setCart((prev) =>
      prev.map((item) => {
        if (
          `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
          key
        ) {
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );

    if (isAuthenticated) {
      pendingRequestsRef.current += 1;
      try {
        const response = await customerApi.updateCartQuantity({
          productId,
          quantity: newQty,
          variantSku: normalizedVariantSku,
        });
        pendingRequestsRef.current -= 1;
        await syncCart(response.data.result.items);
      } catch (error) {
        pendingRequestsRef.current -= 1;
        console.error("Error updating quantity on backend", error);
        if (pendingRequestsRef.current === 0) {
          await fetchCart();
        }
      }
    }
  };

  const clearCart = async () => {
    if (isAuthenticated) {
      try {
        await customerApi.clearCart();
        setCart([]);
      } catch (error) {
        console.error("Error clearing cart on backend", error);
      }
    } else {
      setCart([]);
    }
  };

  const cartTotal = cart.reduce((total, item) => {
    return total + cartItemUnitPrice(item) * Number(item.quantity || 0);
  }, 0);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const cartValue = useMemo(() => ({
    cart,
    addToCart,
    batchAddToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal,
    cartCount,
    loading,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cart, cartTotal, cartCount, loading]);

  return (
    <CartContext.Provider value={cartValue}>
      {children}
    </CartContext.Provider>
  );
};
