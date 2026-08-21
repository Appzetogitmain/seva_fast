import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Save,
  Loader2,
  CheckCircle2,
  Eye,
  Settings2,
  Image as ImageIcon,
  ArrowRight,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../services/adminApi";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import MlmPromotionalBanner from "@/modules/customer/components/home/MlmPromotionalBanner";

const DEFAULT_MLM_CONFIG = {
  enabled: true,
  badgeText: "SEVAFAST MLM",
  title: "JOIN SEVAFAST MULTI LEVEL MARKETING",
  subtitle: "Earn More, Refer More, Grow Your Network!",
  ctaText: "JOIN NOW",
  ctaLink: "/plans",
  bannerBgColor: "#FFF6F0",
  customImageUrl: "",
  steps: [
    { stepNumber: 1, title: "Register Free", subtitle: "Instant Activation", iconType: "edit" },
    { stepNumber: 2, title: "Refer Your Friends", subtitle: "Share Referral Code", iconType: "users" },
    { stepNumber: 3, title: "They Shop, You Earn", subtitle: "Direct & Team Commissions", iconType: "bag" },
    { stepNumber: 4, title: "Unlimited Income", subtitle: "Multi-Level Growth", iconType: "income" },
  ],
};

const ICON_OPTIONS = [
  { id: "edit", label: "Register / Edit", example: "FileEdit" },
  { id: "users", label: "Referral / Network", example: "Users" },
  { id: "bag", label: "Shop / Products", example: "ShoppingBag" },
  { id: "income", label: "Income / Coins", example: "Coins" },
  { id: "gift", label: "Gift / Reward", example: "Gift" },
  { id: "trending", label: "Growth / Trending", example: "TrendingUp" },
];

const MlmBannerManagerModal = ({ isOpen, onClose }) => {
  const { settings, refetch } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_MLM_CONFIG);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const current = settings?.mlmPromo || {};
      setFormData({
        enabled: current.enabled !== undefined ? current.enabled : DEFAULT_MLM_CONFIG.enabled,
        badgeText: current.badgeText || DEFAULT_MLM_CONFIG.badgeText,
        title: current.title || DEFAULT_MLM_CONFIG.title,
        subtitle: current.subtitle || DEFAULT_MLM_CONFIG.subtitle,
        ctaText: current.ctaText || DEFAULT_MLM_CONFIG.ctaText,
        ctaLink: current.ctaLink || DEFAULT_MLM_CONFIG.ctaLink,
        bannerBgColor: current.bannerBgColor || DEFAULT_MLM_CONFIG.bannerBgColor,
        customImageUrl: current.customImageUrl || "",
        steps: current.steps?.length ? current.steps : DEFAULT_MLM_CONFIG.steps,
      });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleStepChange = (index, field, value) => {
    const updatedSteps = [...formData.steps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      [field]: value,
    };
    setFormData((prev) => ({ ...prev, steps: updatedSteps }));
    setPreviewKey((k) => k + 1);
  };

  const handleResetToDefault = () => {
    if (window.confirm("Reset MLM banner content back to default values?")) {
      setFormData(DEFAULT_MLM_CONFIG);
      setPreviewKey((k) => k + 1);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await adminApi.updateSettings({
        mlmPromo: formData,
      });

      if (res.data?.success) {
        toast.success("MLM Promotional Banner updated successfully!");
        if (refetch) await refetch({ forceRefresh: true });
        onClose();
      } else {
        toast.error(res.data?.message || "Failed to update settings");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.response?.data?.message || "Error saving MLM banner settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-50 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                MLM Promotional Banner Manager
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Customize the high-converting MLM section displayed on the customer dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset to default text & design"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Live Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-orange-500" />
                Live Preview (Customer Dashboard)
              </span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                formData.enabled ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-rose-100 text-rose-700 border border-rose-200"
              )}>
                {formData.enabled ? "Enabled (Visible)" : "Disabled (Hidden)"}
              </span>
            </div>

            <div className="p-3 bg-slate-200/60 rounded-2xl border border-slate-300/60 overflow-hidden">
              {/* Force mock settings context for preview */}
              <div key={previewKey} className="pointer-events-none">
                <div
                  className="group relative w-full rounded-2xl overflow-hidden border border-orange-200/70 shadow-md"
                  style={{
                    background: "linear-gradient(135deg, #FFF7F2 0%, #FFEEE4 45%, #FFE5D4 100%)",
                  }}
                >
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex-1 text-left space-y-1.5">
                      {formData.badgeText && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-700 text-[10px] font-black tracking-wider uppercase">
                          <Sparkles className="w-3 h-3 text-orange-500 fill-orange-500" />
                          {formData.badgeText}
                        </div>
                      )}
                      <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight uppercase">
                        {formData.title || "JOIN SEVAFAST MULTI LEVEL MARKETING"}
                      </h4>
                      <p className="text-xs font-semibold text-slate-600">
                        {formData.subtitle || "Earn More, Refer More, Grow Your Network!"}
                      </p>
                      <button className="mt-1 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs uppercase rounded-lg shadow-sm flex items-center gap-1.5">
                        <span>{formData.ctaText || "JOIN NOW"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      {(formData.steps || []).map((st, i) => (
                        <div key={i} className="flex flex-col items-center">
                          <div className="w-9 h-9 rounded-full bg-white border border-orange-300 shadow-sm flex items-center justify-center text-[10px] font-black text-orange-600">
                            {st.stepNumber || i + 1}
                          </div>
                          <span className="text-[10px] font-bold text-slate-800 mt-1 line-clamp-1">
                            {st.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Banner Visibility & Core Settings */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Banner Visibility</h4>
                  <p className="text-xs text-slate-500">Show or hide the MLM promo section on home</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData((p) => ({ ...p, enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Badge Tag Text
                </label>
                <input
                  type="text"
                  value={formData.badgeText}
                  onChange={(e) => setFormData((p) => ({ ...p, badgeText: e.target.value }))}
                  placeholder="e.g. SEVAFAST MLM"
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Main Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. JOIN SEVAFAST MULTI LEVEL MARKETING"
                  className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Subtitle / Pitch Line
                </label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData((p) => ({ ...p, subtitle: e.target.value }))}
                  placeholder="e.g. Earn More, Refer More, Grow Your Network!"
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={formData.ctaText}
                    onChange={(e) => setFormData((p) => ({ ...p, ctaText: e.target.value }))}
                    placeholder="e.g. JOIN NOW"
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Target Route / URL
                  </label>
                  <input
                    type="text"
                    value={formData.ctaLink}
                    onChange={(e) => setFormData((p) => ({ ...p, ctaLink: e.target.value }))}
                    placeholder="e.g. /plans"
                    className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Optional Custom Banner Image URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.customImageUrl}
                    onChange={(e) => setFormData((p) => ({ ...p, customImageUrl: e.target.value }))}
                    placeholder="https://... (leave empty for dynamic vector layout)"
                    className="w-full text-xs font-normal px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Steps Configuration */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-orange-500" />
                Customize 4 Benefit Steps
              </h4>

              <div className="space-y-3">
                {formData.steps.map((st, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-orange-600">
                        Step {st.stepNumber || idx + 1}
                      </span>
                      
                      {/* Icon Selector */}
                      <select
                        value={st.iconType || "edit"}
                        onChange={(e) => handleStepChange(idx, "iconType", e.target.value)}
                        className="text-[11px] font-bold bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none"
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) => handleStepChange(idx, "title", e.target.value)}
                        placeholder="Step Title (e.g. Register Free)"
                        className="text-xs font-bold px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-orange-500"
                      />
                      <input
                        type="text"
                        value={st.subtitle || ""}
                        onChange={(e) => handleStepChange(idx, "subtitle", e.target.value)}
                        placeholder="Short Note (e.g. Free Sign-up)"
                        className="text-xs font-medium px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md hover:shadow-orange-500/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Banner Settings</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default MlmBannerManagerModal;
