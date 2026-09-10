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
      setRadiusDraft(data.serviceRadius || 5);
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
      let digits = value.replace(/[^0-9]/g, "");
      if (digits.length === 12 && digits.startsWith("91")) {
        digits = digits.slice(2);
      } else if (digits.length === 11 && digits.startsWith("0")) {
        digits = digits.slice(1);
      }
      setFormData({ ...formData, [name]: digits.slice(0, 10) });
    } else if (name === "email") {
      setFormData({ ...formData, [name]: value.trimStart() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let cleanPhone = String(formData.phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) cleanPhone = cleanPhone.slice(2);
    else if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
    if (!/^[6-9][0-9]{9}$/.test(cleanPhone)) {
      toast.error("Please enter a valid 10-digit phone number starting with 6-9.");
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

  const togglePhotoOrders = async () => {
    try {
      const newVal = !profile.acceptsPhotoOrders;
      await sellerApi.updateProfile({ acceptsPhotoOrders: newVal });
      setProfile((prev) => ({ ...prev, acceptsPhotoOrders: newVal }));
      toast.success(newVal ? "Now accepting photo orders" : "No longer accepting photo orders");
    } catch (error) {
      toast.error("Failed to update photo order setting");
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
    <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8 font-['Outfit'] space-y-6 pb-20">
      {/* Sleek Unified Profile Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Subtle Top Accent Banner */}
        <div className="h-28 sm:h-36 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-25">
            <div className="absolute top-0 left-1/4 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
          </div>
        </div>

        {/* Profile Card Body */}
        <div className="px-4 sm:px-8 pb-6 sm:pb-8 pt-0">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 sm:gap-6 -mt-14 sm:-mt-16">
            {/* Avatar & Store Info */}
            <div className="flex flex-col md:flex-row items-center md:items-end gap-4 sm:gap-5 text-center md:text-left">
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl bg-white p-1.5 shadow-xl shrink-0 relative z-10 border border-slate-100">
                <div className="h-full w-full rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-3xl sm:text-4xl font-black text-slate-900">
                  {profile?.name?.charAt(0) || "S"}
                </div>
              </div>

              <div className="space-y-1.5 pb-1">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="px-3 py-0.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm">
                    {profile?.role || "SELLER"}
                  </span>
                  
                  <button
                    onClick={toggleStatus}
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full border transition-all hover:scale-105 active:scale-95 shadow-sm ${
                      profile?.isActive
                        ? "bg-emerald-500 text-white border-emerald-400"
                        : "bg-rose-500 text-white border-rose-400"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${profile?.isActive ? "bg-emerald-200 animate-pulse" : "bg-rose-200"}`} />
                    {profile?.isActive ? "Active Shop" : "Inactive Shop"}
                  </button>

                  <button
                    onClick={togglePhotoOrders}
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full border transition-all hover:scale-105 active:scale-95 shadow-sm ${
                      profile?.acceptsPhotoOrders
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${profile?.acceptsPhotoOrders ? "bg-indigo-200 animate-pulse" : "bg-slate-400"}`} />
                    {profile?.acceptsPhotoOrders ? "Photo Orders ON" : "Photo Orders OFF"}
                  </button>
                </div>

                <div className="flex items-center justify-center md:justify-start gap-2 pt-0.5">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                    {profile?.shopName || profile?.name}
                  </h1>
                  {profile?.isVerified && profile?.applicationStatus === "approved" && (
                    <img 
                      src={verifiedSeal} 
                      alt="Verified" 
                      className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0 drop-shadow-sm" 
                      title="Verified & Authorized Seller"
                    />
                  )}
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-500">
                  Owned by <span className="font-bold text-slate-800">{profile?.name}</span> • {formData.address || "Location not set"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full md:w-auto shrink-0 pt-2 md:pt-0">
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="w-full md:w-auto bg-slate-900 text-white hover:bg-slate-800 transition-all rounded-xl px-6 py-2.5 sm:py-3 flex items-center justify-center gap-2 font-bold text-xs tracking-wider shadow-md hover:shadow-lg">
                  <Edit2 size={15} /> <span>EDIT PROFILE</span>
                </Button>
              ) : (
                <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="outline"
                    className="h-10 px-4 rounded-xl text-slate-600 hover:bg-slate-100 border-slate-300 text-xs font-bold">
                    <X size={16} className="mr-1.5" /> CANCEL
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="flex-1 md:flex-none bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-6 py-2.5 h-10 font-bold text-xs tracking-wider shadow-md flex items-center justify-center gap-2">
                    {isSaving ? (
                      "SAVING..."
                    ) : (
                      <>
                        <Save size={15} /> <span>SAVE CHANGES</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main 2-Column Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription Plan Status Card */}
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className={`p-3 rounded-xl shrink-0 ${
                  profile?.commissionModel === 'PLAN_BASED' && profile?.subscription?.expiresAt && new Date(profile.subscription.expiresAt) > new Date()
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-slate-900 text-white'
                }`}>
                  <ShieldCheck size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Commission Model</span>
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
                  <h4 className="text-sm sm:text-base font-black text-slate-900 mt-1 truncate">
                    {profile?.commissionModel === 'PLAN_BASED' && profile?.subscription?.planName
                      ? profile.subscription.planName
                      : 'Category-Wise Commission Model'}
                  </h4>
                  {profile?.subscription?.expiresAt && profile?.commissionModel === 'PLAN_BASED' && (
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
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
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 active:scale-95 font-bold tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer">
                  <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
                  <span>View Active Pass</span>
                  <ArrowRight size={13} className="shrink-0 text-emerald-600" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/seller/plans')}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer">
                  <Sparkles size={15} className="shrink-0 text-amber-300" />
                  <span>Browse 0% Plans</span>
                  <ArrowRight size={13} className="shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* Business Profile Details Card */}
          <Card className="p-5 sm:p-7 border border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Store size={18} className="text-slate-700" /> Store & Business Information
            </h3>

            <form className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Seller Full Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-900 transition-all disabled:opacity-75 disabled:bg-slate-50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Shop / Store Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                      <Store size={16} />
                    </div>
                    <input
                      type="text"
                      name="shopName"
                      value={formData.shopName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-900 transition-all disabled:opacity-75 disabled:bg-slate-50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Registered Mobile Number
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                      <Phone size={16} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-900 transition-all disabled:opacity-75 disabled:bg-slate-50 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-900 transition-all disabled:opacity-75 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>
            </form>
          </Card>

          {/* Location & Radius Settings Card */}
          <Card className="p-5 sm:p-7 border border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <MapPin size={18} className="text-slate-700" /> Store Location & Delivery Radius
            </h3>

            <div className="space-y-5">
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/70 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-all ${
                        formData.lat
                          ? "bg-brand-100 text-brand-600 shadow-sm"
                          : "bg-white text-slate-400 shadow-sm"
                      }`}>
                      <MapPin size={22} />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-black text-slate-900">
                        {formData.lat
                          ? "Store GPS Location Pin"
                          : "Location Not Defined"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed break-words">
                        {formData.address ||
                          "Click change to mark your shop location on the map for delivery accuracy."}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="w-full sm:w-auto bg-white text-slate-900 border border-slate-300 hover:border-slate-900 rounded-xl px-4 py-2 text-[11px] font-bold tracking-wider shadow-sm transition-all">
                      CHANGE PIN
                    </Button>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200/70 flex flex-wrap gap-5 sm:gap-8">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
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
                            className="w-16 px-2 py-1 bg-white border-2 border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-brand-500 transition-all text-center"
                          />
                          <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                            KM
                          </span>
                          <button
                            type="button"
                            onClick={handleSaveRadius}
                            disabled={isSavingRadius}
                            title="Save radius"
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-60">
                            <CheckCircle size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingRadius(false);
                              setRadiusDraft(formData.radius);
                            }}
                            disabled={isSavingRadius}
                            title="Cancel"
                            className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all">
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-lg font-black text-slate-900">
                            {formData.radius}
                          </span>
                          <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                            KM
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRadiusDraft(formData.radius);
                              setIsEditingRadius(true);
                            }}
                            title="Edit radius"
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all">
                            <Edit2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {formData.lat && (
                    <>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Latitude
                        </span>
                        <span className="text-xs font-bold text-slate-700 font-mono">
                          {formData.lat.toFixed(6)}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Longitude
                        </span>
                        <span className="text-xs font-bold text-slate-700 font-mono">
                          {formData.lng.toFixed(6)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200/60">
                <Shield size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Your store location and service radius determine customer visibility and fast 15-minute rider dispatch algorithms.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Column (1 Col) */}
        <div className="space-y-6">
          {/* Security & Verification Card */}
          <Card className="p-6 border-none shadow-sm rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[3px] text-white/50 mb-5">
              Trust & Security
            </h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
                    Verification
                  </p>
                  <p className="text-xs font-bold text-white">
                    {profile?.isVerified
                      ? "Verified Merchant"
                      : "Verification Pending"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Rocket size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
                    Partner Tier
                  </p>
                  <p className="text-xs font-bold text-white">Standard Growth</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Globe size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
                    Marketplace Reach
                  </p>
                  <p className="text-xs font-bold text-white">Hyperlocal Delivery Network</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Authorised Seller Certificate Card */}
          <Card className="p-5 sm:p-6 border-none shadow-sm rounded-2xl bg-gradient-to-br from-amber-950 via-slate-900 to-orange-950 text-white relative overflow-hidden ring-1 ring-amber-500/20">
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3.5">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <FileText size={18} />
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

            <div className="space-y-3.5">
              {profile?.certificate ? (
                <>
                  <div className="bg-white/5 border border-amber-500/30 p-3 rounded-xl flex items-center gap-3 backdrop-blur-sm">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <CheckCircle size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white leading-snug truncate">
                        {profile.certificate.certificateNo || 'SEVAFAST Certificate'}
                      </p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black tracking-wider uppercase">
                        {profile.certificate.accepted ? 'Accepted & Verified' : 'Pending Acceptance'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCertModalOpen(true)}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] text-slate-950 font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 transition-all cursor-pointer">
                    <ExternalLink size={15} />
                    <span>View / Print Certificate</span>
                  </button>
                </>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-center">
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">
                    Authorised Seller Certificate will be issued upon admin approval.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Official KYC Document Card */}
          <Card className="p-5 sm:p-6 border-none shadow-sm rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white relative overflow-hidden ring-1 ring-emerald-500/20">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <FileText size={18} />
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

            <div className="space-y-3.5">
              {profile?.officialKycDocumentUrl ? (
                <>
                  <div className="bg-white/5 border border-emerald-500/30 p-3 rounded-xl flex items-center gap-3 backdrop-blur-sm">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white leading-snug">Verified KYC Form</p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black tracking-wider uppercase">
                        {profile?.kycUploadedAt 
                          ? `Verified on ${new Date(profile.kycUploadedAt).toLocaleDateString()}` 
                          : 'Official Admin PDF'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.open(profile.officialKycDocumentUrl, '_blank', 'noopener,noreferrer')}
                    className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer">
                    <ExternalLink size={15} />
                    <span>View / Download KYC PDF</span>
                  </button>
                </>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-center">
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">
                    Official KYC document will be uploaded by SEVAFAST Admin upon account verification.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Footer Legal Links */}
      <div className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-400 border-t border-slate-200/60">
        <button
          type="button"
          onClick={() => navigate("/terms?for=seller")}
          className="hover:text-slate-900 transition-colors"
        >
          Terms &amp; Conditions
        </button>
        <span className="text-slate-300">•</span>
        <button
          type="button"
          onClick={() => navigate("/privacy?for=seller")}
          className="hover:text-slate-900 transition-colors"
        >
          Privacy Policy
        </button>
      </div>

      {/* Map Picker Modal */}
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

      {/* Certificate Modal */}
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
