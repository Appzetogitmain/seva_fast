import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Store,
  Shield,
  Edit2,
  Save,
  X,
  Rocket,
  Globe,
  MapPin,
  CheckCircle,
  FileText,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import MapPicker from "../../../shared/components/MapPicker";
import AuthorisedSellerCertificateView from "@shared/components/AuthorisedSellerCertificateView";
import { HiOutlineXMark } from "react-icons/hi2";
import verifiedSeal from "@/assets/verified-seal.png";

const SellerProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isEditingRadius, setIsEditingRadius] = useState(false);
  const [radiusDraft, setRadiusDraft] = useState(5);
  const [isSavingRadius, setIsSavingRadius] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    shopName: "",
    phone: "",
    email: "",
    lat: null,
    lng: null,
    radius: 5,
    address: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await sellerApi.getProfile();
      const data = response.data.result;
      setProfile(data);
      setFormData({
        name: data.name,
        shopName: data.shopName,
        phone: data.phone,
        email: data.email,
        lat: data.location?.coordinates[1] || null,
        lng: data.location?.coordinates[0] || null,
        radius: data.serviceRadius || 5,
        address: data.address || "",
      });
    } catch (error) {
      toast.error("Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      const cleaned = value.replace(/[0-9]/g, "");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "phone") {
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 10);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "email") {
      setFormData({ ...formData, [name]: value.trimStart() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[0-9]{10}$/.test(formData.phone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        lat: formData.lat,
        lng: formData.lng,
        radius: formData.radius,
      };
      await sellerApi.updateProfile(payload);
      toast.success("Profile updated successfully");
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRadius = async () => {
    const value = Number(radiusDraft);
    if (!value || value < 1 || value > 50) {
      toast.error("Radius must be between 1 and 50 km");
      return;
    }
    setIsSavingRadius(true);
    try {
      await sellerApi.updateProfile({ radius: value });
      toast.success("Service radius updated");
      setIsEditingRadius(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update radius");
    } finally {
      setIsSavingRadius(false);
    }
  };

  const toggleStatus = async () => {
    try {
      const newStatus = !profile.isActive;
      await sellerApi.updateProfile({ isActive: newStatus });
      setProfile((prev) => ({ ...prev, isActive: newStatus }));
      toast.success(`Shop is now ${newStatus ? "Active" : "Inactive"}`);
    } catch (error) {
      toast.error("Failed to update shop status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8 font-['Outfit'] pb-24">
      {/* Header Section */}
      <div className="mb-6 sm:mb-8">
        {/* Banner Background */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-black h-40 sm:h-52 md:h-64 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-slate-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>
        </div>

        {/* Profile Info Row */}
        <div className="relative -mt-14 sm:-mt-20 mx-2 sm:mx-6 md:mx-10 flex flex-col md:flex-row items-center md:items-start gap-4 sm:gap-6 md:gap-8 z-10">
          {/* Avatar Container */}
          <div className="h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44 rounded-full bg-white p-1.5 sm:p-2 shadow-2xl flex-shrink-0 mx-auto md:mx-0 relative z-20">
            <div className="h-full w-full rounded-full bg-slate-50 flex items-center justify-center border-4 border-slate-50 overflow-hidden relative">
              <span className="text-4xl sm:text-5xl md:text-7xl font-black text-slate-900">
                {profile?.name?.charAt(0)}
              </span>
            </div>
          </div>

          {/* Info Block */}
          <div className="flex-1 min-w-0 pt-2 md:pt-24 pb-2 md:pb-4 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-3">
              <span className="px-3.5 py-1 bg-slate-900 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[2px] rounded-full shadow-md">
                {profile?.role}
              </span>
              <button
                onClick={toggleStatus}
                className={`group flex items-center gap-2 px-3.5 py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-[2px] rounded-full border transition-all hover:scale-105 active:scale-95 shadow-md ${
                  profile?.isActive
                    ? "bg-emerald-500 text-white border-emerald-400"
                    : "bg-rose-500 text-white border-rose-400"
                }`}>
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${
                    profile?.isActive ? "bg-emerald-200" : "bg-rose-200"
                  }`}
                />
                {profile?.isActive ? "Active" : "Inactive"}
              </button>
            </div>
            
            <div className="flex flex-wrap md:flex-nowrap items-center justify-center md:justify-start gap-2.5 mb-1.5">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight drop-shadow-sm break-words">
                {profile?.name}
              </h1>
              {profile?.isVerified && profile?.applicationStatus === "approved" && (
                <img 
                  src={verifiedSeal} 
                  alt="Verified Seller" 
                  className="w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain inline-block drop-shadow-lg shrink-0" 
                  title="Verified & Authorized Seller"
                />
              )}
            </div>
            
            <p className="text-slate-500 font-bold tracking-[1px] text-sm sm:text-base md:text-lg">
              {profile?.shopName}
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2 md:pt-24 pb-2 md:pb-4 w-full md:w-auto shrink-0">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full md:w-auto bg-slate-900 text-white hover:bg-slate-800 transition-all rounded-xl px-6 lg:px-10 py-3.5 sm:py-4 flex items-center justify-center gap-3 font-black tracking-[2px] text-xs shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap">
                <Edit2 size={16} /> EDIT PROFILE
              </Button>
            ) : (
              <div className="w-full md:w-auto flex gap-3 justify-center md:justify-end">
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="h-12 sm:h-14 w-12 sm:w-14 flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl shadow-sm transition-all shrink-0">
                  <X size={20} className="stroke-[2.5]" />
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="flex-1 md:flex-none bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-6 sm:px-8 py-3.5 sm:py-4 font-black tracking-[2px] text-xs flex items-center justify-center gap-3 shadow-lg h-12 sm:h-14 whitespace-nowrap">
                  {isSaving ? (
                    "UPDATING..."
                  ) : (
                    <>
                      <Save size={18} /> SAVE CHANGES
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Info Column */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          {/* Official KYC Document Card */}
          {profile?.officialKycDocumentUrl && (
            <div className="p-4 sm:p-6 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-emerald-500/30 relative overflow-hidden">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 relative z-10">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40 shadow-inner mt-0.5 sm:mt-0">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">Official KYC Document</h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black tracking-widest uppercase border border-emerald-500/30">VERIFIED</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                    Official signed 2-page SEVAFAST Seller KYC document is available for view or download.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.open(profile.officialKycDocumentUrl, '_blank', 'noopener,noreferrer')}
                className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all shrink-0 cursor-pointer">
                <ExternalLink size={16} className="text-slate-950 shrink-0" />
                <span>View KYC PDF</span>
              </button>
            </div>
          )}

          {/* Subscription Plan Status Card */}
          <div className="p-4 sm:p-5 md:p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className={`p-3 rounded-xl shrink-0 ${
                  profile?.commissionModel === 'PLAN_BASED' && profile?.subscription?.expiresAt && new Date(profile.subscription.expiresAt) > new Date()
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-slate-900 text-white'
                }`}>
                  <ShieldCheck size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Charging Model</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase ${
                      profile?.commissionModel === 'PLAN_BASED' && profile?.subscription?.expiresAt && new Date(profile.subscription.expiresAt) > new Date()
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {profile?.commissionModel === 'PLAN_BASED' && profile?.subscription?.expiresAt && new Date(profile.subscription.expiresAt) > new Date()
                        ? '0% Commission Active'
                        : 'Category Commission (%)'}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 mt-0.5 truncate">
                    {profile?.commissionModel === 'PLAN_BASED' && profile?.subscription?.planName
                      ? profile.subscription.planName
                      : 'Category-Wise Commission Model'}
                  </h4>
                  {profile?.subscription?.expiresAt && profile?.commissionModel === 'PLAN_BASED' && (
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <Clock size={12} className="text-slate-400 shrink-0" />
                      Valid Until: <span className="font-mono text-slate-900">{new Date(profile.subscription.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </p>
                  )}
                </div>
              </div>

              {profile?.commissionModel === 'PLAN_BASED' && profile?.subscription?.expiresAt && new Date(profile.subscription.expiresAt) > new Date() ? (
                <button
                  type="button"
                  onClick={() => navigate('/seller/plans')}
                  className="w-full lg:w-auto px-4 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 active:scale-95 font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer whitespace-nowrap">
                  <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
                  <span>View Active Pass</span>
                  <ArrowRight size={13} className="shrink-0 text-emerald-600" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/seller/plans')}
                  className="w-full lg:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-md transition-all shrink-0 cursor-pointer whitespace-nowrap">
                  <Sparkles size={15} className="shrink-0 text-amber-300" />
                  <span>Browse 0% Plans</span>
                  <ArrowRight size={13} className="shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* Business Profile Card */}
          <Card className="p-4 sm:p-6 md:p-8 border-none shadow-sm rounded-2xl">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-6 sm:mb-8 border-b border-slate-100 pb-4">
              Business Profile
            </h3>

            <form className="space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Seller Identity
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Store Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Store size={18} />
                    </div>
                    <input
                      type="text"
                      name="shopName"
                      value={formData.shopName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Contact Number
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>
            </form>
          </Card>

          {/* Location & Radius Settings Card */}
          <Card className="p-4 sm:p-6 md:p-8 border-none shadow-sm rounded-2xl">
            <div className="flex justify-between items-center mb-6 sm:mb-8 border-b border-slate-100 pb-4">
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                Location & Service Settings
              </h3>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border-2 border-slate-100/80 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div
                      className={`h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${
                        formData.lat
                          ? "bg-brand-100 text-brand-600 shadow-sm"
                          : "bg-white text-slate-400 shadow-sm"
                      }`}>
                      <MapPin size={22} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs sm:text-sm font-black text-slate-900">
                        {formData.lat
                          ? "Store Location Pin"
                          : "Location Not Defined"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed break-words">
                        {formData.address ||
                          "Click change to precisely mark your shop location on the map for delivery accuracy."}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="w-full sm:w-auto bg-white text-slate-900 border-2 border-slate-200 hover:border-slate-900 rounded-xl px-6 py-2.5 text-[10px] font-black tracking-[2px] shadow-sm hover:shadow-md transition-all whitespace-nowrap">
                      CHANGE PIN
                    </Button>
                  )}
                </div>

                <div className="pt-4 sm:pt-6 border-t border-slate-200/60 flex flex-wrap gap-4 sm:gap-8">
                  <div className="space-y-1">
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Service Radius
                    </span>
                    <div className="flex items-center gap-2">
                      {isEditingRadius ? (
                        <>
                          <input
                            type="number"
                            value={radiusDraft}
                            onChange={(e) => setRadiusDraft(e.target.value)}
                            min="1"
                            max="50"
                            autoFocus
                            className="w-16 px-2 py-1 bg-white border-2 border-slate-200 rounded-md text-sm font-bold text-slate-900 outline-none focus:border-brand-400 transition-all text-center"
                          />
                          <span className="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md">
                            KM
                          </span>
                          <button
                            type="button"
                            onClick={handleSaveRadius}
                            disabled={isSavingRadius}
                            title="Save radius"
                            className="p-1.5 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-60">
                            <CheckCircle size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingRadius(false);
                              setRadiusDraft(formData.radius);
                            }}
                            disabled={isSavingRadius}
                            title="Cancel"
                            className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-base sm:text-lg font-black text-slate-900">
                            {formData.radius}
                          </span>
                          <span className="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md">
                            KM
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRadiusDraft(formData.radius);
                              setIsEditingRadius(true);
                            }}
                            title="Edit radius"
                            className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white transition-all">
                            <Edit2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {formData.lat && (
                    <>
                      <div className="space-y-1">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Latitude
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-700 tabular-nums">
                          {formData.lat.toFixed(6)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Longitude
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-700 tabular-nums">
                          {formData.lng.toFixed(6)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 sm:p-4 bg-amber-50 rounded-xl border border-amber-100">
                <Shield size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] sm:text-xs text-amber-700 font-medium leading-relaxed">
                  Your shop location and service radius determine which
                  customers can view your products. Ensure the marker is placed
                  exactly at your physical storefront for accurate delivery
                  assignments.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6 sm:space-y-8">
          {/* Security Card */}
          <Card className="p-6 sm:p-8 border-none shadow-sm rounded-2xl sm:rounded-[36px] bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[4px] text-white/40 mb-6">
              Security & Trust
            </h4>
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    Verification
                  </p>
                  <p className="text-xs sm:text-sm font-bold">
                    {profile?.isVerified
                      ? "Verified Merchant"
                      : "Verification Pending"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Rocket size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    Partner Tier
                  </p>
                  <p className="text-xs sm:text-sm font-bold">Standard Growth</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Globe size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    Region
                  </p>
                  <p className="text-xs sm:text-sm font-bold">Pan India Reach</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Authorised Seller Certificate Card */}
          <Card className="p-5 sm:p-7 border-none shadow-sm rounded-2xl sm:rounded-[32px] bg-gradient-to-br from-amber-950 via-slate-900 to-orange-950 text-white relative overflow-hidden ring-1 ring-amber-500/20">
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between gap-3 mb-5 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Authorised Certificate
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Marketplace Authorization
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {profile?.certificate ? (
                <>
                  <div className="bg-white/5 border border-amber-500/30 p-3.5 rounded-2xl flex items-center gap-3 backdrop-blur-sm">
                    <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40 shadow-inner">
                      <CheckCircle size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-white leading-snug truncate">
                        {profile.certificate.certificateNo || 'SEVAFAST Certificate'}
                      </p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black tracking-wider uppercase border border-emerald-500/30">
                        {profile.certificate.accepted ? 'Accepted & Verified' : 'Pending Acceptance'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCertModalOpen(true)}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] text-slate-950 font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all cursor-pointer">
                    <ExternalLink size={16} className="shrink-0 text-slate-950" />
                    <span>View / Print Certificate</span>
                  </button>
                </>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                    Authorised Seller Certificate will be issued upon admin approval.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Official KYC Card */}
          <Card className="p-5 sm:p-7 border-none shadow-sm rounded-2xl sm:rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white relative overflow-hidden ring-1 ring-emerald-500/20">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between gap-3 mb-5 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Official KYC Document
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Admin Verified Document
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {profile?.officialKycDocumentUrl ? (
                <>
                  <div className="bg-white/5 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center gap-3 backdrop-blur-sm">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40 shadow-inner">
                      <CheckCircle size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-white leading-snug">SEVAFAST Verified KYC Form</p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black tracking-wider uppercase border border-emerald-500/30">
                        {profile?.kycUploadedAt 
                          ? `Verified on ${new Date(profile.kycUploadedAt).toLocaleDateString()}` 
                          : 'Official Admin PDF'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.open(profile.officialKycDocumentUrl, '_blank', 'noopener,noreferrer')}
                    className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer">
                    <ExternalLink size={16} className="shrink-0 text-slate-950" />
                    <span>View / Download KYC PDF</span>
                  </button>
                </>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                    Official KYC document will be uploaded by SEVAFAST Admin upon account verification.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Rider Invite Code */}
          <Card className="p-6 sm:p-8 border-none shadow-sm rounded-2xl sm:rounded-[36px] bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <h4 className="text-[10px] font-black uppercase tracking-[4px] text-indigo-400 mb-4">
              Rider Invite Code
            </h4>
            <div className="space-y-4">
              <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                Riders can enter this code during signup to automatically register under your store's delivery fleet.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 relative">
                <span className="text-xl sm:text-2xl font-black tracking-widest text-indigo-300 uppercase font-mono break-all text-center">
                  {profile?.sellerCode || "SV-SEVA12"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (profile?.sellerCode) {
                      navigator.clipboard.writeText(profile.sellerCode);
                      toast.success("Invite code copied to clipboard!");
                    }
                  }}
                  className="text-[10px] font-black tracking-[1.5px] uppercase text-slate-400 hover:text-white transition-colors">
                  COPY CODE
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-bold text-slate-500 border-t border-slate-200/60 pt-6">
        <button
          type="button"
          onClick={() => navigate("/terms?for=seller")}
          className="hover:text-slate-900 underline-offset-2 hover:underline"
        >
          Terms &amp; Conditions
        </button>
        <span className="text-slate-300">•</span>
        <button
          type="button"
          onClick={() => navigate("/privacy?for=seller")}
          className="hover:text-slate-900 underline-offset-2 hover:underline"
        >
          Privacy Policy
        </button>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={
            formData.lat ? { lat: formData.lat, lng: formData.lng } : null
          }
          initialRadius={formData.radius}
        />
      )}

      {isCertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col h-[95vh] sm:h-[90vh] max-h-[95vh] overflow-hidden border border-amber-200">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm sm:text-lg">Authorised Seller Certificate</h3>
              <button
                type="button"
                onClick={() => setIsCertModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition"
              >
                <HiOutlineXMark className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-0 bg-slate-50 overscroll-contain">
              <AuthorisedSellerCertificateView
                certificate={profile?.certificate}
                seller={profile}
                showPrintButton={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProfile;
