import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { UserRole } from "@core/constants/roles";
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  Store,
  ShoppingBag,
  TrendingUp,
  Rocket,
  Globe,
  MapPin,
  LayoutList,
  FileText,
  Upload,
  CheckCircle,
  Navigation,
  Loader2,
  Eye,
  EyeOff,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import Lottie from "lottie-react";
import sellerAnimation from "../../../assets/INSTANT_6.json";
import { sellerApi } from "../services/sellerApi";
import MapPicker from "../../../shared/components/MapPicker";

const createInitialVerificationState = () => ({
  status: "idle",
  otp: "",
  token: "",
  isOtpVisible: false,
  isSending: false,
  isVerifying: false,
  verifiedValue: "",
});

const REQUIRED_DOCUMENT_CONFIG = [
  { id: "addressProof", label: "Address Proof" },
  { id: "cancelledCheque", label: "Cancelled Cheque" },
  { id: "tradeLicense", label: "Trade License" },
];

const OPTIONAL_DOCUMENT_CONFIG = [
  { id: "gstCertificate", label: "GST Certificate (Optional)" },
];

const createInitialFormData = () => ({
  email: "",
  password: "",
  name: "",
  shopName: "",
  phone: "",
  locality: "",
  pincode: "",
  city: "",
  state: "",
  category: "",
  description: "",
  lat: null,
  lng: null,
  radius: 5,
  address: "",
  whatsappNumber: "",
  businessType: "Proprietorship",
  sellerType: "Retailer",
  panNumber: "",
  aadhaarNumber: "",
  gstinNumber: "",
  udyamNumber: "",
  yearsInBusiness: "",
  expectedMonthlyOrders: "",
  accountHolderName: "",
  bankName: "",
  branch: "",
  accountNumber: "",
  ifscCode: "",
});

const createInitialDocuments = () => ({
  tradeLicense: null,
  gstCertificate: null,
  idProof: null,
  panCard: null,
  addressProof: null,
  cancelledCheque: null,
});

const isValidAccountNumber = (val) => /^\d{9,18}$/.test(String(val || "").trim());
const isValidIFSC = (val) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(val || "").trim().toUpperCase());
const isValidPAN = (val) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(val || "").trim().toUpperCase());
const isValidAadhaar = (val) => /^\d{12}$/.test(String(val || "").trim());
const isValidGSTIN = (val) => {
  const v = String(val || "").trim().toUpperCase();
  return !v || (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v) || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$/.test(v));
};
const isValidUdyam = (val) => {
  const v = String(val || "").trim().toUpperCase();
  if (!v) return true;
  const isUdyam = /^UDYAM-[A-Z]{2}-\d{1,3}-\d{4,9}$/i.test(v) || /^UDYAM[A-Z]{2}\d{5,10}$/i.test(v) || /^[A-Z]{2}-\d{1,3}-\d{4,9}$/i.test(v);
  const isShopAct = /^[A-Z0-9\/-]{3,25}$/i.test(v);
  return isUdyam || isShopAct;
};

const Auth = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search || "");
  const shouldOpenSignup = searchParams.get("mode") === "signup";
  const [isLogin, setIsLogin] = useState(!shouldOpenSignup);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const { login, user, isAuthenticated, isLoading: authLoading, role, token } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl || "";
  const isProcessing = useRef(false);

  const isSwitchingAccount = searchParams.get("switch") === "true" || searchParams.get("logout") === "true";
  const [checkingExistingSession, setCheckingExistingSession] = useState(
    !isSwitchingAccount && !shouldOpenSignup && (
      Boolean(user) ||
      (typeof localStorage !== "undefined" && Boolean(localStorage.getItem("auth_seller") || localStorage.getItem("pending_seller_id")))
    )
  );

  useEffect(() => {
    if (!checkingExistingSession) return;
    let isCancelled = false;

    const verifySession = async () => {
      const storedToken =
        token ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("auth_seller")
          : null);
      const storedPendingId =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("pending_seller_id")
          : null;

      // 1. If user is in AuthContext
      if (user && (role === "seller" || storedToken)) {
        const isApproved =
          user.isVerified === true &&
          user.isActive === true &&
          (user.applicationStatus === "approved" || !user.applicationStatus);

        if (!isCancelled) {
          if (isApproved) {
            navigate("/seller", { replace: true });
          } else {
            navigate("/seller/pending-approval", { replace: true });
          }
        }
        return;
      }

      // If AuthContext is still loading profile, wait
      if (authLoading) return;

      // 2. If stored pending ID exists, query live status
      if (storedPendingId) {
        try {
          const res = await sellerApi.checkApprovalStatus({ sellerId: storedPendingId });
          const result = res?.data?.result;
          if (!isCancelled) {
            if (result?.isApproved === true || result?.applicationStatus === "approved") {
              navigate("/seller", { replace: true });
              return;
            } else if (result?.applicationStatus === "pending" || result?.applicationStatus === "rejected") {
              navigate("/seller/pending-approval", {
                replace: true,
                state: {
                  approvalRequired: true,
                  applicationStatus: result.applicationStatus,
                  sellerId: storedPendingId,
                  rejectionReason: result.rejectionReason,
                },
              });
              return;
            }
          }
        } catch {
          if (!isCancelled) {
            navigate("/seller/pending-approval", { replace: true });
            return;
          }
        }
      }

      // 3. If stored token exists, fetch profile
      if (storedToken) {
        try {
          const res = await sellerApi.getProfile();
          const seller = res?.data?.result;
          if (seller && !isCancelled) {
            const isApproved =
              seller.isVerified === true &&
              seller.isActive === true &&
              (seller.applicationStatus === "approved" || !seller.applicationStatus);
            if (isApproved) {
              navigate("/seller", { replace: true });
              return;
            } else {
              navigate("/seller/pending-approval", {
                replace: true,
                state: {
                  approvalRequired: true,
                  applicationStatus: seller.applicationStatus || "pending",
                  sellerId: seller._id,
                  rejectionReason: seller.rejectionReason,
                },
              });
              return;
            }
          }
        } catch (err) {
          if (err?.response?.status === 403 && !isCancelled) {
            navigate("/seller/pending-approval", { replace: true });
            return;
          }
        }
      }

      if (!isCancelled) {
        setCheckingExistingSession(false);
      }
    };

    verifySession();

    return () => {
      isCancelled = true;
    };
  }, [checkingExistingSession, user, role, authLoading, token, navigate]);

  const [verifications, setVerifications] = useState({
    email: createInitialVerificationState(),
    phone: createInitialVerificationState(),
  });

  const [formData, setFormData] = useState(createInitialFormData);
  const [documents, setDocuments] = useState(createInitialDocuments);

  const resetSignupForm = useCallback(() => {
    setFormData(createInitialFormData());
    setDocuments(createInitialDocuments());
    setVerifications({
      email: createInitialVerificationState(),
      phone: createInitialVerificationState(),
    });
    setSignupStep(1);
  }, []);

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address,
      locality: location.locality || prev.locality,
      pincode: location.pincode || prev.pincode,
      city: location.city || prev.city,
      state: location.state || prev.state,
    }));
  };

  const getMissingRequiredDocuments = () => {
    const missing = REQUIRED_DOCUMENT_CONFIG.filter((doc) => !documents[doc.id]);
    if (!documents.panCard && !documents.idProof) {
      missing.push({ id: "panCard", label: "PAN Card or Aadhaar Card" });
    }
    return missing;
  };

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [fpStep, setFpStep] = useState("email"); // email | otp | reset
  const [fpEmail, setFpEmail] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpResetToken, setFpResetToken] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpConfirmPassword, setFpConfirmPassword] = useState("");
  const [fpShowNewPassword, setFpShowNewPassword] = useState(false);
  const [fpShowConfirmPassword, setFpShowConfirmPassword] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);

  // Keep refs up-to-date for popstate event listener
  const isLoginRef = useRef(isLogin);
  const signupStepRef = useRef(signupStep);
  const isMapOpenRef = useRef(isMapOpen);
  const forgotPasswordOpenRef = useRef(forgotPasswordOpen);

  useEffect(() => {
    isLoginRef.current = isLogin;
  }, [isLogin]);

  useEffect(() => {
    signupStepRef.current = signupStep;
  }, [signupStep]);

  useEffect(() => {
    isMapOpenRef.current = isMapOpen;
  }, [isMapOpen]);

  useEffect(() => {
    forgotPasswordOpenRef.current = forgotPasswordOpen;
  }, [forgotPasswordOpen]);

  // Synchronize history state on mount so pressing back doesn't trigger native/Flutter "exit app"
  useEffect(() => {
    const currentState = window.history.state;
    if (!currentState?.sellerAuth) {
      if (shouldOpenSignup) {
        // Base state is login, active state is signup step 1
        window.history.replaceState({ sellerAuth: true, mode: "login", step: 1 }, "");
        window.history.pushState({ sellerAuth: true, mode: "signup", step: 1 }, "");
      } else {
        window.history.replaceState({ sellerAuth: true, mode: "login", step: 1 }, "");
      }
    }
  }, [shouldOpenSignup]);

  // Centralized go-back handler for both on-screen buttons and popstate
  const handleGoBack = useCallback(() => {
    if (isMapOpenRef.current) {
      if (window.history.state?.isMapOpen) {
        window.history.back();
      } else {
        setIsMapOpen(false);
      }
      return;
    }

    if (forgotPasswordOpenRef.current) {
      if (fpStep === "reset") {
        setFpStep("otp");
        return;
      }
      if (fpStep === "otp") {
        setFpStep("email");
        return;
      }
      if (window.history.state?.forgotPasswordOpen) {
        window.history.back();
      } else {
        setForgotPasswordOpen(false);
      }
      return;
    }

    if (!isLoginRef.current) {
      if (signupStepRef.current > 1) {
        // Go back one step in browser history
        if (window.history.state?.sellerAuth && window.history.state?.step === signupStepRef.current) {
          window.history.back();
        } else {
          setSignupStep((prev) => Math.max(1, prev - 1));
        }
        return;
      }

      // If on step 1 of signup, back should return to login
      if (window.history.state?.sellerAuth && window.history.state?.mode === "signup") {
        window.history.back();
      } else {
        setIsLogin(true);
        resetSignupForm();
      }
      return;
    }

    // If on login, navigate back if there is prior history, otherwise go home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }, [fpStep, navigate, resetSignupForm]);

  // Listen for hardware/browser back buttons (popstate)
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;

      // 1. If Map was open and popped back
      if (isMapOpenRef.current) {
        setIsMapOpen(false);
        return;
      }

      // 2. If Forgot Password was open and popped back
      if (forgotPasswordOpenRef.current) {
        setForgotPasswordOpen(false);
        return;
      }

      // 3. Popped to a sellerAuth history entry
      if (state && state.sellerAuth) {
        if (state.mode === "login") {
          setIsLogin(true);
          resetSignupForm();
        } else if (state.mode === "signup") {
          setIsLogin(false);
          setSignupStep(state.step || 1);
        }
        return;
      }

      // 4. Popped outside of sellerAuth: preserve logical state
      if (!isLoginRef.current) {
        if (signupStepRef.current > 1) {
          setSignupStep((prev) => Math.max(1, prev - 1));
        } else {
          setIsLogin(true);
          resetSignupForm();
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [resetSignupForm]);

  const openMapPicker = useCallback(() => {
    window.history.pushState(
      { sellerAuth: true, mode: "signup", step: signupStepRef.current, isMapOpen: true },
      "",
    );
    setIsMapOpen(true);
  }, []);

  const closeMapPicker = useCallback(() => {
    if (window.history.state?.isMapOpen) {
      window.history.back();
    } else {
      setIsMapOpen(false);
    }
  }, []);

  const handleToggleAuth = (targetModeIsLogin) => {
    const nextIsLogin = typeof targetModeIsLogin === "boolean" ? targetModeIsLogin : !isLogin;
    if (nextIsLogin === isLogin) return;

    if (!nextIsLogin) {
      window.history.pushState({ sellerAuth: true, mode: "signup", step: 1 }, "");
    } else {
      window.history.pushState({ sellerAuth: true, mode: "login", step: 1 }, "");
    }

    setIsLogin(nextIsLogin);
    resetSignupForm();
  };

  const updateVerificationState = (field, updates) => {
    setVerifications((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        ...updates,
      },
    }));
  };

  const resetVerificationState = (field) => {
    setVerifications((prev) => ({
      ...prev,
      [field]: createInitialVerificationState(),
    }));
  };

  const getVerificationPayload = (field) => {
    const channel = field === "email" ? "email" : "phone";
    return channel === "email"
      ? { channel, email: formData.email }
      : { channel, phone: formData.phone };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      // Owner name: only alphabets and spaces, max 50
      let cleaned = value.replace(/[^a-zA-Z\s]/g, "");
      cleaned = cleaned.replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, 50);
      if (cleaned.trim() === "") cleaned = "";
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "shopName") {
      // Shop name: max 50
      const cleaned = value.replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, 50);
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "email") {
      // Business email: trim leading spaces, disallow spaces inside
      const cleaned = value.replace(/\s+/g, "").toLowerCase();
      if (cleaned !== formData.email) {
        resetVerificationState("email");
      }
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "phone" || name === "whatsappNumber") {
      // Contact number/WhatsApp: normalize country code if pasted, only digits, max 10 characters
      let digits = value.replace(/[^0-9]/g, "");
      if (digits.length === 12 && digits.startsWith("91")) {
        digits = digits.slice(2);
      } else if (digits.length === 11 && digits.startsWith("0")) {
        digits = digits.slice(1);
      }
      const digitsOnly = digits.slice(0, 10);
      if (name === "phone" && digitsOnly !== formData.phone) {
        resetVerificationState("phone");
      }
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "city" || name === "state") {
      // City & State: only alphabets and spaces
      let cleaned = value.replace(/[^a-zA-Z\s]/g, "");
      cleaned = cleaned.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "locality" || name === "address") {
      const cleaned = value.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "pincode") {
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 6);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "password") {
      // Password: allow any characters, min length 6
      setFormData({ ...formData, [name]: value });
    } else if (name === "accountHolderName" || name === "bankName") {
      let cleaned = value.replace(/[^a-zA-Z\s]/g, "");
      cleaned = cleaned.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "branch") {
      let cleaned = value.replace(/[^a-zA-Z0-9\s-]/g, "");
      cleaned = cleaned.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "accountNumber") {
      const digitsOnly = value.replace(/[^0-9]/g, "");
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "aadhaarNumber") {
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 12);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "panNumber") {
      const alphanumeric = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
      setFormData({ ...formData, [name]: alphanumeric });
    } else if (name === "gstinNumber") {
      const alphanumeric = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 15);
      setFormData({ ...formData, [name]: alphanumeric });
    } else if (name === "udyamNumber") {
      const cleaned = value.replace(/[^a-zA-Z0-9\/-]/g, "").toUpperCase().slice(0, 25);
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "ifscCode") {
      const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 11);
      setFormData({ ...formData, [name]: cleaned });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleDocumentChange = (e, docName) => {
    setDocuments({ ...documents, [docName]: e.target.files[0] });
  };

  const handleSendVerificationOtp = async (field) => {
    const currentValue = formData[field];
    const isEmailField = field === "email";

    if (
      (isEmailField &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentValue || "")) ||
      (!isEmailField && !/^[6-9][0-9]{9}$/.test(currentValue || ""))
    ) {
      toast.error(
        isEmailField
          ? "Enter a valid email before requesting OTP."
          : "Enter a valid 10-digit phone number starting with 6-9 before requesting OTP.",
      );
      return;
    }

    updateVerificationState(field, {
      isSending: true,
      isOtpVisible: true,
      otp: "",
      token: "",
      status: "sending",
    });

    try {
      await sellerApi.sendVerificationOtp(getVerificationPayload(field));
      updateVerificationState(field, {
        isSending: false,
        isOtpVisible: true,
        status: "otp-sent",
      });
      toast.success(
        isEmailField
          ? "Verification OTP sent to your email."
          : "Verification OTP sent to your phone.",
      );
    } catch (error) {
      updateVerificationState(field, {
        isSending: false,
        status: "idle",
      });
      toast.error(error.response?.data?.message || "Failed to send OTP");
    }
  };

  const handleVerifyOtp = async (field) => {
    const verificationState = verifications[field];
    if (!/^\d{6}$/.test(verificationState.otp || "")) {
      toast.error("Enter a valid 6-digit OTP.");
      return;
    }

    updateVerificationState(field, {
      isVerifying: true,
    });

    try {
      const response = await sellerApi.verifyVerificationOtp({
        ...getVerificationPayload(field),
        otp: verificationState.otp,
      });
      const verificationToken =
        response.data?.result?.verificationToken || "";

      updateVerificationState(field, {
        isVerifying: false,
        isOtpVisible: false,
        status: "verified",
        otp: "",
        token: verificationToken,
        verifiedValue: formData[field],
      });
      toast.success(
        field === "email"
          ? "Email verified successfully."
          : "Phone number verified successfully.",
      );
    } catch (error) {
      updateVerificationState(field, {
        isVerifying: false,
      });
      toast.error(error.response?.data?.message || "Failed to verify OTP");
    }
  };

  const openForgotPassword = () => {
    setFpEmail(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email || "") ? formData.email : "",
    );
    setFpOtp("");
    setFpResetToken("");
    setFpNewPassword("");
    setFpConfirmPassword("");
    setFpShowNewPassword(false);
    setFpShowConfirmPassword(false);
    setFpStep("email");
    window.history.pushState({ sellerAuth: true, mode: isLogin ? "login" : "signup", forgotPasswordOpen: true }, "");
    setForgotPasswordOpen(true);
  };

  const closeForgotPassword = () => {
    if (fpLoading) return;
    if (window.history.state?.forgotPasswordOpen) {
      window.history.back();
    } else {
      setForgotPasswordOpen(false);
    }
  };

  const handleSendResetOtp = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fpEmail || "")) {
      toast.error("Enter a valid email address.");
      return;
    }
    setFpLoading(true);
    try {
      await sellerApi.sendPasswordResetOtp({ email: fpEmail });
      toast.success("OTP sent to your registered email.");
      setFpStep("otp");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
    } finally {
      setFpLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!/^\d{6}$/.test(fpOtp || "")) {
      toast.error("Enter a valid 6-digit OTP.");
      return;
    }
    setFpLoading(true);
    try {
      const response = await sellerApi.verifyPasswordResetOtp({
        email: fpEmail,
        otp: fpOtp,
      });
      setFpResetToken(response.data?.result?.resetToken || "");
      toast.success("OTP verified. Set your new password.");
      setFpStep("reset");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to verify OTP");
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const newPwd = (fpNewPassword || "").trim();
    if (newPwd.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (fpNewPassword !== fpConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setFpLoading(true);
    try {
      await sellerApi.resetPassword({
        email: fpEmail,
        resetToken: fpResetToken,
        newPassword: fpNewPassword,
      });
      toast.success("Password reset successfully. Please log in.");
      setForgotPasswordOpen(false);
      setFormData((prev) => ({ ...prev, email: fpEmail, password: "" }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password");
    } finally {
      setFpLoading(false);
    }
  };

  const handlePanelWheel = (e) => {
    const panel = e.currentTarget;
    if (panel.scrollHeight <= panel.clientHeight) {
      return;
    }

    e.preventDefault();
    panel.scrollTop += e.deltaY;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isProcessing.current) return;
    isProcessing.current = true;

    try {
      // Login accepts either an email or a phone number in one field —
      // if it looks like an email (contains "@"), make sure it's a
      // properly formatted one before hitting the API.
      let loginIdentifier = (formData.email || "").trim();
      if (isLogin) {
        if (loginIdentifier.includes("@")) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginIdentifier)) {
            toast.error("Please enter a valid email address.");
            isProcessing.current = false;
            return;
          }
        } else {
          let digits = loginIdentifier.replace(/\D/g, "");
          if (digits.length === 12 && digits.startsWith("91")) {
            digits = digits.slice(2);
          } else if (digits.length === 11 && digits.startsWith("0")) {
            digits = digits.slice(1);
          } else if (digits.length > 10) {
            digits = digits.slice(-10);
          }
          if (digits.length === 10) {
            loginIdentifier = digits;
          }
        }
      }

      // Basic client-side validation for signup
      if (!isLogin) {
        if (!formData.name.trim()) {
          toast.error("Owner name is required and cannot be blank.");
          isProcessing.current = false;
          return;
        }
        const email = formData.email || "";
        const phone = formData.phone || "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          toast.error("Please enter a valid business email address.");
          setIsLoading(false);
          isProcessing.current = false;
          return;
        }
        if (!/^[6-9][0-9]{9}$/.test(phone)) {
          toast.error("Please enter a valid 10-digit contact number starting with 6-9.");
          isProcessing.current = false;
          return;
        }
        if (verifications.email.status !== "verified" || !verifications.email.token) {
          toast.error("Please verify your business email before continuing.");
          isProcessing.current = false;
          return;
        }
        if (verifications.phone.status !== "verified" || !verifications.phone.token) {
          toast.error("Please verify your contact number before continuing.");
          isProcessing.current = false;
          return;
        }
        if (signupStep === 1) {
          if (!formData.shopName?.trim()) {
            toast.error("Shop / Business name is required.");
            isProcessing.current = false;
            return;
          }
        }
        if (signupStep === 2) {
          if (!formData.accountHolderName?.trim()) {
            toast.error("Please enter Account Holder Name.");
            isProcessing.current = false;
            return;
          }
          if (!formData.bankName?.trim()) {
            toast.error("Please enter Bank Name.");
            isProcessing.current = false;
            return;
          }
          if (!formData.branch?.trim()) {
            toast.error("Please enter Branch Name.");
            isProcessing.current = false;
            return;
          }
          const accNum = String(formData.accountNumber || "").trim();
          if (!accNum || !isValidAccountNumber(accNum)) {
            toast.error("Please enter a valid Bank Account Number (9 to 18 digits).");
            isProcessing.current = false;
            return;
          }
          const ifsc = String(formData.ifscCode || "").trim().toUpperCase();
          if (!ifsc || !isValidIFSC(ifsc)) {
            toast.error("Please enter a valid 11-character IFSC Code (e.g. SBIN0001234, 5th character must be '0').");
            isProcessing.current = false;
            return;
          }
        }
        if (signupStep === 3) {
          if (!formData.locality?.trim()) {
            toast.error("Please enter Locality / Area.");
            isProcessing.current = false;
            return;
          }
          const pin = String(formData.pincode || "").trim();
          if (!pin || !/^\d{6}$/.test(pin)) {
            toast.error("Please enter a valid 6-digit Pincode.");
            isProcessing.current = false;
            return;
          }
          if (!formData.city?.trim()) {
            toast.error("Please enter City.");
            isProcessing.current = false;
            return;
          }
          if (!formData.state?.trim()) {
            toast.error("Please enter State.");
            isProcessing.current = false;
            return;
          }
          if (!formData.address?.trim()) {
            toast.error("Please enter Full Address.");
            isProcessing.current = false;
            return;
          }
        }
        if (signupStep === 4) {
          // Re-verify Step 2 bank details before final submission
          const accNum = String(formData.accountNumber || "").trim();
          if (!accNum || !isValidAccountNumber(accNum)) {
            toast.error("Please enter a valid Bank Account Number (9 to 18 digits) in Bank Details.");
            isProcessing.current = false;
            return;
          }
          const ifsc = String(formData.ifscCode || "").trim().toUpperCase();
          if (!ifsc || !isValidIFSC(ifsc)) {
            toast.error("Please enter a valid 11-character IFSC Code in Bank Details (e.g. SBIN0001234, 5th character must be '0').");
            isProcessing.current = false;
            return;
          }

          if (!formData.panNumber && !formData.aadhaarNumber) {
            toast.error("Either PAN Number or Aadhaar Number is compulsory.");
            isProcessing.current = false;
            return;
          }
          if (formData.panNumber) {
            const pan = String(formData.panNumber).trim().toUpperCase();
            if (!isValidPAN(pan)) {
              toast.error("Please enter a valid 10-character PAN Number (e.g. ABCDE1234F).");
              isProcessing.current = false;
              return;
            }
          }
          if (formData.aadhaarNumber) {
            const aadh = String(formData.aadhaarNumber).trim();
            if (!isValidAadhaar(aadh)) {
              toast.error("Aadhaar Number must be exactly 12 digits.");
              isProcessing.current = false;
              return;
            }
          }
          if (formData.gstinNumber) {
            const gst = String(formData.gstinNumber).trim().toUpperCase();
            if (!isValidGSTIN(gst)) {
              toast.error("Please enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5).");
              isProcessing.current = false;
              return;
            }
          }
          if (formData.udyamNumber) {
            const udyam = String(formData.udyamNumber).trim().toUpperCase();
            if (!isValidUdyam(udyam)) {
              toast.error("Please enter a valid Udyam (e.g. UDYAM-XX-00-0000000) or Shop Act Registration number.");
              isProcessing.current = false;
              return;
            }
          }
        }
      }
      // Password: min 6 characters
      const pwd = (formData.password || "").trim();
      if (pwd.length < 6) {
        toast.error(
          "Password must be at least 6 characters.",
        );
        isProcessing.current = false;
        return;
      }

      if (!isLogin && signupStep < 4) {
        const nextStep = signupStep + 1;
        window.history.pushState({ sellerAuth: true, mode: "signup", step: nextStep }, "");
        setSignupStep(nextStep);
        isProcessing.current = false;
        return;
      }

      if (!isLogin) {
        const missingRequiredDocuments = getMissingRequiredDocuments();
        if (missingRequiredDocuments.length > 0) {
          toast.error(
            `Please upload all required documents: ${missingRequiredDocuments
              .map((doc) => doc.label)
              .join(", ")}`,
          );
          isProcessing.current = false;
          return;
        }
      }

      setIsLoading(true);
      // Note: backend expects a single address string, derive from city + state
      const address =
        formData.address ||
        [
          formData.locality,
          formData.city,
          formData.state,
          formData.pincode,
        ]
          .filter(Boolean)
          .join(", ");

      const response = isLogin
        ? await sellerApi.login({
          email: loginIdentifier,
          password: formData.password,
        })
        : await (() => {
          const signupPayload = new FormData();

          const bankDetails = JSON.stringify({
            accountHolderName: formData.accountHolderName,
            bankName: formData.bankName,
            branch: formData.branch,
            accountNumber: formData.accountNumber,
            ifscCode: formData.ifscCode,
          });

          const businessInfo = JSON.stringify({
            yearsInBusiness: formData.yearsInBusiness,
            expectedMonthlyOrders: formData.expectedMonthlyOrders,
            pickupAddress: address,
          });

          Object.entries({
            ...formData,
            address,
            bankDetails,
            businessInfo,
            lat: formData.lat,
            lng: formData.lng,
            radius: formData.radius,
            emailVerificationToken: verifications.email.token,
            phoneVerificationToken: verifications.phone.token,
          }).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== "") {
              signupPayload.append(key, value);
            }
          });

          Object.entries(documents).forEach(([key, file]) => {
            if (file) {
              signupPayload.append(key, file);
            }
          });

          return sellerApi.signup(signupPayload);
        })();

      if (isLogin) {
        const { token, seller } = response.data.result;
        login({
          ...seller,
          token,
          role: "seller",
        });
        toast.success("Welcome back, Partner!");
        navigate("/seller");
      } else {
        const resResult = response?.data?.result || {};
        const { token, seller } = resResult;
        if (token && seller) {
          login({
            ...seller,
            token,
            role: "seller",
          });
          try {
            if (seller._id) {
              localStorage.setItem("pending_seller_id", String(seller._id));
            }
          } catch {
            /* ignore */
          }
        }
        setIsLogin(true);
        setSignupStep(1);
        resetSignupForm();
        toast.success(
          "Application submitted! Dashboard access will unlock automatically once approved.",
        );
        navigate("/seller/pending-approval", {
          replace: true,
          state: {
            approvalRequired: true,
            applicationStatus: "pending",
            sellerId: seller?._id,
          },
        });
      }
    } catch (error) {
      if (isLogin && error.response?.status === 403) {
        const resResult = error.response?.data?.result || {};
        const { token, seller } = resResult;
        if (token && seller) {
          login({
            ...seller,
            token,
            role: "seller",
          });
          try {
            if (seller._id) {
              localStorage.setItem("pending_seller_id", String(seller._id));
            }
          } catch {
            /* ignore */
          }
        }
        const applicationStatus =
          resResult?.applicationStatus || "pending";
        const rejectionReason =
          resResult?.rejectionReason || "";
        navigate("/seller/pending-approval", {
          replace: true,
          state: {
            approvalRequired: true,
            applicationStatus,
            rejectionReason,
            sellerId: seller?._id,
          },
        });
        return;
      }
      if (isLogin && error.response?.status === 404) {
        toast.error(error.response?.data?.message || "This store isn't registered. Please sign up.", {
          action: {
            label: "Sign Up Now",
            onClick: () => handleToggleAuth(false),
          },
        });
        return;
      }
      toast.error(error.response?.data?.message || "Authentication failed");
    } finally {
      setIsLoading(false);
      isProcessing.current = false;
    }
  };

  if (checkingExistingSession) {
    return (
      <div className="min-h-screen bg-[#fcfaff] flex flex-col items-center justify-center font-['Outfit'] text-slate-800 p-6">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-lg border border-slate-100 flex items-center justify-center mb-4 animate-bounce-subtle p-3">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="w-full h-full object-contain" />
          ) : (
            <Store size={32} className="text-slate-700" />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <div className="w-4 h-4 rounded-full border-2 border-slate-700 border-t-transparent animate-spin" />
          <span>Verifying seller session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center gap-4 bg-[#fcfaff] p-4 sm:p-6 font-['Outfit'] overflow-x-hidden overflow-y-auto relative">
      {/* Elegant Ambient Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-slate-100/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-slate-50/50 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-[1000px] min-h-0 sm:min-h-[600px] max-h-none sm:max-h-[90vh] bg-white rounded-lg shadow-[0_50px_120px_rgba(0,0,0,0.04)] border border-white flex flex-col md:flex-row overflow-hidden my-auto">
        {/* Visual Side Panel */}
        <div className="hidden md:flex w-[45%] bg-linear-to-br from-slate-900 via-slate-950 to-black relative flex-col items-center justify-center p-10 overflow-hidden">
          {/* Brand Logo */}
          <div className="absolute top-6 left-6 z-20 inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${appName} logo`}
                className="h-7 w-7 rounded-md object-contain bg-white/90"
              />
            ) : (
              <Store className="h-5 w-5 text-white/80" />
            )}
            <span className="text-xs font-bold text-white/90">{appName}</span>
          </div>
          {/* Abstract Decorative Circles */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 w-full flex flex-col items-center">
            {/* Lottie Animation for Seller */}
            <div className="w-full max-w-[350px] drop-shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <Lottie
                animationData={sellerAnimation}
                loop={true}
                className="w-full h-auto"
              />
            </div>

            <div className="mt-8 text-center space-y-4">
              <h2 className="text-2xl font-black text-white tracking-tight leading-tight uppercase underline decoration-white/20 underline-offset-8">
                Seller <span className="text-slate-600">Expansion.</span>
              </h2>
            </div>
          </motion.div>

          {/* Partner Badges */}
          <div className="absolute bottom-12 left-0 right-0 px-12 flex justify-between items-center opacity-60">
            <div className="flex items-center gap-2 text-white/80">
              <Rocket size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Growth First
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <Globe size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Pan India
              </span>
            </div>
          </div>
        </div>

        {/* Form Content Side */}
        <div
          className="w-full md:w-[55%] min-h-0 p-6 pt-8 sm:p-8 sm:pt-8 md:p-12 md:pt-10 flex flex-col justify-start bg-white overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar relative"
          onWheelCapture={handlePanelWheel}
          style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="hidden md:flex absolute top-6 right-6 md:top-8 md:right-8 z-20">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${appName} logo`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store size={30} className="text-slate-700" />
              )}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login" : `signup-step-${signupStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-6 sm:space-y-8 py-2 md:py-4 my-auto">
              <div className="flex md:hidden items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  {!isLogin && (
                    <button
                      type="button"
                      onClick={handleGoBack}
                      className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 shadow-xs flex items-center justify-center text-slate-700 transition-all cursor-pointer"
                      title="Go Back">
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${appName} logo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store size={18} className="text-slate-700" />
                    )}
                  </div>
                  <span className="text-sm font-black text-slate-900 tracking-tight">
                    {appName} Seller
                  </span>
                </div>
              </div>
              <div className="space-y-4 md:pr-24">
                {!isLogin && (
                  <div>
                    <button
                      type="button"
                      onClick={handleGoBack}
                      className="hidden md:inline-flex items-center gap-1.5 text-xs font-black tracking-wider uppercase text-slate-500 hover:text-slate-900 transition-colors cursor-pointer mb-1">
                      <ArrowLeft size={14} />
                      {signupStep > 1 ? `Back to Step ${signupStep - 1}` : "Back to Sign In"}
                    </button>
                  </div>
                )}
                <div>
                  <span className="inline-block px-4 py-1 bg-slate-100 text-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 text-center whitespace-normal w-full sm:w-auto">
                    {isLogin
                      ? "Welcome Back"
                      : `New Partnership - Step ${signupStep} of 4`}
                  </span>
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                  Seller{" "}
                  <span className="text-slate-900">
                    {isLogin ? "Login" : "Signup"}
                  </span>
                </h1>
                <p className="text-slate-600 font-medium text-base leading-relaxed">
                  {isLogin
                    ? "Access your unified seller dashboard and manage orders."
                    : signupStep === 1
                      ? "Register your store and start selling instantly."
                      : signupStep === 2
                        ? "Enter your business and bank details for payouts."
                        : signupStep === 3
                          ? "Set your shop address and service area precisely."
                          : "Enter KYC numbers and upload verification documents."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* LOGIN OR SIGNUP STEP 1 */}
                {(isLogin || signupStep === 1) && (
                  <>
                    {!isLogin && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                            <User size={18} />
                          </div>
                          <input
                            type="text"
                            name="name"
                            required
                            maxLength={50}
                            placeholder="Owner Name"
                            className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                            value={formData.name}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                            <Store size={18} />
                          </div>
                          <input
                            type="text"
                            name="shopName"
                            required
                            maxLength={50}
                            placeholder="Shop / Business Name"
                            className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                            value={formData.shopName}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    )}

                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                        <Mail size={18} />
                      </div>
                      <input
                        type={isLogin ? "text" : "email"}
                        name="email"
                        required
                        inputMode={isLogin ? "text" : "email"}
                        autoComplete="email"
                        placeholder={isLogin ? "Email or Phone" : "Email Address"}
                        className={`w-full pl-11 ${isLogin ? "pr-4" : "pr-20 sm:pr-24"} py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm`}
                        value={formData.email}
                        onChange={handleChange}
                      />
                      {!isLogin && (
                        <button
                          type="button"
                          onClick={() => handleSendVerificationOtp("email")}
                          disabled={
                            verifications.email.isSending ||
                            verifications.email.status === "verified" ||
                            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email || "")
                          }
                          className={`absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 sm:px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${verifications.email.status === "verified"
                            ? "bg-brand-100 text-brand-700 cursor-default"
                            : "bg-slate-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                            }`}>
                          {verifications.email.isSending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : verifications.email.status === "verified" ? (
                            "Verified"
                          ) : verifications.email.isOtpVisible ? (
                            "Resend"
                          ) : (
                            "Verify"
                          )}
                        </button>
                      )}
                    </div>
                    {!isLogin && verifications.email.isOtpVisible && verifications.email.status !== "verified" && (
                      <div className="w-full flex items-center justify-between gap-2 rounded-xl border-2 border-brand-200/80 bg-brand-50/40 p-2 sm:px-3 sm:py-2.5 transition-all">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter 6-digit email OTP"
                          value={verifications.email.otp}
                          onChange={(e) =>
                            updateVerificationState("email", {
                              otp: e.target.value.replace(/\D/g, "").slice(0, 6),
                            })
                          }
                          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 tracking-widest outline-none placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleVerifyOtp("email")}
                          disabled={verifications.email.isVerifying || verifications.email.otp.length !== 6}
                          className="shrink-0 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:bg-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {verifications.email.isVerifying ? "Checking..." : "Confirm OTP"}
                        </button>
                      </div>
                    )}
                    {!isLogin && verifications.email.status === "verified" && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-brand-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>Email verified successfully.</span>
                      </div>
                    )}

                    {!isLogin && (
                      <>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                            <Phone size={18} />
                          </div>
                          <input
                            type="tel"
                            name="phone"
                            inputMode="numeric"
                            required
                            placeholder="Phone Number (10 digits)"
                            className="w-full pl-11 pr-20 sm:pr-24 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                            value={formData.phone}
                            onChange={handleChange}
                          />
                          <button
                            type="button"
                            onClick={() => handleSendVerificationOtp("phone")}
                            disabled={
                              verifications.phone.isSending ||
                              verifications.phone.status === "verified" ||
                              !/^[6-9][0-9]{9}$/.test(formData.phone || "")
                            }
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 sm:px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${verifications.phone.status === "verified"
                              ? "bg-brand-100 text-brand-700 cursor-default"
                              : "bg-slate-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                              }`}>
                            {verifications.phone.isSending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : verifications.phone.status === "verified" ? (
                              "Verified"
                            ) : verifications.phone.isOtpVisible ? (
                              "Resend"
                            ) : (
                              "Verify"
                            )}
                          </button>
                        </div>
                        {verifications.phone.isOtpVisible && verifications.phone.status !== "verified" && (
                          <div className="w-full flex items-center justify-between gap-2 rounded-xl border-2 border-brand-200/80 bg-brand-50/40 p-2 sm:px-3 sm:py-2.5 transition-all">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="Enter 6-digit phone OTP"
                              value={verifications.phone.otp}
                              onChange={(e) =>
                                updateVerificationState("phone", {
                                  otp: e.target.value.replace(/\D/g, "").slice(0, 6),
                                })
                              }
                              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 tracking-widest outline-none placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleVerifyOtp("phone")}
                              disabled={verifications.phone.isVerifying || verifications.phone.otp.length !== 6}
                              className="shrink-0 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:bg-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {verifications.phone.isVerifying ? "Checking..." : "Confirm OTP"}
                            </button>
                          </div>
                        )}
                        {verifications.phone.status === "verified" && (
                          <div className="flex items-center gap-2 text-[11px] font-bold text-brand-600">
                            <CheckCircle className="h-4 w-4" />
                            <span>Phone number verified successfully.</span>
                          </div>
                        )}
                      </>
                    )}

                    {!isLogin && (
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <Phone size={18} />
                        </div>
                        <input
                          type="tel"
                          name="whatsappNumber"
                          inputMode="numeric"
                          placeholder="WhatsApp Number (Optional)"
                          className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.whatsappNumber}
                          onChange={handleChange}
                        />
                      </div>
                    )}

                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required
                        minLength={6}
                        maxLength={32}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="w-full pl-11 pr-12 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                        value={formData.password}
                        onChange={handleChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors px-1"
                        tabIndex="-1">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {isLogin && (
                      <div className="flex justify-end -mt-1">
                        <button
                          type="button"
                          onClick={openForgotPassword}
                          className="text-xs font-bold text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors">
                          Forgot password?
                        </button>
                      </div>
                    )}

                    {!isLogin && (
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <Gift size={18} />
                        </div>
                        <input
                          type="text"
                          name="referralCode"
                          placeholder="Referral Code (Optional)"
                          className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case placeholder:text-xs sm:placeholder:text-sm uppercase"
                          value={formData.referralCode || ""}
                          onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* SIGNUP STEP 2 (Business & Bank Details) */}
                {!isLogin && signupStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">
                      Business Details
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="relative group">
                        <select
                          name="businessType"
                          required
                          className="w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all appearance-none"
                          value={formData.businessType}
                          onChange={handleChange}
                        >
                          <option value="Proprietorship">Proprietorship</option>
                          <option value="Partnership">Partnership</option>
                          <option value="LLP">LLP</option>
                          <option value="Pvt. Ltd.">Pvt. Ltd.</option>
                          <option value="Other">Other</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          ▼
                        </div>
                      </div>
                      <div className="relative group">
                        <select
                          name="sellerType"
                          required
                          className="w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all appearance-none"
                          value={formData.sellerType}
                          onChange={handleChange}
                        >
                          <option value="Retailer">Retailer</option>
                          <option value="Wholesaler">Wholesaler</option>
                          <option value="Manufacturer">Manufacturer</option>
                          <option value="Service Provider">Service Provider</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          ▼
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="relative group">
                        <input
                          type="number"
                          name="yearsInBusiness"
                          placeholder="Years in Business"
                          className="w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.yearsInBusiness}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="relative group">
                        <input
                          type="text"
                          name="expectedMonthlyOrders"
                          placeholder="Expected Monthly Orders"
                          className="w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.expectedMonthlyOrders}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <p className="text-sm font-black text-slate-600 uppercase tracking-widest mt-6 mb-3">
                      Bank Details
                    </p>
                    <div className="space-y-3.5">
                      <input
                        type="text"
                        name="accountHolderName"
                        required
                        placeholder="Account Holder Name"
                        className="w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                        value={formData.accountHolderName}
                        onChange={handleChange}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <input
                          type="text"
                          name="bankName"
                          required
                          placeholder="Bank Name"
                          className="w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.bankName}
                          onChange={handleChange}
                        />
                        <input
                          type="text"
                          name="branch"
                          required
                          placeholder="Branch Name"
                          className="w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.branch}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <input
                            type="text"
                            name="accountNumber"
                            inputMode="numeric"
                            required
                            maxLength={18}
                            placeholder="Account No. (9-18 digits)"
                            className={`w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm ${
                              formData.accountNumber && !isValidAccountNumber(formData.accountNumber)
                                ? "border-amber-400 bg-amber-50/20 focus:border-amber-500"
                                : formData.accountNumber && isValidAccountNumber(formData.accountNumber)
                                  ? "border-emerald-400 bg-emerald-50/20 focus:border-emerald-500"
                                  : "border-transparent focus:bg-white focus:border-slate-200"
                            }`}
                            value={formData.accountNumber}
                            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 18) })}
                          />
                          {formData.accountNumber && !isValidAccountNumber(formData.accountNumber) && (
                            <p className="text-[11px] font-bold text-amber-600 mt-1 pl-1">
                              Must be 9 to 18 digits ({formData.accountNumber.length}/18)
                            </p>
                          )}
                        </div>
                        <div>
                          <input
                            type="text"
                            name="ifscCode"
                            required
                            maxLength={11}
                            placeholder="IFSC (e.g. SBIN0001234)"
                            className={`w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case placeholder:text-xs sm:placeholder:text-sm uppercase ${
                              formData.ifscCode && !isValidIFSC(formData.ifscCode)
                                ? "border-amber-400 bg-amber-50/20 focus:border-amber-500"
                                : formData.ifscCode && isValidIFSC(formData.ifscCode)
                                  ? "border-emerald-400 bg-emerald-50/20 focus:border-emerald-500"
                                  : "border-transparent focus:bg-white focus:border-slate-200"
                            }`}
                            value={formData.ifscCode}
                            onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 11) })}
                          />
                          {formData.ifscCode && formData.ifscCode.length === 11 && !isValidIFSC(formData.ifscCode) && (
                            <p className="text-[11px] font-bold text-rose-600 mt-1 pl-1">
                              Invalid IFSC (5th character must be '0')
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SIGNUP STEP 3 (Shop address and service area) */}
                {!isLogin && signupStep === 3 && (
                  <div className="space-y-4">
                    <div className="pt-2">
                      <p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">
                        Shop Location & Service Area
                      </p>
                      <button
                        type="button"
                        onClick={openMapPicker}
                        className={`w-full flex items-center justify-between p-4 rounded-lg border-2 border-dashed transition-all cursor-pointer ${formData.lat
                          ? "border-brand-200 bg-brand-50/50"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                          }`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div
                            className={`p-2 rounded-md ${formData.lat ? "bg-brand-100 text-brand-600" : "bg-white text-slate-600 shadow-sm"}`}>
                            {formData.lat ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <MapPin className="w-4 h-4" />
                            )}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p
                              className={`text-xs font-bold ${formData.lat ? "text-brand-700" : "text-slate-600"}`}>
                              {formData.lat
                                ? "Location Selected"
                                : "Pin Shop on Map"}
                            </p>
                            <p className="text-xs text-slate-600 font-medium truncate w-full">
                              {formData.lat
                                ? `${formData.address} (${formData.radius}km)`
                                : "Precisely mark your shop location"}
                            </p>
                          </div>
                        </div>
                        {formData.lat && (
                          <span className="text-[10px] font-black text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            Verified
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          name="locality"
                          required
                          maxLength={100}
                          placeholder="Locality / Area"
                          className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.locality}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          name="pincode"
                          inputMode="numeric"
                          required
                          maxLength={6}
                          placeholder="Pincode (6 digits)"
                          className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.pincode}
                          onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          name="city"
                          required
                          maxLength={50}
                          placeholder="City"
                          className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.city}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          name="state"
                          required
                          maxLength={50}
                          placeholder="State"
                          className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm"
                          value={formData.state}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute left-4 top-4 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                        <MapPin size={18} />
                      </div>
                      <textarea
                        name="address"
                        rows={3}
                        required
                        maxLength={250}
                        placeholder="Full address (Shop no., building, street)"
                        className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm resize-none"
                        value={formData.address}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                )}

                {/* SIGNUP STEP 4 (Verification documents) */}
                {!isLogin && signupStep === 4 && (
                  <div className="space-y-4">
                    <div className="pt-2">
                      <p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">
                        KYC Details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <input
                            type="text"
                            name="panNumber"
                            maxLength={10}
                            placeholder="PAN (e.g. ABCDE1234F)"
                            className={`w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case placeholder:text-xs sm:placeholder:text-sm uppercase ${
                              formData.panNumber && !isValidPAN(formData.panNumber)
                                ? "border-amber-400 bg-amber-50/20 focus:border-amber-500"
                                : formData.panNumber && isValidPAN(formData.panNumber)
                                  ? "border-emerald-400 bg-emerald-50/20 focus:border-emerald-500"
                                  : "border-transparent focus:bg-white focus:border-slate-200"
                            }`}
                            value={formData.panNumber}
                            onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) })}
                          />
                          {formData.panNumber && formData.panNumber.length === 10 && !isValidPAN(formData.panNumber) && (
                            <p className="text-[11px] font-bold text-rose-600 mt-1 pl-1">
                              Invalid PAN (5 letters, 4 digits, 1 letter)
                            </p>
                          )}
                        </div>
                        <div>
                          <input
                            type="text"
                            name="aadhaarNumber"
                            inputMode="numeric"
                            maxLength={12}
                            placeholder="Aadhaar (12 digits)"
                            className={`w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs sm:placeholder:text-sm ${
                              formData.aadhaarNumber && !isValidAadhaar(formData.aadhaarNumber)
                                ? "border-amber-400 bg-amber-50/20 focus:border-amber-500"
                                : formData.aadhaarNumber && isValidAadhaar(formData.aadhaarNumber)
                                  ? "border-emerald-400 bg-emerald-50/20 focus:border-emerald-500"
                                  : "border-transparent focus:bg-white focus:border-slate-200"
                            }`}
                            value={formData.aadhaarNumber}
                            onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                          />
                          {formData.aadhaarNumber && !isValidAadhaar(formData.aadhaarNumber) && (
                            <p className="text-[11px] font-bold text-amber-600 mt-1 pl-1">
                              Must be exactly 12 digits ({formData.aadhaarNumber.length}/12)
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
                        <div>
                          <input
                            type="text"
                            name="gstinNumber"
                            maxLength={15}
                            placeholder="GSTIN (Optional)"
                            className={`w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case placeholder:text-xs sm:placeholder:text-sm uppercase ${
                              formData.gstinNumber && !isValidGSTIN(formData.gstinNumber)
                                ? "border-amber-400 bg-amber-50/20 focus:border-amber-500"
                                : formData.gstinNumber && isValidGSTIN(formData.gstinNumber)
                                  ? "border-emerald-400 bg-emerald-50/20 focus:border-emerald-500"
                                  : "border-transparent focus:bg-white focus:border-slate-200"
                            }`}
                            value={formData.gstinNumber}
                            onChange={(e) => setFormData({ ...formData, gstinNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 15) })}
                          />
                          {formData.gstinNumber && formData.gstinNumber.length > 0 && !isValidGSTIN(formData.gstinNumber) && (
                            <p className="text-[11px] font-bold text-rose-600 mt-1 pl-1">
                              Invalid GSTIN format (15 characters, e.g. 22AAAAA0000A1Z5)
                            </p>
                          )}
                        </div>
                        <div>
                          <input
                            type="text"
                            name="udyamNumber"
                            maxLength={25}
                            placeholder="Udyam / Shop Act (Optional)"
                            className={`w-full px-4 py-3.5 sm:py-4 bg-slate-50 border-2 rounded-lg text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case placeholder:text-xs sm:placeholder:text-sm uppercase ${
                              formData.udyamNumber && !isValidUdyam(formData.udyamNumber)
                                ? "border-amber-400 bg-amber-50/20 focus:border-amber-500"
                                : formData.udyamNumber && isValidUdyam(formData.udyamNumber)
                                  ? "border-emerald-400 bg-emerald-50/20 focus:border-emerald-500"
                                  : "border-transparent focus:bg-white focus:border-slate-200"
                            }`}
                            value={formData.udyamNumber}
                            onChange={(e) => setFormData({ ...formData, udyamNumber: e.target.value.toUpperCase().slice(0, 25) })}
                          />
                          {formData.udyamNumber && formData.udyamNumber.length > 0 && !isValidUdyam(formData.udyamNumber) && (
                            <p className="text-[11px] font-bold text-rose-600 mt-1 pl-1">
                              Invalid Udyam (UDYAM-XX-00-0000000) or Shop Act format
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-sm font-black text-slate-600 uppercase tracking-widest mt-6 mb-3">
                        Verification Documents
                      </p>
                      <div className="space-y-3">
                        {/* Dynamic ID Proof Upload */}
                        <div className="relative">
                          <input
                            type="file"
                            id="panAadhaarCard"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              if (formData.panNumber) {
                                handleDocumentChange(e, "panCard");
                              } else {
                                handleDocumentChange(e, "idProof");
                              }
                            }}
                          />
                          <label
                            htmlFor="panAadhaarCard"
                            className={`flex items-center justify-between p-3.5 rounded-lg border-2 border-dashed transition-all cursor-pointer ${(documents.panCard || documents.idProof)
                              ? "border-brand-200 bg-brand-50/50"
                              : "border-slate-200 bg-slate-50 hover:border-slate-300"
                              }`}>
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-md ${(documents.panCard || documents.idProof) ? "bg-brand-100 text-brand-600" : "bg-white text-slate-600 shadow-sm"}`}>
                                {(documents.panCard || documents.idProof) ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <Upload className="w-4 h-4" />
                                )}
                              </div>
                              <div className="text-left">
                                <p
                                  className={`text-xs font-bold ${(documents.panCard || documents.idProof) ? "text-brand-700" : "text-slate-600"}`}>
                                  PAN / Aadhaar Card
                                </p>
                                <p className="text-xs text-slate-600 font-medium truncate max-w-[150px]">
                                  {(documents.panCard || documents.idProof)
                                    ? (documents.panCard || documents.idProof).name
                                    : "Upload secure PDF or image"}
                                </p>
                              </div>
                            </div>
                          </label>
                        </div>

                        {REQUIRED_DOCUMENT_CONFIG.map((doc) => (
                          <div key={doc.id} className="relative">
                            <input
                              type="file"
                              id={doc.id}
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => handleDocumentChange(e, doc.id)}
                            />
                            <label
                              htmlFor={doc.id}
                              className={`flex items-center justify-between p-3.5 rounded-lg border-2 border-dashed transition-all cursor-pointer ${documents[doc.id]
                                ? "border-brand-200 bg-brand-50/50"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                }`}>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-2 rounded-md ${documents[doc.id] ? "bg-brand-100 text-brand-600" : "bg-white text-slate-600 shadow-sm"}`}>
                                  {documents[doc.id] ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : (
                                    <Upload className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="text-left">
                                  <p
                                    className={`text-xs font-bold ${documents[doc.id] ? "text-brand-700" : "text-slate-600"}`}>
                                    {doc.label}
                                  </p>
                                  <p className="text-xs text-slate-600 font-medium truncate max-w-[150px]">
                                    {documents[doc.id]
                                      ? documents[doc.id].name
                                      : "Upload secure PDF or image"}
                                  </p>
                                </div>
                              </div>
                            </label>
                          </div>
                        ))}

                        {OPTIONAL_DOCUMENT_CONFIG.map((doc) => (
                          <div key={doc.id} className="relative">
                            <input
                              type="file"
                              id={doc.id}
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => handleDocumentChange(e, doc.id)}
                            />
                            <label
                              htmlFor={doc.id}
                              className={`flex items-center justify-between p-3.5 rounded-lg border-2 border-dashed transition-all cursor-pointer ${documents[doc.id]
                                ? "border-brand-200 bg-brand-50/50"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                }`}>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-2 rounded-md ${documents[doc.id] ? "bg-brand-100 text-brand-600" : "bg-white text-slate-600 shadow-sm"}`}>
                                  {documents[doc.id] ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : (
                                    <Upload className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="text-left">
                                  <p
                                    className={`text-xs font-bold ${documents[doc.id] ? "text-brand-700" : "text-slate-600"}`}>
                                    {doc.label}
                                  </p>
                                  <p className="text-xs text-slate-600 font-medium truncate max-w-[150px]">
                                    {documents[doc.id]
                                      ? documents[doc.id].name
                                      : "Upload secure PDF or image"}
                                  </p>
                                </div>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {!isLogin && (
                    <button
                      type="button"
                      onClick={handleGoBack}
                      className="w-1/3 bg-slate-100 text-slate-600 rounded-lg py-4 text-sm font-black tracking-[2px] transition-all hover:bg-slate-200 cursor-pointer">
                      BACK
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`${!isLogin ? "w-2/3" : "w-full"} bg-slate-900 text-white rounded-lg py-4 text-sm font-black tracking-[2px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group cursor-pointer`}>
                    {isLoading
                      ? "WORKING..."
                      : isLogin
                        ? "ENTER DASHBOARD"
                        : signupStep < 4
                          ? "NEXT STEP"
                          : "SUBMIT APPLICATION"}
                    <ArrowRight
                      className="group-hover:translate-x-2 transition-transform"
                      size={20}
                    />
                  </button>
                </div>
              </form>

              <div className="pt-1 border-t border-slate-50 flex items-center justify-center text-center">
                <p className="text-slate-600 font-bold text-sm">
                  {isLogin ? "New to the platform?" : "Already part of us?"}{" "}
                  <button
                    type="button"
                    onClick={() => handleToggleAuth(!isLogin)}
                    className="text-slate-900 hover:text-black transition-colors underline underline-offset-4 font-black">
                    {isLogin ? "Register Store" : "Sign In"}
                  </button>
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Bottom Tagline & Copyright */}
      <div className="relative z-10 flex flex-col items-center gap-1.5 text-center px-4">
        <span className="flex items-center gap-4 text-slate-300 text-[10px] font-black uppercase tracking-[6px]">
          Empowering Business Digitalization
        </span>
        <span className="text-slate-300 text-[10px] font-bold tracking-widest">
          Made with Sevafast
        </span>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={closeMapPicker}
          onConfirm={(location) => {
            handleLocationSelect(location);
            closeMapPicker();
          }}
          preferCurrentLocationOnOpen={!formData.lat}
          initialLocation={
            formData.lat ? { lat: formData.lat, lng: formData.lng } : null
          }
          initialRadius={formData.radius}
        />
      )}

      <AnimatePresence>
        {forgotPasswordOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
            onClick={closeForgotPassword}>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-lg shadow-[0_50px_120px_rgba(0,0,0,0.25)] p-8 relative">
              <button
                type="button"
                onClick={closeForgotPassword}
                className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors text-xl leading-none"
                aria-label="Close">
                ×
              </button>

              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-1">
                Reset Password
              </h2>
              <p className="text-slate-600 font-medium text-sm mb-6">
                {fpStep === "email" &&
                  "Enter your registered business email to receive an OTP."}
                {fpStep === "otp" &&
                  `Enter the 6-digit OTP sent to ${fpEmail}.`}
                {fpStep === "reset" &&
                  "Set a new password for your seller account."}
              </p>

              {fpStep === "email" && (
                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="Email"
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:text-xs sm:placeholder:text-sm"
                      value={fpEmail}
                      onChange={(e) => setFpEmail(e.target.value.replace(/\s+/g, "").toLowerCase())}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendResetOtp}
                    disabled={fpLoading}
                    className="w-full bg-slate-900 text-white rounded-lg py-4 text-sm font-black tracking-[2px] hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                    {fpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {fpLoading ? "SENDING..." : "SEND OTP"}
                  </button>
                </div>
              )}

              {fpStep === "otp" && (
                <div className="space-y-4">
                  <div className="relative group">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:text-xs sm:placeholder:text-sm tracking-[4px]"
                      value={fpOtp}
                      onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyResetOtp}
                    disabled={fpLoading || fpOtp.length !== 6}
                    className="w-full bg-slate-900 text-white rounded-lg py-4 text-sm font-black tracking-[2px] hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                    {fpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {fpLoading ? "VERIFYING..." : "VERIFY OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendResetOtp}
                    disabled={fpLoading}
                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors disabled:opacity-50">
                    Resend OTP
                  </button>
                </div>
              )}

              {fpStep === "reset" && (
                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={fpShowNewPassword ? "text" : "password"}
                      minLength={6}
                      maxLength={32}
                      autoComplete="new-password"
                      placeholder="New Password"
                      className="w-full pl-12 pr-14 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:text-xs sm:placeholder:text-sm"
                      value={fpNewPassword}
                      onChange={(e) => setFpNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setFpShowNewPassword(!fpShowNewPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors px-2"
                      tabIndex="-1">
                      {fpShowNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-600 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={fpShowConfirmPassword ? "text" : "password"}
                      minLength={6}
                      maxLength={32}
                      autoComplete="new-password"
                      placeholder="Confirm New Password"
                      className="w-full pl-12 pr-14 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400 placeholder:text-xs sm:placeholder:text-sm"
                      value={fpConfirmPassword}
                      onChange={(e) => setFpConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setFpShowConfirmPassword(!fpShowConfirmPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors px-2"
                      tabIndex="-1">
                      {fpShowConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={fpLoading}
                    className="w-full bg-slate-900 text-white rounded-lg py-4 text-sm font-black tracking-[2px] hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                    {fpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {fpLoading ? "RESETTING..." : "RESET PASSWORD"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Auth;
