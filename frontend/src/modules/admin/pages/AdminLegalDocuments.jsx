import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import { adminApi } from "../services/adminApi";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import {
  FileText,
  Save,
  Users,
  Store,
  Bike,
  Loader2,
  ScrollText,
  Shield,
  RotateCcw,
} from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const AUDIENCES = [
  {
    id: "customer",
    label: "Customer",
    description: "Shown on customer app signup, profile, and footer.",
    icon: Users,
    termsKey: "termsAndConditions",
    privacyKey: "privacyPolicy",
    returnKey: "returnPolicy",
  },
  {
    id: "seller",
    label: "Seller",
    description: "Shown on seller signup/login and seller profile.",
    icon: Store,
    termsKey: "sellerTermsAndConditions",
    privacyKey: "sellerPrivacyPolicy",
  },
  {
    id: "delivery",
    label: "Delivery Partner",
    description: "Shown on delivery signup/login and delivery profile.",
    icon: Bike,
    termsKey: "deliveryTermsAndConditions",
    privacyKey: "deliveryPrivacyPolicy",
  },
];

const emptyDocs = {
  termsAndConditions: "",
  privacyPolicy: "",
  sellerTermsAndConditions: "",
  sellerPrivacyPolicy: "",
  deliveryTermsAndConditions: "",
  deliveryPrivacyPolicy: "",
  returnPolicy: "",
};

const AdminLegalDocuments = () => {
  const { showToast } = useToast();
  const { refetch } = useSettings();
  const [activeAudience, setActiveAudience] = useState("customer");
  const [docType, setDocType] = useState("terms");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState(emptyDocs);

  const audience = useMemo(
    () => AUDIENCES.find((item) => item.id === activeAudience) || AUDIENCES[0],
    [activeAudience],
  );

  const activeKey =
    docType === "terms" ? audience.termsKey : docType === "privacy" ? audience.privacyKey : audience.returnKey;

  // Reset docType to terms if audience changes and doesn't support the current docType
  useEffect(() => {
    if (docType === "return" && !audience.returnKey) {
      setDocType("terms");
    }
  }, [audience, docType]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await adminApi.getSettings();
        const data = res.data?.result ?? res.data ?? {};
        setDocs({
          termsAndConditions: data.termsAndConditions || "",
          privacyPolicy: data.privacyPolicy || "",
          sellerTermsAndConditions: data.sellerTermsAndConditions || "",
          sellerPrivacyPolicy: data.sellerPrivacyPolicy || "",
          deliveryTermsAndConditions: data.deliveryTermsAndConditions || "",
          deliveryPrivacyPolicy: data.deliveryPrivacyPolicy || "",
          returnPolicy: data.returnPolicy || "",
        });
      } catch (error) {
        console.error(error);
        showToast("Failed to load legal documents", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showToast]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await adminApi.updateSettings(docs);
      await refetch({ forceRefresh: true });
      showToast(`${audience.label} legal documents saved`, "success");
    } catch (error) {
      console.error(error);
      showToast(
        error?.response?.data?.message || "Failed to save legal documents",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </span>
            Legal Documents
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-2 max-w-2xl">
            Manage separate Terms &amp; Conditions and Privacy Policy for customers,
            sellers, and delivery partners.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={loading || saving}
          className="bg-slate-900 text-white rounded-xl px-5 py-2.5 font-bold inline-flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save {audience.label} Docs
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden p-2 h-fit">
          <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Audience
          </p>
          <div className="space-y-1">
            {AUDIENCES.map((item) => {
              const Icon = item.icon;
              const active = activeAudience === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveAudience(item.id)}
                  className={cn(
                    "w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all",
                    active
                      ? "bg-slate-900 text-white shadow-lg"
                      : "hover:bg-slate-50 text-slate-700",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      active ? "bg-white/10" : "bg-slate-100",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-black">{item.label}</span>
                    <span
                      className={cn(
                        "block text-[11px] font-medium leading-snug mt-0.5",
                        active ? "text-white/70" : "text-slate-400",
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                {audience.label} Documents
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {audience.description}
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDocType("terms")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                  docType === "terms"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <ScrollText className="h-3.5 w-3.5" />
                Terms
              </button>
              <button
                type="button"
                onClick={() => setDocType("privacy")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                  docType === "privacy"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                Privacy
              </button>
              {audience.returnKey && (
                <button
                  type="button"
                  onClick={() => setDocType("return")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                    docType === "return"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Return Policy
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="min-h-[320px] flex items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {docType === "terms" ? "Terms & Conditions" : docType === "privacy" ? "Privacy Policy" : "Return Policy"}{" "}
                  — {audience.label}
                </label>
                {docType === "return" ? (
                  <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 quill-container">
                      <ReactQuill
                        theme="snow"
                        value={docs[activeKey] || ""}
                        onChange={(val) =>
                          setDocs((prev) => ({
                            ...prev,
                            [activeKey]: val,
                          }))
                        }
                        placeholder="Write return policy..."
                        className="h-[300px] pb-10"
                      />
                  </div>
                ) : (
                  <textarea
                    rows={18}
                    value={docs[activeKey] || ""}
                    onChange={(e) =>
                      setDocs((prev) => ({
                        ...prev,
                        [activeKey]: e.target.value,
                      }))
                    }
                    placeholder={`Write ${docType === "terms" ? "terms & conditions" : "privacy policy"} for ${audience.label.toLowerCase()}s...`}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-y min-h-[360px] leading-relaxed"
                  />
                )}
                {docType !== "return" && (
                  <p className="text-[11px] text-slate-400 font-medium">
                    Plain text is fine. Line breaks are preserved on the public pages.
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminLegalDocuments;
