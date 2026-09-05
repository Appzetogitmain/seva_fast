import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import { useInViewAnimation } from "@/core/hooks/useInViewAnimation";
import { useCart } from "../context/CartContext";
import { useAuth } from "../../../core/context/AuthContext";
import { decodeToken } from "@/core/utils/token";
import { useWishlist } from "../context/WishlistContext";
import { customerApi } from "../services/customerApi";
import { useLocation as useAppLocation } from "../context/LocationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { cn } from "@/lib/utils";
import {
  loadRazorpayScript,
  launchOrderRazorpayPayment,
  resolveRazorpayCheckoutPayload,
} from "@shared/utils/razorpayCheckout";
import {
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  ChevronRight,
  ChevronLeft,
  Share2,
  Gift,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Heart,
  Truck,
  Tag,
  Sparkles,
  Plus,
  Minus,
  Search,
  X,
  Clipboard,
  Check,
  Contact2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import SlideToPay from "../components/shared/SlideToPay";
import { getCachedGeocode, setCachedGeocode } from "@/core/utils/geocodeCache";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
} from "@/core/services/orderSocket";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


// Sub-components
import CheckoutAddressSection from "./checkout/components/CheckoutAddressSection";

import CheckoutCartSummary from "./checkout/components/CheckoutCartSummary";
import CheckoutPricingBreakdown from "./checkout/components/CheckoutPricingBreakdown";
import CheckoutPaymentSelector from "./checkout/components/CheckoutPaymentSelector";
import CheckoutCouponSection from "./checkout/components/CheckoutCouponSection";
import CheckoutRecommendedProducts from "./checkout/components/CheckoutRecommendedProducts";
import CheckoutWishlistSection from "./checkout/components/CheckoutWishlistSection";
import CheckoutOrderSuccess from "./checkout/components/CheckoutOrderSuccess";

// Scoped per logged-in customer (see checkoutAddressStorageKey below) so a
// different account on the same device never sees a previous customer's
// last-used checkout address.
const CHECKOUT_ADDRESS_STORAGE_PREFIX = "sevafast_checkout_address_v1";

const createEmptyAddress = () => ({
  type: "Home",
  name: "",
  address: "",
  landmark: "",
  city: "",
  phone: "",
});

const getInitialCheckoutAddress = (storageKey) => {
  try {
    const saved =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(storageKey) ||
          window.localStorage.getItem(storageKey)
        : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.address || parsed.formattedAddress)) {
        return parsed;
      }
    }
  } catch {}
  return createEmptyAddress();
};

const normalizeRegisteredPhone = (phone) => {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+91")) return raw.replace(/^\+91[\s-]*/, "");
  if (raw.startsWith("91") && raw.length >= 12) return raw.replace(/^91[\s-]*/, "");
  return raw;
};

const CheckoutPage = () => {
  const {
    cart,
    addToCart,
    cartTotal,
    cartCount,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const { wishlist, addToWishlist, fetchFullWishlist, isFullDataFetched } =
    useWishlist();
  const { showToast } = useToast();
  const { user, token, isAuthenticated } = useAuth();
  const { settings } = useSettings();

  // Scope the cached checkout address to this account (falls back to a
  // shared "guest" scope while signed out) so a different customer logging
  // in on the same device never sees a previous account's last-used address.
  const customerId = useMemo(() => {
    if (!token) return null;
    return decodeToken(token)?.id || null;
  }, [token]);
  const checkoutAddressStorageKey = customerId
    ? `${CHECKOUT_ADDRESS_STORAGE_PREFIX}:${customerId}`
    : `${CHECKOUT_ADDRESS_STORAGE_PREFIX}:guest`;

  const wishlistSectionRef = useRef(null);
  const wishlistFetchedRef = useRef(false);

  // useInViewAnimation for floating/particle animation containers
  const { ref: emptyCartAnimRef, isVisible: emptyCartVisible } = useInViewAnimation();

  // Lazy-load wishlist via IntersectionObserver
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!("IntersectionObserver" in window)) {
      if (!wishlistFetchedRef.current) {
        wishlistFetchedRef.current = true;
        fetchFullWishlist();
      }
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !wishlistFetchedRef.current) {
          wishlistFetchedRef.current = true;
          fetchFullWishlist();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    if (wishlistSectionRef.current) observer.observe(wishlistSectionRef.current);
    return () => observer.disconnect();
  }, [isAuthenticated]);

  const appName = settings?.appName || "App";
  const {
    savedAddresses: locationSavedAddresses,
    currentLocation,
    isDefaultLocation,
    refreshLocation,
    isFetchingLocation,
    updateLocation,
    refreshAddresses,
  } = useAppLocation();
  const navigate = useNavigate();

  // State management
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("now");
  const [isExpressDelivery, setIsExpressDelivery] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [showAllCartItems, setShowAllCartItems] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isResolvingAddressCoords, setIsResolvingAddressCoords] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmountToUse, setWalletAmountToUse] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [pricingPreview, setPricingPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const postOrderNavigateRef = useRef(null);
  const previewDebounceRef = useRef(null);
  const [currentAddress, setCurrentAddress] = useState(() =>
    getInitialCheckoutAddress(checkoutAddressStorageKey),
  );
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [editAddressForm, setEditAddressForm] = useState(createEmptyAddress);
  const [showRecipientForm, setShowRecipientForm] = useState(false);
  const [recipientData, setRecipientData] = useState({
    completeAddress: "",
    landmark: "",
    pincode: "",
    name: "",
    phone: "",
  });
  const [savedRecipient, setSavedRecipient] = useState(null);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [emptyBoxData, setEmptyBoxData] = useState(null);

  // Dynamically load empty-box Lottie only when cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      import("../../../assets/lottie/Empty box.json")
        .then((m) => setEmptyBoxData(m.default))
        .catch(() => { });
    }
  }, [cart.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const paymentMethods = [
    ...(settings?.onlineEnabled === false
      ? []
      : [
        {
          id: "online",
          label: "Pay Online",
          icon: CreditCard,
          sublabel: "Razorpay • UPI / Cards / NetBanking",
          badge: "Razorpay",
        },
      ]),
    ...(settings?.codEnabled === false
      ? []
      : [
        {
          id: "cash",
          label: "Cash on Delivery",
          icon: Banknote,
          sublabel: "Pay after delivery",
        },
      ]),
  ];

  const discountAmount = selectedCoupon
    ? selectedCoupon.discountAmount || selectedCoupon.discount || 0
    : 0;

  const RECIPIENT_STORAGE_KEY = "sevafast_checkout_recipient_v1";

  const registeredName = user?.name || "";
  const registeredPhone = normalizeRegisteredPhone(
    user?.phone || user?.phoneNumber || "",
  );

  // Derived display values for primary delivery card
  const displayName = savedRecipient?.name || currentAddress.name || registeredName;
  const displayPhone =
    savedRecipient?.phone || currentAddress.phone || registeredPhone;
  const displayAddress = savedRecipient
    ? `${savedRecipient.completeAddress}${savedRecipient.landmark ? `, ${savedRecipient.landmark}` : ""}${savedRecipient.pincode ? ` - ${savedRecipient.pincode}` : ""}`
    : `${currentAddress.address || ""}${currentAddress.landmark ? `, ${currentAddress.landmark}` : ""}${currentAddress.city ? `, ${currentAddress.city}` : ""}`;

  // Sync currentAddress changes to persistent storage
  useEffect(() => {
    if (currentAddress && (currentAddress.address || currentAddress.formattedAddress)) {
      try {
        const toStore = JSON.stringify(currentAddress);
        window.sessionStorage.setItem(checkoutAddressStorageKey, toStore);
        window.localStorage.setItem(checkoutAddressStorageKey, toStore);
      } catch {}
    }
  }, [currentAddress]);

  useEffect(() => {
    if (!user) return;

    setCurrentAddress((prev) => ({
      ...prev,
      name: prev.name || registeredName,
      phone: prev.phone || registeredPhone,
    }));
    setEditAddressForm((prev) => ({
      ...prev,
      name: prev.name || registeredName,
      phone: prev.phone || registeredPhone,
    }));
  }, [registeredName, registeredPhone, user]);

  useEffect(() => {
    if (savedRecipient) return;
    // If currentAddress is already populated, do not overwrite it with old defaults
    if (currentAddress?.address) return;

    const primarySaved = locationSavedAddresses[0];
    // Never fall back to currentLocation while it's still the hardcoded
    // placeholder (no GPS/geocoded fix yet, or the user declined) — a brand
    // new customer with no saved address should see an empty address to fill
    // in, not a stranger's default location.
    const addressText =
      primarySaved?.address || (!isDefaultLocation ? currentLocation?.name : "") || "";
    if (!addressText) return;

    const cityText =
      [currentLocation?.city, currentLocation?.state, currentLocation?.pincode]
        .filter(Boolean)
        .join(", ") || "";

    setCurrentAddress((prev) => {
      if (prev.address) return prev;

      return {
        ...prev,
        name: prev.name || registeredName,
        phone: prev.phone || registeredPhone,
        address: addressText,
        city: cityText || prev.city,
        ...(primarySaved?.location
          ? { location: primarySaved.location }
          : !isDefaultLocation &&
            typeof currentLocation?.latitude === "number" &&
            typeof currentLocation?.longitude === "number"
            ? {
              location: {
                lat: currentLocation.latitude,
                lng: currentLocation.longitude,
              },
            }
            : {}),
      };
    });
  }, [
    currentAddress?.address,
    currentLocation?.city,
    currentLocation?.latitude,
    currentLocation?.longitude,
    currentLocation?.name,
    currentLocation?.pincode,
    currentLocation?.state,
    isDefaultLocation,
    locationSavedAddresses,
    registeredName,
    registeredPhone,
    savedRecipient,
  ]);

  useEffect(() => {
    if (!paymentMethods.length) return;
    const exists = paymentMethods.some((method) => method.id === selectedPayment);
    if (!exists) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  useEffect(() => {
    if (settings?.onlineEnabled === false) return;
    void loadRazorpayScript();
  }, [settings?.onlineEnabled]);

  useEffect(() => {
    if (useWallet && user?.walletBalance && pricingPreview?.grandTotal) {
      const maxAvailable = Number(user.walletBalance || 0);
      const totalToPay = Number(pricingPreview.grandTotal || 0);
      setWalletAmountToUse(Math.min(maxAvailable, totalToPay));
    } else {
      setWalletAmountToUse(0);
    }
  }, [useWallet, user?.walletBalance, pricingPreview?.grandTotal]);

  const hasInstant = cart.some((item) => (item.deliveryType || "instant") === "instant");
  const hasScheduled = cart.some((item) => item.deliveryType === "scheduled");
  const hasMixedCart = hasInstant && hasScheduled;

  const finalAmountToPay = Math.max(0, (pricingPreview?.grandTotal ?? cartTotal) - walletAmountToUse);
  const minimumOrderValue = Number(settings?.minimumOrderValue || 0);
  const checkoutSubtotal = Number(pricingPreview?.productSubtotal ?? cartTotal ?? 0);
  const minimumOrderShortfall =
    minimumOrderValue > 0 ? Math.max(0, minimumOrderValue - checkoutSubtotal) : 0;
  const isBelowMinimumOrder =
    minimumOrderValue > 0 && checkoutSubtotal < minimumOrderValue;
  const slideToPayText =
    hasMixedCart
      ? "Cannot checkout mixed cart"
      : finalAmountToPay === 0
        ? "Pay via Wallet"
        : selectedPayment === "online"
          ? "Slide to Pay"
          : "Slide to Place Order";

  const buildAddressForOrder = () => {
    if (savedRecipient) {
      return {
        type: "Other",
        name: savedRecipient.name,
        address: savedRecipient.completeAddress,
        landmark: savedRecipient.landmark || "",
        city: savedRecipient.pincode ? `${savedRecipient.pincode}` : "",
        phone: savedRecipient.phone,
        location:
          currentLocation?.latitude && currentLocation?.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : undefined,
      };
    }

    const addrLoc = currentAddress?.location;
    const hasAddrLoc =
      addrLoc &&
      typeof addrLoc.lat === "number" &&
      typeof addrLoc.lng === "number" &&
      Number.isFinite(addrLoc.lat) &&
      Number.isFinite(addrLoc.lng);

    return {
      ...currentAddress,
      name: registeredName || currentAddress.name,
      phone: registeredPhone || currentAddress.phone,
      location: hasAddrLoc ? { lat: addrLoc.lat, lng: addrLoc.lng } : undefined,
    };
  };

  const handleSaveRecipient = () => {
    if (
      !recipientData.completeAddress ||
      !recipientData.name ||
      recipientData.phone.length !== 10
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSavedRecipient(recipientData);
    setShowRecipientForm(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          RECIPIENT_STORAGE_KEY,
          JSON.stringify(recipientData),
        );
      }
    } catch {
      // ignore storage errors
    }
    showToast("Recipient details saved!", "success");
  };

  const handleMoveToWishlist = (item) => {
    addToWishlist(item);
    removeFromCart(item.id, item.variantSku);
    showToast(`${item.name} moved to wishlist`, "success");
  };
  const handleOpenEditAddress = () => {
    setEditAddressForm({
      ...currentAddress,
      name: currentAddress.name || registeredName || "",
      phone: currentAddress.phone || registeredPhone || "",
      address: currentAddress.address || "",
      landmark: currentAddress.landmark || "",
      city: currentAddress.city || "",
    });
    setIsEditAddressOpen(true);
  };

  const isValidLatLng = (loc) =>
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng);

  const resolveAddressCoords = async (addressText) => {
    const q = String(addressText || "").trim();
    if (!q) return null;

    try {
      const resp = await customerApi.geocodeAddress(q);
      const loc = resp.data?.result?.location;
      if (isValidLatLng(loc)) {
        return { lat: loc.lat, lng: loc.lng };
      }
    } catch {
      // ignore
    }

    return null;
  };

  const handleSelectSavedAddress = async (addr) => {
    const rawText = addr?.address || "";
    const addrLoc = addr?.location;
    const hasLoc = isValidLatLng(addrLoc);
    const pid = typeof addr?.placeId === "string" ? addr.placeId.trim() : "";

    setIsResolvingAddressCoords(true);
    try {
      let resolvedLoc = null;
      try {
        if (hasLoc) {
          resolvedLoc = addrLoc;
        } else if (pid) {
          const cacheKey = `pid:${pid}`;
          const cached = getCachedGeocode(cacheKey);
          if (cached?.location?.lat && cached?.location?.lng) {
            resolvedLoc = cached.location;
          } else {
            const resp = await customerApi.geocodePlaceId(pid);
            const loc = resp.data?.result?.location;
            if (isValidLatLng(loc)) {
              resolvedLoc = { lat: loc.lat, lng: loc.lng };
              setCachedGeocode(cacheKey, { location: resolvedLoc });
            }
          }
        } else {
          resolvedLoc = await resolveAddressCoords(rawText);
        }
      } catch (e) {
        showToast(
          e?.__serverMsg ||
          e?.message ||
          "Could not fetch coordinates for this address. Delivery charges may not update.",
          "error",
        );
      }

      if (!resolvedLoc) {
        showToast(
          "Could not fetch coordinates for this address. Please edit the address or choose a different one.",
          "error",
        );
        return;
      }

      const selectedObj = {
        type: addr.label || "Home",
        name: currentAddress.name || registeredName,
        address: rawText,
        city: addr.city || "",
        phone: currentAddress.phone || registeredPhone || addr.phone || "",
        landmark: addr.landmark || "",
        ...(pid ? { placeId: pid } : {}),
        ...(resolvedLoc ? { location: resolvedLoc } : {}),
      };

      setCurrentAddress(selectedObj);

      try {
        const toStore = JSON.stringify(selectedObj);
        window.sessionStorage.setItem(checkoutAddressStorageKey, toStore);
        window.localStorage.setItem(checkoutAddressStorageKey, toStore);
      } catch {}

      if (resolvedLoc) {
        updateLocation(
          {
            name: rawText,
            time: currentLocation?.time || "12-15 mins",
            city: currentLocation?.city,
            state: currentLocation?.state,
            pincode: currentLocation?.pincode,
            latitude: resolvedLoc.lat,
            longitude: resolvedLoc.lng,
          },
          { persist: true, updateSavedHome: true },
        );
      }

      setIsAddressModalOpen(false);
    } finally {
      setIsResolvingAddressCoords(false);
    }
  };

  const handleSaveEditedAddress = async () => {
    if (
      !editAddressForm.name?.trim() ||
      !editAddressForm.address?.trim() ||
      !editAddressForm.city?.trim()
    ) {
      showToast("Please fill name, complete address and city", "error");
      return;
    }

    let location = null;
    let placeId = null;
    let formattedAddress = null;
    const fullAddressString = `${editAddressForm.address}${editAddressForm.landmark ? `, ${editAddressForm.landmark}` : ""}, ${editAddressForm.city}`;

    try {
      const query = [
        editAddressForm.address,
        editAddressForm.landmark,
        editAddressForm.city,
      ]
        .filter(Boolean)
        .join(", ");
      const resp = await customerApi.geocodeAddress(query);
      const loc = resp.data?.result?.location;
      if (
        loc &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number" &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng)
      ) {
        location = { lat: loc.lat, lng: loc.lng };
        placeId = resp.data?.result?.placeId || null;
        formattedAddress = resp.data?.result?.formattedAddress || null;
      }
    } catch (e) {
      showToast(
        e.response?.data?.message ||
        "Could not fetch coordinates for this address. Delivery charges may be inaccurate.",
        "error",
      );
    }

    const updatedAddrObj = {
      ...editAddressForm,
      ...(location ? { location } : {}),
      ...(placeId ? { placeId } : {}),
      ...(formattedAddress ? { formattedAddress } : {}),
    };

    setCurrentAddress(updatedAddrObj);

    // Save immediately to persistent storage
    try {
      const toStore = JSON.stringify(updatedAddrObj);
      window.sessionStorage.setItem(checkoutAddressStorageKey, toStore);
      window.localStorage.setItem(checkoutAddressStorageKey, toStore);
    } catch {}

    // Save to user profile in backend if logged in
    try {
      const profileRes = await customerApi.getProfile();
      const profile = profileRes.data?.result ?? profileRes.data?.data ?? profileRes.data;
      const existingAddrs = Array.isArray(profile?.addresses) ? [...profile.addresses] : [];

      const newAddrPayload = {
        label: (editAddressForm.type || "home").toLowerCase(),
        fullAddress: editAddressForm.address,
        landmark: editAddressForm.landmark || "",
        city: editAddressForm.city || "",
        ...(location ? { location } : {}),
        ...(placeId ? { placeId } : {}),
        ...(formattedAddress ? { formattedAddress } : {}),
      };

      if (existingAddrs.length > 0) {
        existingAddrs[0] = { ...existingAddrs[0], ...newAddrPayload };
      } else {
        existingAddrs.push(newAddrPayload);
      }

      await customerApi.updateProfile({
        name: editAddressForm.name,
        phone: editAddressForm.phone || profile?.phone,
        addresses: existingAddrs,
      });
      refreshAddresses?.();
    } catch (err) {
      console.warn("Could not save address to profile:", err);
    }

    // Persist to LocationContext and localStorage so future checkouts & home screen use the edited address
    updateLocation(
      {
        name: formattedAddress || fullAddressString,
        time: currentLocation?.time || "12-15 mins",
        city: editAddressForm.city || currentLocation?.city,
        state: currentLocation?.state,
        pincode: currentLocation?.pincode,
        latitude: location?.lat ?? currentLocation?.latitude,
        longitude: location?.lng ?? currentLocation?.longitude,
      },
      { persist: true, updateSavedHome: true },
    );

    setIsEditAddressOpen(false);
    showToast("Delivery address updated", "success");
  };

  const handleUseCurrentLiveLocation = async () => {
    const result = await refreshLocation();

    if (result?.ok && result.location) {
      const liveLocation = result.location;
      setCurrentAddress((prev) => ({
        ...prev,
        name: registeredName || prev.name,
        phone: registeredPhone || prev.phone,
        address: liveLocation.name,
        landmark: "",
        city: [liveLocation.city, liveLocation.state, liveLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof liveLocation.latitude === "number" &&
          typeof liveLocation.longitude === "number"
          ? { location: { lat: liveLocation.latitude, lng: liveLocation.longitude } }
          : {}),
      }));
      showToast("Using your current live location", "success");
      return;
    }

    // Only reuse the cached location as a fallback if it's a real previously
    // detected position — never the hardcoded placeholder, which would be
    // misleading to present as "your last detected location".
    if (!isDefaultLocation && currentLocation?.name) {
      setCurrentAddress((prev) => ({
        ...prev,
        name: registeredName || prev.name,
        phone: registeredPhone || prev.phone,
        address: currentLocation.name,
        landmark: "",
        city: [currentLocation.city, currentLocation.state, currentLocation.pincode]
          .filter(Boolean)
          .join(", "),
        ...(typeof currentLocation.latitude === "number" &&
          typeof currentLocation.longitude === "number"
          ? { location: { lat: currentLocation.latitude, lng: currentLocation.longitude } }
          : {}),
      }));
      showToast("Using your last detected location", "success");
      return;
    }

    showToast(result?.error || "Unable to detect current location", "error");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${appName} Checkout`,
          text: `Hey! I am ordering some goodies from ${appName}.`,
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard!", "success");
    }
  };

  const handleApplyCoupon = async (coupon) => {
    try {
      const payload = {
        code: coupon.code,
        cartTotal,
        items: cart,
        customerId: user?._id,
      };
      const res = await customerApi.validateCoupon(payload);
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          ...coupon,
          ...data,
        });
        setIsCouponModalOpen(false);
        showToast(`Coupon ${coupon.code} applied!`, "success");
      } else {
        showToast(res.data.message || "Unable to apply coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to apply coupon",
        "error",
      );
    }
  };

  const handleApplyManualCode = async () => {
    if (!manualCode.trim()) {
      showToast("Please enter a coupon code", "error");
      return;
    }
    try {
      const res = await customerApi.validateCoupon({
        code: manualCode.trim(),
        cartTotal,
        items: cart,
        customerId: user?._id,
      });
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          code: manualCode.trim(),
          description: "Applied manually",
          ...data,
        });
        setIsCouponModalOpen(false);
        showToast(`Coupon ${manualCode.trim()} applied!`, "success");
      } else {
        showToast(res.data.message || "Invalid coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Invalid coupon",
        "error",
      );
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    showToast(`${product.name} added to cart!`, "success");
  };

  const getCartItem = (productId) => cart.find((item) => item.id === productId);

  // Stable key for recommended products effect — only changes when product IDs change
  const cartProductIdKey = useMemo(
    () =>
      cart
        .map((i) => i.id || i._id)
        .sort()
        .join(","),
    [cart]
  );

  // Load recipient from localStorage + fetch coupons on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(RECIPIENT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.completeAddress && parsed.name && parsed.phone) {
            setRecipientData(parsed);
            setSavedRecipient(parsed);
          }
        }
      }
    } catch {
      // ignore parse errors
    }

    const fetchCoupons = async () => {
      try {
        const res = await customerApi.getActiveCoupons();
        if (res.data.success) {
          const list = res.data.result || res.data.results || [];
          setCoupons(list);
        }
      } catch {
        // silently ignore
      }
    };
    fetchCoupons();
  }, []);

  // Debounced checkoutPreview — fires 400 ms after last dependency change
  useEffect(() => {
    if (!isAuthenticated || cart.length === 0) {
      setPricingPreview(null);
      return;
    }

    const buildPreviewPayload = () => ({
      items: cart.map((item) => ({
        product: item.id || item._id,
        name: item.name,
        variantSku: String(item.variantSku || "").trim(),
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      })),
      address: buildAddressForOrder(),
      discountTotal: discountAmount,
      taxTotal: 0,
      tipAmount: 0,
      paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
      timeSlot: selectedTimeSlot,
      isExpressDelivery,
    });

    const fetchPreview = async () => {
      try {
        setIsPreviewLoading(true);
        const res = await customerApi.checkoutPreview(buildPreviewPayload());
        if (res.data?.success) {
          setPricingPreview(res.data.result?.breakdown ?? null);
        }
      } catch (error) {
        console.error("Checkout preview failed", error);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(fetchPreview, 400);

    return () => clearTimeout(previewDebounceRef.current);
  }, [
    isAuthenticated,
    cart,
    selectedPayment,
    selectedTimeSlot,
    isExpressDelivery,
    discountAmount,
    savedRecipient,
    currentAddress,
    currentLocation,
  ]);

  // Recommended products — only re-fetches when the set of product IDs changes
  useEffect(() => {
    if (cart.length === 0) {
      setRecommendedProducts([]);
      return;
    }
    const categoryId = cart[0]?.categoryId?._id || cart[0]?.categoryId;
    if (!categoryId) return;

    const cartIds = new Set(cart.map((i) => i.id || i._id));
    customerApi
      .getProducts({ categoryId, limit: 10 })
      .then((res) => {
        if (res.data?.success) {
          const items = (res.data.result?.items || [])
            .map((p) => ({ ...p, id: p._id }))
            .filter((p) => !cartIds.has(p.id));
          setRecommendedProducts(items.slice(0, 8));
        }
      })
      .catch(() => { });
  }, [cartProductIdKey]);

  const handlePlaceOrder = async () => {
    if (isBelowMinimumOrder) {
      showToast(
        `Minimum order value is ₹${minimumOrderValue}. Add items worth ₹${Math.ceil(minimumOrderShortfall)} more.`,
        "error",
      );
      return;
    }

    if (!savedRecipient && !currentAddress?.address) {
      showToast("Please add a delivery address before placing your order", "error");
      setIsAddressModalOpen(true);
      return;
    }

    setIsPlacingOrder(true);
    try {
      if (selectedPayment === "online") {
        const scriptReady = await loadRazorpayScript();
        if (!scriptReady) {
          setIsPlacingOrder(false);
          showToast(
            "Razorpay could not be loaded. Check your internet connection and try again.",
            "error",
          );
          return;
        }
      }

      const taxAmount = pricingPreview?.taxTotal || 0;
      const orderData = {
        address: buildAddressForOrder(),
        paymentMode: selectedPayment === "online" ? "ONLINE" : "COD",
        discountTotal: discountAmount,
        couponId: selectedCoupon?.couponId || selectedCoupon?._id || null,
        taxTotal: taxAmount,
        tipAmount: 0,
        timeSlot: selectedTimeSlot,
        isExpressDelivery,
        walletAmount: walletAmountToUse,
        items: cart.map((item) => ({
          product: item.id || item._id,
          name: item.name,
          variantSku: String(item.variantSku || "").trim(),
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
      };

      const response = await customerApi.createOrder(orderData);

      if (response.data.success) {
        const result = response.data.result;
        const mainOrder =
          result.order ||
          (Array.isArray(result.orders) ? result.orders[0] : null);
        const mainOrderId = mainOrder?.orderId || result.orderId;
        const paymentRef =
          result.paymentRef || result.checkoutGroupId || mainOrderId;

        // Persist order address to LocationContext so next order default uses new address
        const usedAddress = orderData.address;
        if (usedAddress && usedAddress.address) {
          const addressStr = `${usedAddress.address}${usedAddress.landmark ? `, ${usedAddress.landmark}` : ""}${usedAddress.city ? `, ${usedAddress.city}` : ""}`;
          updateLocation(
            {
              name: addressStr,
              time: currentLocation?.time || "12-15 mins",
              city: usedAddress.city || currentLocation?.city,
              state: currentLocation?.state,
              pincode: currentLocation?.pincode,
              latitude: usedAddress.location?.lat ?? currentLocation?.latitude,
              longitude: usedAddress.location?.lng ?? currentLocation?.longitude,
            },
            { persist: true, updateSavedHome: true }
          );
        }

        // Clear temporary recipient override after placing order
        setSavedRecipient(null);
        try {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(RECIPIENT_STORAGE_KEY);
          }
        } catch {}

        if (!mainOrderId) {
          setIsPlacingOrder(false);
          showToast(
            "Order placed but ID not received. Checking order history...",
            "warning"
          );
          navigate("/orders");
          return;
        }

        if (selectedPayment === "online" && finalAmountToPay > 0) {
          try {
            const paymentRes = await customerApi.createPaymentOrder({
              orderRef: paymentRef,
              orderId: mainOrderId,
            });

            if (!paymentRes.data?.success) {
              throw new Error(
                paymentRes.data?.message || "Failed to initiate Razorpay payment",
              );
            }

            let paymentResult = paymentRes.data.result || {};
            let razorpayPayload = resolveRazorpayCheckoutPayload(paymentResult);

            if (!razorpayPayload.razorpayKey) {
              const configRes = await customerApi.getRazorpayConfig();
              const config = configRes.data?.result || {};
              paymentResult = {
                ...paymentResult,
                razorpayKey: config.razorpayKey || config.keyId,
              };
              razorpayPayload = resolveRazorpayCheckoutPayload(paymentResult);
            }

            if (!razorpayPayload.razorpayOrderId) {
              throw new Error("Razorpay order id was not returned by the server.");
            }

            const checkoutResult = await launchOrderRazorpayPayment({
              paymentResult,
              description: `Order #${String(mainOrderId).slice(-8)}`,
              prefill: {
                name: user?.name || "Customer",
                contact: user?.phone || "",
              },
              onVerified: async (response) => {
                const verifyRes = await customerApi.verifyPaymentClient({
                  merchantOrderId: response.razorpay_order_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  orderRef: paymentRef,
                });

                if (
                  !verifyRes.data?.success ||
                  verifyRes.data?.result?.status !== "CAPTURED"
                ) {
                  throw new Error(
                    verifyRes.data?.message || "Payment verification failed",
                  );
                }

                clearCart();
                showToast("Payment successful — order confirmed.", "success");
                setOrderId(mainOrderId);
                setShowSuccess(true);

                if (postOrderNavigateRef.current) {
                  clearTimeout(postOrderNavigateRef.current);
                }
                postOrderNavigateRef.current = setTimeout(() => {
                  postOrderNavigateRef.current = null;
                  setIsPlacingOrder(false);
                  navigate(`/orders/${mainOrderId}`);
                }, 3000);
              },
            });

            if (checkoutResult?.cancelled) {
              setIsPlacingOrder(false);
              showToast(
                "Razorpay payment cancelled. You can complete payment from order details.",
                "warning",
              );
            }
            return;
          } catch (payError) {
            setIsPlacingOrder(false);
            showToast(
              payError.response?.data?.message ||
              payError.message ||
              "Could not open Razorpay checkout. Please try again.",
              "error",
            );
            return;
          }
        }

        if (selectedPayment === "online" && finalAmountToPay === 0) {
          clearCart();
          showToast("Order placed — paid from wallet.", "success");
          setOrderId(mainOrderId);
          setShowSuccess(true);

          if (postOrderNavigateRef.current) {
            clearTimeout(postOrderNavigateRef.current);
          }
          postOrderNavigateRef.current = setTimeout(() => {
            postOrderNavigateRef.current = null;
            setIsPlacingOrder(false);
            navigate(`/orders/${mainOrderId}`);
          }, 3000);
          return;
        }

        // COD flow
        clearCart();
        showToast("Order placed — waiting for seller to accept.", "success");
        setOrderId(mainOrderId);
        setShowSuccess(true);

        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
        }
        postOrderNavigateRef.current = setTimeout(() => {
          postOrderNavigateRef.current = null;
          setIsPlacingOrder(false);
          navigate(`/orders/${mainOrderId}`);
        }, 3000);
      } else {
        setIsPlacingOrder(false);
        showToast(response.data.message || "Could not place order.", "error");
      }
    } catch (error) {
      setIsPlacingOrder(false);
      showToast(
        error.response?.data?.message ||
        "Failed to place order. Please try again.",
        "error"
      );
    }
  };

  // After order placement: WebSocket listener + single fallback fetch
  useEffect(() => {
    if (!orderId || !showSuccess) return undefined;

    const getToken = () => localStorage.getItem("auth_customer");
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    const applyCancelled = (order) => {
      if (order.workflowStatus === "CANCELLED" || order.status === "cancelled") {
        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
          postOrderNavigateRef.current = null;
        }
        setShowSuccess(false);
        showToast("Order cancelled — seller did not accept in time.", "error");
        navigate(`/orders/${orderId}`, { replace: true });
        return true;
      }
      return false;
    };

    // Single immediate check (covers WebSocket-unavailable case)
    customerApi
      .getOrderDetails(orderId)
      .then((r) => {
        if (r.data?.result) applyCancelled(r.data.result);
      })
      .catch(() => { });

    const off = onOrderStatusUpdate(getToken, (order) => applyCancelled(order));

    return () => {
      off();
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId, showSuccess]);

  // ─── Empty cart state ────────────────────────────────────────────────────────
  if (cart.length === 0 && !showSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Top Back Navigation for Empty Cart */}
        <div className="absolute top-6 left-6 z-30">
          <button
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/");
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all active:scale-95 shadow-sm border border-slate-200"
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
        </div>

        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-50/50 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-brand-100/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute top-40 -left-20 w-60 h-60 bg-yellow-100/40 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm mx-auto">
          <div ref={emptyCartAnimRef} className="relative w-56 h-56 md:w-64 md:h-64 mb-8 flex items-center justify-center">
            <motion.div
              animate={emptyCartVisible ? { y: [-8, 8, -8] } : { y: 0 }}
              transition={emptyCartVisible ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
              className="relative z-10 rounded-[2rem] bg-white/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-brand-100">
              {emptyBoxData ? (
                <Lottie animationData={emptyBoxData} loop className="h-36 w-36 md:h-44 md:w-44" />
              ) : (
                <div className="w-56 h-56" />
              )}
            </motion.div>
            <motion.div
              animate={emptyCartVisible ? { rotate: 360 } : { rotate: 0 }}
              transition={emptyCartVisible ? { duration: 20, repeat: Infinity, ease: "linear" } : { duration: 0 }}
              className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-full"
            />
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Your Cart is Empty</h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium">
            It feels lighter than air! <br />
            Explore our aisles and fill it with goodies.
          </p>
          <Link
            to="/"
            className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-primary to-[var(--brand-400)] text-white font-bold rounded-2xl overflow-hidden shadow-xl shadow-brand-600/20 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-2 text-lg">
              Start Shopping <ChevronRight size={20} />
            </span>
          </Link>
          <div className="mt-8 flex gap-6 text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Clock size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Fast Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Tag size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Daily Deals</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-50 rounded-2xl"><Sparkles size={20} /></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Fresh Items</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main checkout return ────────────────────────────────────────────────────
  const handleRemoveRecipient = () => {
    setSavedRecipient(null);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(RECIPIENT_STORAGE_KEY);
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] pb-32 pt-4 font-sans antialiased">
      {/* Order Success Overlay */}
      <CheckoutOrderSuccess orderId={orderId} show={showSuccess} />

      {/* Premium Header */}
      <div className="bg-gradient-to-br from-[var(--brand-700)] via-[var(--brand-600)] to-[var(--brand-400)] pt-6 pb-12 md:pb-24 relative z-10 shadow-lg md:rounded-b-[4rem] rounded-b-[2rem] overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-[100px] -mr-32 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-brand-400/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate("/");
              }}
              className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all active:scale-95 text-white font-bold text-sm shadow-sm"
              title="Go Back"
            >
              <ChevronLeft size={24} className="text-white" />
              <span className="hidden sm:inline font-semibold text-xs tracking-wider uppercase">Back</span>
            </button>

            <div className="flex flex-col items-center">
              <h1 className="text-xl md:text-3xl font-[1000] text-white tracking-tight uppercase">Checkout</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-1.5 w-1.5 bg-brand-400 rounded-full animate-pulse" />
                <p className="text-brand-100/90 text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">
                  {cartCount} {cartCount === 1 ? "Item" : "Items"} in Cart
                </p>
              </div>
            </div>

            <button
              onClick={handleShare}
              className="h-10 md:h-12 px-3 md:px-4 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all active:scale-95"
            >
              <Share2 size={20} className="text-white" />
              <span className="text-xs font-black text-white uppercase tracking-widest hidden sm:block">Share</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-12 md:-mt-16 lg:-mt-20 relative z-20">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">

          {/* Left Column */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6 pb-8">
            {/* Delivery Speed Selector */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mt-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Clock size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">
                    {isExpressDelivery ? "Express Delivery" : "Delivery in 12-15 mins"}
                  </h3>
                  <p className="text-sm text-slate-500">Shipment of {cartCount} items</p>
                </div>
              </div>
              {settings?.expressDeliveryEnabled !== false && !hasMixedCart && !hasScheduled && (
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setIsExpressDelivery(false)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      !isExpressDelivery ? "bg-white text-primary shadow-sm" : "text-slate-400"
                    )}>
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExpressDelivery(true)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      isExpressDelivery ? "bg-white text-primary shadow-sm" : "text-slate-400"
                    )}>
                    Express (1-2 hrs){settings?.expressDeliveryFee ? ` • ₹${settings.expressDeliveryFee}` : ""}
                  </button>
                </div>
              )}
            </div>

            {/* Address Section */}
            <CheckoutAddressSection
              currentAddress={currentAddress}
              savedRecipient={savedRecipient}
              savedAddresses={locationSavedAddresses}
              onSelectAddress={() => setIsAddressModalOpen(true)}
              onEditAddress={handleOpenEditAddress}
              onUseCurrentLocation={handleUseCurrentLiveLocation}
              isFetchingLocation={isFetchingLocation}
              showRecipientForm={showRecipientForm}
              onToggleRecipientForm={() => setShowRecipientForm((v) => !v)}
              recipientData={recipientData}
              onRecipientDataChange={setRecipientData}
              onSaveRecipient={handleSaveRecipient}
              onRemoveRecipient={handleRemoveRecipient}
              displayName={displayName}
              displayPhone={displayPhone}
              displayAddress={displayAddress}
            />

            {/* Cart Summary */}
            <CheckoutCartSummary
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveFromCart={removeFromCart}
              onMoveToWishlist={handleMoveToWishlist}
              showAll={showAllCartItems}
              onToggleShowAll={() => setShowAllCartItems((v) => !v)}
            />

            {/* Wishlist Section */}
            <CheckoutWishlistSection
              wishlist={wishlist}
              sectionRef={wishlistSectionRef}
            />

            {/* Recommended Products */}
            <CheckoutRecommendedProducts
              products={recommendedProducts}
              cart={cart}
              onAddToCart={handleAddToCart}
              onGetCartItem={getCartItem}
            />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-8 pb-32 lg:pb-8">
            {/* Coupon Section */}
            <CheckoutCouponSection
              coupons={coupons}
              selectedCoupon={selectedCoupon}
              manualCode={manualCode}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={() => setSelectedCoupon(null)}
              onManualCodeChange={setManualCode}
              isOpen={isCouponModalOpen}
              onOpenChange={setIsCouponModalOpen}
              onApplyManualCode={handleApplyManualCode}
            />

            {hasMixedCart && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-red-600 font-bold">
                  <AlertCircle className="h-5 w-5" />
                  Mixed Cart Detected
                </div>
                <p className="text-sm text-red-600">
                  You cannot checkout with both instant (local) and scheduled (global) items at the same time. Please checkout separately.
                </p>
              </div>
            )}

            {/* Pricing Breakdown */}
            <CheckoutPricingBreakdown
              pricingPreview={pricingPreview}
              isPreviewLoading={isPreviewLoading}
              walletAmountToUse={walletAmountToUse}
              finalAmountToPay={finalAmountToPay}
              cartTotal={cartTotal}
              selectedCoupon={selectedCoupon}
              discountAmount={discountAmount}
              isOnlinePayment={selectedPayment === "online"}
            />

            {/* Payment Selector */}
            <CheckoutPaymentSelector
              paymentMethods={paymentMethods}
              selectedPayment={selectedPayment}
              onSelectPayment={setSelectedPayment}
              useWallet={useWallet}
              onToggleWallet={() => setUseWallet((v) => !v)}
              walletBalance={user?.walletBalance || 0}
              walletAmountToUse={walletAmountToUse}
            />

            {isBelowMinimumOrder ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                Minimum order value is ₹{minimumOrderValue}. Add items worth ₹
                {Math.ceil(minimumOrderShortfall)} more to place this order.
              </div>
            ) : null}

            {/* Desktop Slide to Pay */}
            <div className="hidden lg:block">
              <SlideToPay
                amount={finalAmountToPay}
                onSuccess={handlePlaceOrder}
                isLoading={isPlacingOrder || isPreviewLoading}
                disabled={isPlacingOrder || isPreviewLoading || isBelowMinimumOrder || hasMixedCart}
                text={slideToPayText}
              />
              <p className="text-center text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-[0.1em]">
                {selectedPayment === "online"
                  ? "Secured by Razorpay"
                  : "Secure checkout"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer — Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-3xl touch-manipulation">
        <div className="max-w-4xl mx-auto">
          <SlideToPay
            amount={finalAmountToPay}
            onSuccess={handlePlaceOrder}
            isLoading={isPlacingOrder || isPreviewLoading}
            disabled={isPlacingOrder || isPreviewLoading || isBelowMinimumOrder || hasMixedCart}
            text={slideToPayText}
          />
        </div>
      </div>

      {/* Address Selection Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Delivery Address</DialogTitle>
            <DialogDescription>Choose where you want your order delivered.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {locationSavedAddresses.map((addr) => (
              <button
                key={addr.id}
                onClick={() => handleSelectSavedAddress(addr)}
                disabled={isResolvingAddressCoords}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${currentAddress.id === addr.id
                    ? "border-primary bg-brand-50 shadow-sm"
                    : "border-slate-100 bg-white hover:border-slate-200"
                  }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-full ${currentAddress.id === addr.id ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-500"}`}>
                    <MapPin size={16} />
                  </div>
                  <span className="font-black text-slate-800 uppercase tracking-widest text-[10px]">{addr.label}</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{registeredName || currentAddress.name}</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-1">{addr.address}</p>
                {(registeredPhone || addr.phone) && (
                  <p className="text-[11px] text-slate-400 font-medium">
                    Phone: {registeredPhone || addr.phone}
                  </p>
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full border-brand-600 text-brand-600 hover:bg-brand-50"
              onClick={() => navigate("/addresses")}>
              <Plus size={16} className="mr-2" /> Add New Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Current Address Modal */}
      <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
        <DialogContent className="sm:max-w-[425px] overflow-hidden p-0">
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="p-6">
            <DialogHeader>
              <DialogTitle>Edit Delivery Address</DialogTitle>
              <DialogDescription>Update the details of your current delivery address.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="grid gap-1">
                  <Label htmlFor="edit-name" className="text-xs font-semibold text-slate-700">Contact Name*</Label>
                  <Input
                    id="edit-name"
                    value={editAddressForm.name || ""}
                    onChange={(e) => setEditAddressForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="h-10 text-sm"
                    placeholder="Receiver's name"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="edit-phone" className="text-xs font-semibold text-slate-700">Phone Number*</Label>
                  <Input
                    id="edit-phone"
                    value={editAddressForm.phone || ""}
                    onChange={(e) => setEditAddressForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="h-10 text-sm"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="edit-address" className="text-xs font-semibold text-slate-700">Complete Address*</Label>
                <Input
                  id="edit-address"
                  value={editAddressForm.address || ""}
                  onChange={(e) => setEditAddressForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="h-10 text-sm"
                  placeholder="House, street, area"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="grid gap-1">
                  <Label htmlFor="edit-landmark" className="text-xs font-semibold text-slate-700">Nearest Landmark</Label>
                  <Input
                    id="edit-landmark"
                    value={editAddressForm.landmark || ""}
                    onChange={(e) => setEditAddressForm((prev) => ({ ...prev, landmark: e.target.value }))}
                    className="h-10 text-sm"
                    placeholder="e.g. Near City Mall"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="edit-city" className="text-xs font-semibold text-slate-700">City / Pincode*</Label>
                  <Input
                    id="edit-city"
                    value={editAddressForm.city || ""}
                    onChange={(e) => setEditAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                    className="h-10 text-sm"
                    placeholder="City, State, Pincode"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                onClick={() => setIsEditAddressOpen(false)}
                className="border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditedAddress}
                className="bg-primary hover:bg-[#0b721b] text-white font-bold">
                Save changes
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `,
        }}
      />
    </div>
  );
};

export default CheckoutPage;
