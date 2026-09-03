import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Phone,
  ArrowRight,
  CheckCircle,
  ShieldCheck,
  ChevronLeft,
  User,
  Bike,
  ChevronDown,
  Mail,
  MapPin,
  FileText,
  Upload,
  X,
  Camera,
  XCircle,
  Calendar,
  Droplet,
  Briefcase,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import deliveryRiding from "@/assets/Delivery Riding.json";
import { deliveryApi } from "../services/deliveryApi";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { toast } from "sonner";


const VEHICLE_TYPES = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "cycle", label: "Cycle" },
  { value: "other", label: "Other" },
];

const DELIVERY_TEST_PHONES = new Set(["6268423925", "9111966732", "8888888888"]);
const DELIVERY_TEST_OTP = "123456";

const isDeliveryTestPhone = (phone) =>
  DELIVERY_TEST_PHONES.has(String(phone || "").replace(/\D/g, "").slice(-10));

// A valid Indian mobile number is 10 digits and starts with 6, 7, 8 or 9.
const isValidIndianMobile = (phone) => /^[6-9]\d{9}$/.test(String(phone || ""));

// Bug 275/277: persist in-progress signup (step + fields) across a T&C/Privacy
// tab visit or a hard page refresh, so the rider doesn't lose their work.
const SIGNUP_DRAFT_KEY = "delivery_signup_draft";

const loadSignupDraft = () => {
  try {
    const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const DeliveryAuth = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl || "";
  const { login } = useAuth();

  // Loaded once per mount; used to seed initial state below.
  const [signupDraft] = useState(loadSignupDraft);

  // mode: "login" | "signup"
  const [mode, setMode] = useState(signupDraft ? "signup" : "login");
  const [step, setStep] = useState("form"); // "form" | "otp"

  // Login state
  const [loginPhone, setLoginPhone] = useState("");

  // Signup state
  const [signupStep, setSignupStep] = useState(signupDraft?.signupStep || 1);
  const [signupName, setSignupName] = useState(signupDraft?.signupName || "");
  const [signupPhone, setSignupPhone] = useState(signupDraft?.signupPhone || "");
  const [signupEmail, setSignupEmail] = useState(signupDraft?.signupEmail || "");
  const [signupAddress, setSignupAddress] = useState(signupDraft?.signupAddress || "");
  const [signupDob, setSignupDob] = useState(signupDraft?.signupDob || "");
  const [signupBloodGroup, setSignupBloodGroup] = useState(signupDraft?.signupBloodGroup || "");
  const [signupVehicle, setSignupVehicle] = useState(signupDraft?.signupVehicle || "bike");
  const [signupVehicleNumber, setSignupVehicleNumber] = useState(signupDraft?.signupVehicleNumber || "");
  const [signupDLNumber, setSignupDLNumber] = useState(signupDraft?.signupDLNumber || "");
  const [signupPanNumber, setSignupPanNumber] = useState(signupDraft?.signupPanNumber || "");
  const [signupAadharNumber, setSignupAadharNumber] = useState(signupDraft?.signupAadharNumber || "");
  const [signupAccountNumber, setSignupAccountNumber] = useState(signupDraft?.signupAccountNumber || "");
  const [signupIfsc, setSignupIfsc] = useState(signupDraft?.signupIfsc || "");
  const [signupAccountHolder, setSignupAccountHolder] = useState(signupDraft?.signupAccountHolder || "");
  const [signupExperience, setSignupExperience] = useState(signupDraft?.signupExperience || "");
  const [signupPreferredArea, setSignupPreferredArea] = useState(signupDraft?.signupPreferredArea || "");
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");

  // Document states
  const [aadharFile, setAadharFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [dlFile, setDlFile] = useState(null);

  // OTP state
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [validationErrors, setValidationErrors] = useState({});

  const isCycleVehicle = signupVehicle === "cycle" || signupVehicle === "other";



  useEffect(() => {
    let interval;
    if (step === "otp" && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Bug 275/277: keep the in-progress signup draft (step + fields) in
  // sessionStorage so a T&C/Privacy tap-out or a refresh doesn't lose it.
  useEffect(() => {
    if (mode !== "signup") return;
    try {
      sessionStorage.setItem(
        SIGNUP_DRAFT_KEY,
        JSON.stringify({
          signupStep,
          signupName,
          signupPhone,
          signupEmail,
          signupAddress,
          signupDob,
          signupBloodGroup,
          signupVehicle,
          signupVehicleNumber,
          signupDLNumber,
          signupPanNumber,
          signupAadharNumber,
          signupAccountNumber,
          signupIfsc,
          signupAccountHolder,
          signupExperience,
          signupPreferredArea,
        }),
      );
    } catch {
      /* sessionStorage unavailable (e.g. private mode) — ignore */
    }
  }, [
    mode,
    signupStep,
    signupName,
    signupPhone,
    signupEmail,
    signupAddress,
    signupDob,
    signupBloodGroup,
    signupVehicle,
    signupVehicleNumber,
    signupDLNumber,
    signupPanNumber,
    signupAadharNumber,
    signupAccountNumber,
    signupIfsc,
    signupAccountHolder,
    signupExperience,
    signupPreferredArea,
  ]);

  // Bug 280: pressing the hardware/browser back button while on the OTP step
  // should return to the phone-entry step instead of exiting the auth flow.
  useEffect(() => {
    if (step !== "otp") return undefined;
    window.history.pushState({ deliveryAuthOtpStep: true }, "");
    const handlePopState = () => {
      setStep("form");
      setOtp(["", "", "", "", "", ""]);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [step]);

  // Bug 276: scroll the focused field into view so it isn't hidden behind
  // the on-screen keyboard on mobile.
  const handleFieldFocus = (e) => {
    e.target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleDLUpload = (file) => {
    setDlFile(file || null);
  };

  const handlePanUpload = (file) => {
    setPanFile(file || null);
  };

  const handleAadharUpload = (file) => {
    setAadharFile(file || null);
  };

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      if (mode === "login") {
        if (!isValidIndianMobile(loginPhone)) {
          toast.error("Please enter a valid 10-digit phone number starting with 6-9");
          return;
        }
        const res = await deliveryApi.sendLoginOtp({ phone: loginPhone });
        toast.success(res.data?.message || "OTP sent!");
      } else {
        if (!signupName.trim()) { toast.error("Please enter your name"); return; }
        if (!isValidIndianMobile(signupPhone)) { toast.error("Please enter a valid 10-digit phone number starting with 6-9"); return; }
        if (!profileImageFile) { toast.error("Please upload your profile photo"); return; }

        const formData = new FormData();
        formData.append("name", signupName.trim());
        formData.append("phone", signupPhone);
        formData.append("vehicleType", signupVehicle);
        formData.append("email", signupEmail);
        formData.append("address", signupAddress);
        if (signupDob) formData.append("dob", signupDob);
        if (signupBloodGroup) formData.append("bloodGroup", signupBloodGroup);
        formData.append("vehicleNumber", signupVehicleNumber);
        formData.append("drivingLicenseNumber", signupDLNumber);
        formData.append("accountHolder", signupAccountHolder);
        formData.append("accountNumber", signupAccountNumber);
        formData.append("ifsc", signupIfsc);
        if (signupAadharNumber) formData.append("aadharNumber", signupAadharNumber);
        if (signupPanNumber) formData.append("panNumber", signupPanNumber);
        if (signupExperience) formData.append("experienceYears", signupExperience);
        if (signupPreferredArea) formData.append("preferredArea", signupPreferredArea);

        if (profileImageFile) formData.append("profileImage", profileImageFile);
        if (aadharFile) formData.append("aadhar", aadharFile);
        if (panFile) formData.append("pan", panFile);
        if (dlFile) formData.append("dl", dlFile);

        const res = await deliveryApi.sendSignupOtp(formData);
        toast.success(res.data?.message || "OTP sent!");
      }
      const activePhone = mode === "login" ? loginPhone : signupPhone;
      setOtp(isDeliveryTestPhone(activePhone) ? DELIVERY_TEST_OTP.split("") : ["", "", "", "", "", ""]);
      setTimer(30);
      setStep("otp");
    } catch (error) {
      console.error(error);
      if (mode === "login" && error.response?.status === 403) {
        toast.info("Your account is pending approval.");
        navigate("/delivery/pending-approval", {
          replace: true,
          state: {
            approvalRequired: true,
            applicationStatus: "pending",
          },
        });
        return;
      }
      toast.error(error.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.some((d) => d === "") || !agreed) return;
    setLoading(true);
    try {
      const phone = mode === "login" ? loginPhone : signupPhone;
      const otpString = otp.join("");
      const response = await deliveryApi.verifyOtp({ phone, otp: otpString });
      const { token, delivery } = response.data.result;

      if (mode === "signup") {
        // Signup submitted successfully (approved or pending) — clear the draft.
        try {
          sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
        } catch {
          /* ignore */
        }
      }

      if (!delivery?.isVerified) {
        if (mode === "signup") {
          toast.success(
            "Application submitted. Dashboard access is enabled only after approval.",
          );
        } else {
          toast.info("Your account is pending approval.");
        }
        navigate("/delivery/pending-approval", {
          replace: true,
          state: {
            approvalRequired: true,
            applicationStatus: "pending",
          },
        });
        return;
      }

      login({ ...delivery, token, role: "delivery" });

      toast.success("Welcome! Redirecting to dashboard...");
      navigate("/delivery/dashboard");
    } catch (error) {
      console.error(error);
      if (error.response?.status === 403) {
        toast.info("Your account is pending approval.");
        navigate("/delivery/pending-approval", {
          replace: true,
          state: {
            approvalRequired: true,
            applicationStatus: "pending",
          },
        });
        return;
      }
      toast.error(error.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    if (value && !digit) return;
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = ["", "", "", "", "", ""];
    pasted.split("").forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    const focusIndex = Math.min(pasted.length, 5);
    document.getElementById(`otp-${focusIndex}`)?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const switchMode = (newMode) => {
    if (newMode === mode) return; // No-op if same tab
    setMode(newMode);
    setStep("form");
    setOtp(["", "", "", "", "", ""]);
    setSignupStep(1);
  };

  const slideVariants = {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -30, transition: { duration: 0.2 } },
  };

  return (
    <div className="min-h-screen bg-[#F0F4FF] flex flex-col items-center justify-center p-5 pt-20 font-['Outfit',_sans-serif]">
      {/* Fixed Logo Bar - stays pinned even on long, scrolling forms */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4">
        <div className="w-14 h-14 rounded-2xl bg-white/85 backdrop-blur-sm border border-brand-100 shadow-sm flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${appName} logo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <ShieldCheck className="w-5 h-5 text-brand-600" />
          )}
        </div>
      </div>
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-brand-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Card */}
        <div className="bg-white rounded-[2.5rem] shadow-[0_24px_60px_rgba(99,102,241,0.1)] border border-brand-50 overflow-hidden">

          {/* Header with Lottie */}
          <div className="bg-gradient-to-br from-brand-50 to-purple-50 p-8 pt-10 flex flex-col items-center relative">
            <div className="w-40 h-40">
              <Lottie animationData={deliveryRiding} loop />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${step}-title`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-center mt-3"
              >
                <h1 className="text-2xl font-black text-gray-900">
                  {step === "otp"
                    ? "Verify OTP"
                    : mode === "login"
                      ? "Partner Login"
                      : "Partner Registration"}
                </h1>
                <p className="text-gray-500 text-sm mt-1 max-w-[280px] mx-auto leading-relaxed">
                  {step === "otp"
                    ? `Enter the 6-digit code sent to +91 ${mode === "login" ? loginPhone : signupPhone}`
                    : mode === "login"
                      ? "Login with your registered phone number"
                      : `Step ${signupStep} of 4: ${signupStep === 1 ? "Personal Info" : signupStep === 2 ? "Vehicle Info" : signupStep === 3 ? "Bank Info" : "Documents"}`}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Tab Switch */}
          {step === "form" && (
            <div className="flex mx-6 mt-6 bg-gray-100 rounded-2xl p-1">
              {["login", "signup"].map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all duration-300 ${mode === m
                    ? "bg-white text-brand-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                    }`}
                >
                  {m === "login" ? "Login" : "Join Now"}
                </button>
              ))}
            </div>
          )}

          {/* Form Body */}
          <div className="p-6 pt-4">
            <AnimatePresence mode="wait">
              {step === "form" && (
                <motion.div
                  key={`form-${mode}`}
                  variants={slideVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-4"
                >
                  {/* ────────── SIGNUP MODE ────────── */}
                  {mode === "signup" && (
                    <div className="space-y-4">
                      {/* Step 1: Personal Information */}
                      {signupStep === 1 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-4"
                        >
                          {/* Profile Photo Capture */}
                          <div className="flex flex-col items-center justify-center py-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 self-start ml-1">Profile Photo</label>
                            <div className="relative group">
                              <div className="w-24 h-24 rounded-3xl bg-brand-50 border-2 border-dashed border-brand-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-brand-400">
                                {profileImagePreview ? (
                                  <img src={profileImagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-10 h-10 text-brand-300" />
                                )}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                capture="user"
                                id="profile-upload"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setProfileImageFile(file);
                                    setProfileImagePreview(URL.createObjectURL(file));
                                  }
                                }}
                              />
                              <label
                                htmlFor="profile-upload"
                                className="absolute -bottom-2 -right-2 p-2.5 bg-black  text-primary-foreground rounded-2xl shadow-lg shadow-brand-200 cursor-pointer hover:bg-brand-700 hover:scale-110 active:scale-95 transition-all"
                              >
                                <Camera className="w-4 h-4" />
                              </label>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold mt-3">Upload a clear photo of your face</p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                              <input
                                type="text"
                                value={signupName}
                                maxLength={50}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                  val = val.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
                                  setSignupName(val);
                                }}
                                onFocus={handleFieldFocus}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                placeholder="Enter your full name"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                              <span className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm border-r border-gray-200 pr-2.5">+91</span>
                              <input
                                type="tel"
                                value={signupPhone}
                                onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                onFocus={handleFieldFocus}
                                maxLength={10}
                                className="w-full pl-24 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                placeholder="00000 00000"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                              <input
                                type="email"
                                value={signupEmail}
                                onChange={(e) => setSignupEmail(e.target.value)}
                                onFocus={handleFieldFocus}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                placeholder="example@gmail.com"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Permanent Address</label>
                            <div className="relative">
                              <MapPin className="absolute left-4 top-4 text-gray-300 w-4 h-4" />
                              <textarea
                                value={signupAddress}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
                                  setSignupAddress(val);
                                  if (val && !/[a-zA-Z0-9]{3,}/.test(val)) {
                                    setValidationErrors(prev => ({ ...prev, address: "Address must contain at least 3 alphanumeric characters" }));
                                  } else {
                                    setValidationErrors(prev => ({ ...prev, address: "" }));
                                  }
                                }}
                                onFocus={handleFieldFocus}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-none h-24"
                                placeholder="Complete building address..."
                              />
                            </div>
                            {validationErrors.address && (
                              <p className="text-red-500 text-xs mt-1 ml-1">{validationErrors.address}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Date of Birth</label>
                              <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                <input
                                  type="date"
                                  value={signupDob}
                                  onChange={(e) => setSignupDob(e.target.value)}
                                  onFocus={handleFieldFocus}
                                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all uppercase"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Blood Group</label>
                              <div className="relative">
                                <Droplet className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                <select
                                  value={signupBloodGroup}
                                  onChange={(e) => setSignupBloodGroup(e.target.value)}
                                  onFocus={handleFieldFocus}
                                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all appearance-none"
                                >
                                  <option value="">Select...</option>
                                  <option value="A+">A+</option>
                                  <option value="A-">A-</option>
                                  <option value="B+">B+</option>
                                  <option value="B-">B-</option>
                                  <option value="O+">O+</option>
                                  <option value="O-">O-</option>
                                  <option value="AB+">AB+</option>
                                  <option value="AB-">AB-</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (!signupName || !signupPhone || !signupEmail || !signupAddress || !signupDob || !signupBloodGroup || !profileImageFile) {
                                toast.error("Please fill all personal information fields and upload photo");
                                return;
                              }
                              if (!isValidIndianMobile(signupPhone)) {
                                toast.error("Please enter a valid 10-digit phone number starting with 6-9");
                                return;
                              }
                              setSignupStep(2);
                            }}
                            className="w-full py-4 bg-black  text-primary-foreground rounded-2xl text-sm font-black tracking-widest uppercase shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                          >
                            Next Step <ArrowRight className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}

                      {/* Step 2: Vehicle Information */}
                      {signupStep === 2 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-4"
                        >
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Vehicle Type</label>
                            <div className="relative">
                              <Bike className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                              <button
                                type="button"
                                onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                                className="w-full pl-11 pr-10 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none text-left"
                              >
                                {VEHICLE_TYPES.find((v) => v.value === signupVehicle)?.label}
                              </button>
                              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <AnimatePresence>
                                {showVehicleDropdown && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-lg mt-2 overflow-hidden z-20"
                                  >
                                    {VEHICLE_TYPES.map((v) => (
                                      <button
                                        key={v.value}
                                        onClick={() => { setSignupVehicle(v.value); setShowVehicleDropdown(false); }}
                                        className="w-full px-4 py-3 text-sm font-bold text-left hover:bg-brand-50 transition-colors"
                                      >
                                        {v.label}
                                      </button>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                              {isCycleVehicle ? "Cycle Identifier (Optional)" : "Vehicle Plate Number"}
                            </label>
                            <div className="relative">
                              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                              <input
                                type="text"
                                value={signupVehicleNumber}
                                maxLength={20}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^a-zA-Z0-9\s]/g, "").toUpperCase();
                                  setSignupVehicleNumber(val);
                                }}
                                onFocus={handleFieldFocus}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                placeholder={isCycleVehicle ? "HERO CYCLE / FRAME NO. (Optional)" : "KA 05 MN 8921"}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                              {isCycleVehicle ? "Government ID Number (Optional)" : "Driving License Number"}
                            </label>
                            <div className="relative">
                              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                              <input
                                type="text"
                                value={signupDLNumber}
                                maxLength={16}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                                  setSignupDLNumber(val);
                                }}
                                onFocus={handleFieldFocus}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                placeholder={isCycleVehicle ? "AADHAAR / OTHER ID (Optional)" : "DL-1420110012345"}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Delivery Experience (Years)</label>
                            <div className="relative">
                              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                              <input
                                type="text"
                                inputMode="numeric"
                                value={signupExperience}
                                maxLength={2}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                                  setSignupExperience(val);
                                }}
                                onFocus={handleFieldFocus}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                placeholder="e.g. 2"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Preferred Work Area</label>
                            <div className="relative">
                              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                              <input
                                type="text"
                                value={signupPreferredArea}
                                maxLength={80}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
                                  setSignupPreferredArea(val);
                                }}
                                onFocus={handleFieldFocus}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                placeholder="Area/locality you'd like to deliver in"
                              />
                            </div>
                          </div>

                          <div className="flex gap-4 pt-2">
                            <button
                              onClick={() => setSignupStep(1)}
                              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                            >
                              Back
                            </button>
                            <button
                              onClick={() => {
                                if (!isCycleVehicle && !signupVehicleNumber) {
                                  toast.error("Please enter your vehicle plate number");
                                  return;
                                }
                                if (!isCycleVehicle && !signupDLNumber) {
                                  toast.error("Please enter your driving license number");
                                  return;
                                }
                                if (!signupExperience) {
                                  toast.error("Please enter your delivery experience");
                                  return;
                                }
                                if (!signupPreferredArea) {
                                  toast.error("Please enter your preferred work area");
                                  return;
                                }
                                setSignupStep(3);
                              }}
                              className="flex-[2] py-4 bg-black  text-primary-foreground rounded-2xl text-sm font-black tracking-widest uppercase shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                            >
                              Next Step <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 3: Bank Information */}
                      {signupStep === 3 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-4"
                        >
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Aadhar Number</label>
                            <input
                              type="text"
                              value={signupAadharNumber}
                              onChange={(e) => setSignupAadharNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                              onFocus={handleFieldFocus}
                              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                              placeholder="0000 0000 0000"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">PAN Card Number</label>
                            <input
                              type="text"
                              value={signupPanNumber}
                              maxLength={10}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                                setSignupPanNumber(val);
                                if (val.length === 10 && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
                                  setValidationErrors(prev => ({ ...prev, pan: "Invalid PAN format (e.g., ABCDE1234F)" }));
                                } else {
                                  setValidationErrors(prev => ({ ...prev, pan: "" }));
                                }
                              }}
                              onFocus={handleFieldFocus}
                              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all font-mono"
                              placeholder="ABCDE1234F"
                            />
                            {validationErrors.pan && (
                              <p className="text-red-500 text-xs mt-1 ml-1">{validationErrors.pan}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Account Holder Name</label>
                            <input
                              type="text"
                              value={signupAccountHolder}
                              maxLength={50}
                              onChange={(e) => {
                                let val = e.target.value.replace(/[^a-zA-Z\s]/g, "").toUpperCase();
                                val = val.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
                                setSignupAccountHolder(val);
                              }}
                              onFocus={handleFieldFocus}
                              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                              placeholder="AS PER BANK RECORDS"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Account Number</label>
                            <input
                              type="text"
                              value={signupAccountNumber}
                              maxLength={18}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                setSignupAccountNumber(val);
                                if (val.length > 0 && val.length < 9) {
                                  setValidationErrors(prev => ({ ...prev, account: "Account number must be 9-18 digits" }));
                                } else {
                                  setValidationErrors(prev => ({ ...prev, account: "" }));
                                }
                              }}
                              onFocus={handleFieldFocus}
                              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                              placeholder="000000000000"
                            />
                            {validationErrors.account && (
                              <p className="text-red-500 text-xs mt-1 ml-1">{validationErrors.account}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">IFSC Code</label>
                            <input
                              type="text"
                              value={signupIfsc}
                              maxLength={11}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                                setSignupIfsc(val);
                                if (val.length === 11 && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(val)) {
                                  setValidationErrors(prev => ({ ...prev, ifsc: "Invalid IFSC format" }));
                                } else {
                                  setValidationErrors(prev => ({ ...prev, ifsc: "" }));
                                }
                              }}
                              onFocus={handleFieldFocus}
                              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                              placeholder="HDFC0001234"
                            />
                            {validationErrors.ifsc && (
                              <p className="text-red-500 text-xs mt-1 ml-1">{validationErrors.ifsc}</p>
                            )}
                          </div>

                          <div className="flex gap-4 pt-2">
                            <button
                              onClick={() => setSignupStep(2)}
                              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                            >
                              Back
                            </button>
                            <button
                              onClick={() => {
                                if (!signupAadharNumber || !signupPanNumber || !signupAccountHolder || !signupAccountNumber || !signupIfsc) {
                                  toast.error("Please fill all bank and identification fields");
                                  return;
                                }
                                if (signupAadharNumber.length !== 12) {
                                  toast.error("Aadhar number must be 12 digits");
                                  return;
                                }
                                if (signupPanNumber.length !== 10) {
                                  toast.error("PAN number must be 10 characters");
                                  return;
                                }
                                setSignupStep(4);
                              }}
                              className="flex-[2] py-4 bg-black  text-primary-foreground rounded-2xl text-sm font-black tracking-widest uppercase shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                            >
                              Next Step <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 4: Documents Upload */}
                      {signupStep === 4 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-4"
                        >
                          <div className="space-y-3">
                            {[
                              { label: "Aadhar Card (Front/Back)", state: aadharFile, setter: setAadharFile, id: "aadhar" },
                              { label: "PAN Card", state: panFile, setter: setPanFile, id: "pan" },
                              {
                                label: isCycleVehicle ? "Government ID (Optional for Cycle)" : "Driving License",
                                state: dlFile,
                                setter: setDlFile,
                                id: "dl",
                              },
                            ].map((doc) => (
                              <div key={doc.id} className="relative">
                                <input
                                  type="file"
                                  id={doc.id}
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (doc.id === "dl") handleDLUpload(file);
                                    else if (doc.id === "pan") handlePanUpload(file);
                                    else if (doc.id === "aadhar") handleAadharUpload(file);
                                    else doc.setter(file);
                                  }}
                                />
                                <label
                                  htmlFor={doc.id}
                                  className={`flex items-center justify-between p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${doc.state
                                    ? "border-brand-200 bg-brand-50/50"
                                    : "border-gray-100 bg-gray-50 hover:border-brand-200 hover:bg-brand-50/30"
                                    }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${doc.state ? "bg-brand-100 text-brand-600" : "bg-white text-gray-400 shadow-sm"}`}>
                                      {doc.state ? <CheckCircle className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                                    </div>
                                    <div className="text-left">
                                      <p className={`text-xs font-black uppercase tracking-tight ${doc.state ? "text-brand-700" : "text-gray-500"}`}>
                                        {doc.label}
                                      </p>
                                      <p className="text-[10px] text-gray-400 font-bold truncate max-w-[180px]">
                                        {doc.state ? doc.state.name : "Tap to upload document"}
                                      </p>
                                    </div>
                                  </div>
                                  {doc.state && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        doc.setter(null);
                                      }}
                                      className="p-1.5 hover:bg-brand-100 rounded-lg text-brand-600 transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </label>


                              </div>
                            ))}
                            <p className="text-[10px] text-gray-400 italic px-1 flex items-center gap-1.5">
                              <ShieldCheck className="w-3 h-3 text-brand-300" />
                              Documents will be verified by our team after submission.
                            </p>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => setSignupStep(3)}
                              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                            >
                              Back
                            </button>
                            <button
                              onClick={handleSendOtp}
                              disabled={loading}
                              className="flex-[2] py-4 bg-black  text-primary-foreground rounded-2xl text-sm font-black tracking-widest uppercase shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  Register <ArrowRight className="w-4 h-4" />
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}

                      <p className="text-center text-xs text-gray-400 font-semibold pt-1">
                        By joining, you agree to our{" "}
                        <a href="/terms?for=delivery" target="_blank" rel="noopener noreferrer" className="text-brand-500 font-bold hover:underline">Terms</a>
                        {" "}&amp;{" "}
                        <a href="/privacy?for=delivery" target="_blank" rel="noopener noreferrer" className="text-brand-500 font-bold hover:underline">Privacy Policy</a>
                      </p>
                    </div>
                  )}

                  {/* ────────── LOGIN MODE ────────── */}
                  {mode === "login" && (
                    <div className="space-y-4">
                      {/* Phone */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                          Phone Number
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                          <span className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm border-r border-gray-200 pr-2.5">
                            +91
                          </span>
                          <input
                            type="tel"
                            value={loginPhone}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                              setLoginPhone(val);
                            }}
                            maxLength={10}
                            className="w-full pl-24 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder:text-gray-300"
                            placeholder="00000 00000"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSendOtp}
                        disabled={loading}
                        className="w-full py-4 bg-black  text-primary-foreground rounded-2xl text-sm font-black tracking-widest uppercase shadow-lg shadow-brand-200 hover:bg-brand-700 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>Login Now <ArrowRight className="w-4 h-4" /></>
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ─── OTP STEP ─── */}
              {step === "otp" && (
                <motion.div
                  key="otp"
                  variants={slideVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-5"
                >
                  {/* OTP Boxes */}
                  <div className="space-y-3 text-center">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      Enter Security Code
                    </label>
                    <div className="grid grid-cols-6 gap-2 w-full max-w-[300px] mx-auto pt-1">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          id={`otp-${index}`}
                          type="tel"
                          inputMode="numeric"
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onPaste={index === 0 ? handleOtpPaste : undefined}
                          aria-label={`OTP digit ${index + 1}`}
                          className="w-full h-12 text-center text-xl font-black border-2 border-gray-100 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all bg-gray-50 text-gray-900"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Timer / Resend */}
                  <div className="text-center">
                    {timer > 0 ? (
                      <p className="text-gray-400 text-sm font-medium">
                        Resend code in <span className="text-brand-600 font-bold">{timer}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={handleSendOtp}
                        className="text-brand-600 font-black text-sm uppercase tracking-wide hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>

                  {/* Terms checkbox */}
                  <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <input
                      id="terms"
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-brand-600 cursor-pointer"
                    />
                    <label htmlFor="terms" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                      I confirm my phone number is correct and I agree to the{" "}
                      <Link to="/terms?for=delivery" target="_blank" className="text-brand-600 font-bold hover:underline">Terms of Service</Link> &amp;{" "}
                      <Link to="/privacy?for=delivery" target="_blank" className="text-brand-600 font-bold hover:underline">Privacy Policy</Link>.
                    </label>
                  </div>

                  {/* Verify Button */}
                  <button
                    onClick={handleVerifyOtp}
                    disabled={!agreed || otp.some((d) => !d) || loading}
                    className="w-full py-4 bg-black  text-primary-foreground rounded-2xl text-sm font-black tracking-widest uppercase shadow-lg shadow-brand-200 hover:bg-brand-700 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Verify &amp; Login <CheckCircle className="w-4 h-4" /></>
                    )}
                  </button>

                  {/* Back */}
                  <button
                    onClick={() => { setStep("form"); setOtp(["", "", "", "", "", ""]); }}
                    className="w-full flex items-center justify-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm font-bold transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Edit Phone Number
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-3 opacity-40">
          <span className="h-px w-8 bg-gray-400" />
          <ShieldCheck className="text-gray-500 w-4 h-4" />
          <span className="h-px w-8 bg-gray-400" />
        </div>
        <p className="text-center text-[10px] font-black text-gray-300 uppercase tracking-[4px] mt-2">
          {appName} Partner Ecosystem • v1.0
        </p>
      </motion.div>
    </div>
  );
};

export default DeliveryAuth;
