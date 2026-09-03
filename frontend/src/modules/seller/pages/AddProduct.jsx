import React, { useState, useMemo, useEffect } from "react";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import Card from "@shared/components/ui/Card";
import {
  HiOutlineArrowLeft,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineCurrencyDollar,
  HiOutlineSwatch,
  HiOutlineFolderOpen,
  HiOutlinePhoto,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
  HiOutlineRocketLaunch,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import { Sparkles, Camera, UploadCloud, Check, Loader2 } from "lucide-react";

// Camera photos routinely come in at 3-10MB; the AI endpoint sends this as a
// base64 JSON body capped at 1MB server-side, and large images also make the
// Gemini vision call much slower/likelier to time out. Downscale + re-encode
// as JPEG before sending so the request stays small and fast.
const AI_IMAGE_MAX_DIMENSION = 1280;
const AI_IMAGE_JPEG_QUALITY = 0.82;

// Product photo/gallery uploads: reject oversized files up front with a
// friendly message instead of letting a raw upload/server error surface.
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const compressImageForAi = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, AI_IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is not supported on this device"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", AI_IMAGE_JPEG_QUALITY);
      resolve({
        base64Data: dataUrl.replace(/^data:(.*,)?/, ""),
        mimeType: "image/jpeg",
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this image (unsupported format like HEIC?). Please try a JPEG/PNG photo or fill details manually."));
    };
    img.src = objectUrl;
  });

const CardTitle = (Icon, text) => (
  <span className="inline-flex items-center">
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 mr-2.5 shrink-0">
      <Icon className="h-4 w-4" />
    </span>
    {text}
  </span>
);

const AddProduct = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  const uniqueSuffix = useMemo(() => Math.random().toString(36).substring(2, 6).toUpperCase(), []);

  const makeSku = React.useCallback((name, index = 1) => {
    const prefix =
      String(name || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5) || "ITEM";
    return `${prefix}-${uniqueSuffix}-${String(index).padStart(3, "0")}`;
  }, [uniqueSuffix]);

  const isAutoSku = React.useCallback((sku, name, index = 1) => {
    return String(sku || "").toUpperCase() === makeSku(name, index);
  }, [makeSku]);

  const getBlankFormData = React.useCallback(() => ({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    costPrice: "",
    stock: "",
    lowStockAlert: 5,
    category: "",
    subcategory: "",
    header: "",
    status: "active",
    tags: "",
    aiGenerated: false,
    weight: "",
    weightVal: "",
    weightUnit: "kg",
    packageLength: "",
    packageBreadth: "",
    packageHeight: "",
    deliveryType: "instant",
    brand: "",
    isReturnable: true,
    returnWindowDays: 1,
    mainImage: null,
    mainImageFile: null,
    galleryImages: [],
    galleryFiles: [],
    variants: [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name: "",
        price: "",
        salePrice: "",
        costPrice: "",
        stock: "",
        sku: "",
      },
    ],
  }), []);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("seller_add_product_draft");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      name: "",
      slug: "",
      sku: "",
      description: "",
      price: "",
      salePrice: "",
      costPrice: "",
      stock: "",
      lowStockAlert: 5,
      category: "",
      subcategory: "",
      header: "",
      status: "active",
      tags: "",
      aiGenerated: false,
      weight: "",
      weightVal: "",
      weightUnit: "kg",
      packageLength: "",
      packageBreadth: "",
      packageHeight: "",
      deliveryType: "instant",
      brand: "",
      isReturnable: true,
      returnWindowDays: 1,
      mainImage: null,
      galleryImages: [],
      variants: [
        {
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          name: "",
          price: "",
          salePrice: "",
          costPrice: "",
          stock: "",
          sku: "",
        },
      ],
    };
  });

  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSuggestedTitle, setAiSuggestedTitle] = useState(null);

  const handleDiscard = (shouldNavigate = false) => {
    localStorage.removeItem("seller_add_product_draft");
    setFormData(getBlankFormData());
    setAiSuggestedTitle(null);
    toast.success("Draft discarded. Form cleared for new product.");
    if (shouldNavigate) {
      navigate("/seller/products");
    }
  };

  const handleAutoFillFromPhoto = async (file) => {
    if (!file) return;

    // Keep the original full-quality file for preview + the real product upload.
    const preview = new FileReader();
    preview.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        mainImage: preview.result,
        mainImageFile: file,
      }));
    };
    preview.readAsDataURL(file);

    setIsAnalyzingImage(true);
    try {
      // Downscaled/compressed copy for the AI request only — keeps it under
      // the server's payload limit and makes the Gemini call much faster.
      const { base64Data, mimeType } = await compressImageForAi(file);

      const res = await sellerApi.generateListingFromImage({
        imageBase64: base64Data,
        mimeType,
      });

      const data = res.data.result || res.data.data || {};

      setFormData((prev) => ({
        ...prev,
        name: data.title || prev.name,
        description: data.description || prev.description,
        tags: data.tags || prev.tags,
        brand: data.brand || prev.brand,
        weightVal: data.weightVal || prev.weightVal,
        weightUnit: data.weightUnit || prev.weightUnit || "kg",
        deliveryType: data.deliveryType || prev.deliveryType || "instant",
        header: data.header || prev.header,
        category: data.category || prev.category,
        subcategory: data.subcategory || prev.subcategory,
        aiGenerated: true,
      }));

      if (data.title) {
        setAiSuggestedTitle(data.title);
      }

      toast.success(`AI identified "${data.title || "product"}" and auto-filled details!`);
    } catch (err) {
      console.error("AI image analysis failed:", err);
      toast.error(err.response?.data?.message || err.message || "Could not auto-fill from photo. Please fill manually.");
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("seller_add_product_draft", JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    setFormData((prev) => {
      if (!prev.name) return prev;

      const nextSku =
        !prev.sku || isAutoSku(prev.sku, prev.name, 1)
          ? makeSku(prev.name, 1)
          : prev.sku;

      const nextVariants = prev.variants.map((variant, idx) => {
        const variantIndex = idx + 1;
        const shouldAuto =
          !variant.sku || isAutoSku(variant.sku, prev.name, variantIndex);
        return shouldAuto
          ? { ...variant, sku: makeSku(prev.name, variantIndex) }
          : variant;
      });

      const changed =
        nextSku !== prev.sku ||
        nextVariants.some((variant, idx) => variant !== prev.variants[idx]);

      return changed ? { ...prev, sku: nextSku, variants: nextVariants } : prev;
    });
  }, [formData.name]);

  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await sellerApi.getCategoryTree();
        if (res.data.success) {
          setDbCategories(res.data.results || res.data.result || []);
        }
      } catch (error) {
        toast.error("Failed to load categories");
      } finally {
        setIsLoadingCats(false);
      }
    };
    fetchCats();
  }, []);

  const categories = dbCategories;

  const selectedCategoryName = categories
    .find((h) => (h._id || h.id) === formData.header)
    ?.children?.find((c) => (c._id || c.id) === formData.category)?.name;

  const handleGenerateWithAi = async () => {
    if (!formData.name.trim()) {
      toast.error("Enter a product name first");
      return;
    }
    setIsGeneratingAi(true);
    try {
      const res = await sellerApi.generateAiListing({
        name: formData.name,
        categoryName: selectedCategoryName,
        notes: formData.description,
        existingTags: formData.tags
          ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
      });
      const result = res.data?.result || {};
      setFormData((prev) => ({
        ...prev,
        description: result.description || prev.description,
        tags: Array.isArray(result.tags) ? result.tags.join(", ") : prev.tags,
        aiGenerated: true,
      }));
      setAiSuggestedTitle(result.title || null);
      toast.success("Generated with AI — review before saving");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to generate listing");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name) {
      toast.error("Please fill in the Product Title");
      return;
    }

    // Validate required category levels are selected
    if (!formData.header || !formData.category) {
      toast.error("Please select Main Group and Specific Category");
      return;
    }

    if (formData.deliveryType === "scheduled") {
      const parsedWeight = parseFloat(formData.weightVal);
      if (!formData.weightVal || Number.isNaN(parsedWeight) || parsedWeight <= 0) {
        toast.error("Please provide a valid product weight for scheduled nationwide delivery.");
        return;
      }
      const length = parseFloat(formData.packageLength);
      const breadth = parseFloat(formData.packageBreadth);
      const height = parseFloat(formData.packageHeight);
      if (
        !formData.packageLength || !formData.packageBreadth || !formData.packageHeight ||
        Number.isNaN(length) || Number.isNaN(breadth) || Number.isNaN(height) ||
        length <= 0 || breadth <= 0 || height <= 0
      ) {
        toast.error("Please provide package length, breadth and height (cm) for Shiprocket shipping.");
        return;
      }
    }

    const firstVariant = formData.variants[0] || {};
    if (!firstVariant.price || firstVariant.stock === "" || firstVariant.stock == null) {
      toast.error("Main variant must have price and stock");
      return;
    }
    const hasNegativeStock = (formData.variants || []).some((v) => {
      const s = Number(v.stock);
      return v.stock !== "" && v.stock != null && (!Number.isFinite(s) || s < 0);
    });
    if (hasNegativeStock) {
      toast.error("Stock cannot be negative");
      return;
    }

    for (const variant of formData.variants) {
      if (variant.salePrice && Number(variant.salePrice) >= Number(variant.price)) {
        toast.error(`Sale price must be less than regular price for variant "${variant.name || 'main'}".`);
        return;
      }
      if (variant.costPrice) {
        const effectiveSellingPrice = Number(variant.salePrice) || Number(variant.price) || 0;
        if (Number(variant.costPrice) > effectiveSellingPrice) {
          toast.error(`Cost price cannot be higher than the selling price for variant "${variant.name || 'main'}".`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const data = new FormData();

      // Basic fields
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("deliveryType", formData.deliveryType || "instant");
      if (formData.deliveryType === "scheduled") {
        data.append("packageLength", formData.packageLength);
        data.append("packageBreadth", formData.packageBreadth);
        data.append("packageHeight", formData.packageHeight);
      }
      data.append("status", formData.status);
      data.append("isReturnable", formData.isReturnable);
      if (formData.isReturnable) {
        data.append("returnWindowDays", formData.returnWindowDays);
      }

      // Map top-level price/stock from first variant for indexing/listing
      data.append("price", firstVariant.price);
      data.append("salePrice", firstVariant.salePrice || 0);
      data.append("costPrice", firstVariant.costPrice || 0);
      data.append("stock", firstVariant.stock);

      // Category IDs
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);

      // Tags
      data.append("tags", formData.tags);
      data.append("aiGenerated", formData.aiGenerated);

      // Images
      if (formData.mainImageFile) {
        data.append("mainImage", formData.mainImageFile);
      }

      if (formData.galleryFiles && formData.galleryFiles.length > 0) {
        formData.galleryFiles.forEach(file => {
          data.append("galleryImages", file);
        });
      }

      // Variants
      data.append("variants", JSON.stringify(formData.variants));

      const response = await sellerApi.createProduct(data);

      // Always clear draft on success
      localStorage.removeItem("seller_add_product_draft");

      const approvalStatus = response?.data?.result?.approvalStatus;
      if (approvalStatus === "pending") {
        toast.success("Product published successfully! Pending admin approval.");
      } else {
        toast.success(response?.data?.message || "Product saved successfully!");
      }

      navigate("/seller/products");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
        toast.error("Image is too large — please choose a photo under 5MB.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "main") {
          setFormData({
            ...formData,
            mainImage: reader.result,
            mainImageFile: file
          });
        } else {
          setFormData({
            ...formData,
            galleryImages: [...formData.galleryImages, reader.result],
            galleryFiles: [...(formData.galleryFiles || []), file]
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const firstVariant = formData.variants?.[0] || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="pl-0 -ml-1 mb-1 hover:bg-transparent hover:text-primary-600"
            onClick={() => navigate(-1)}>
            <HiOutlineArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Products
          </Button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Add New Product
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Fill in the details below to list a new item in your store.
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap items-center">
          <Button
            type="button"
            variant="outline"
            className="flex-1 md:flex-none text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            onClick={() => handleDiscard(false)}
            title="Clear all fields and discard draft"
          >
            <HiOutlineTrash className="mr-1.5 h-4 w-4" />
            Discard / Clear
          </Button>
          <Button 
            type="button"
            variant="outline" 
            className="flex-1 md:flex-none text-slate-600" 
            onClick={() => handleDiscard(true)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 md:flex-none md:min-w-[140px]">
            {isSaving ? (
              <>
                <HiOutlineArrowPath className="mr-2 h-5 w-5 animate-spin" />
                Publishing...
              </>
            ) : (
              "Save & Publish"
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Image-to-Listing Auto-Fill Card */}
          <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-orange-500/10 to-amber-400/10 border-2 border-dashed border-primary/40 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-primary">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-primary to-orange-500 text-white flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      Image-to-Listing Auto-Fill
                    </h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary text-white uppercase tracking-wider">
                      AI Magic
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Product photo upload karein — Gemini AI automatically <strong>Title, Description, Tags, Category & Weight</strong> fill kar dega!
                  </p>
                </div>
              </div>

              <label className="cursor-pointer shrink-0 w-full sm:w-auto">
                <div className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all ${
                  isAnalyzingImage 
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed" 
                    : "bg-primary text-white hover:bg-primary/90 hover:scale-102 cursor-pointer"
                }`}>
                  {isAnalyzingImage ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-primary" />
                      <span>Scanning Photo...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={16} />
                      <span>Upload Photo & Auto-Fill</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isAnalyzingImage}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleAutoFillFromPhoto(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {isAnalyzingImage && (
              <div className="mt-3 pt-3 border-t border-primary/20 flex items-center gap-2 text-xs font-semibold text-primary animate-pulse">
                <Sparkles size={14} className="animate-spin" />
                <span>Gemini AI is analyzing product packaging, brand, description, and matching catalog categories...</span>
              </div>
            )}
          </div>

          {/* General Information */}
          <Card
            title={CardTitle(HiOutlineTag, "General Information")}
            subtitle="The essentials shoppers see first">
            <div className="space-y-6">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Product Title
                </label>
                <input
                  value={formData.name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name: nextName,
                      sku:
                        !prev.sku || isAutoSku(prev.sku, prev.name, 1)
                          ? makeSku(nextName, 1)
                          : prev.sku,
                      variants: prev.variants.map((variant, idx) => {
                        const variantIndex = idx + 1;
                        const shouldAuto =
                          !variant.sku ||
                          isAutoSku(variant.sku, prev.name, variantIndex);
                        return shouldAuto
                          ? { ...variant, sku: makeSku(nextName, variantIndex) }
                          : variant;
                      }),
                    }));
                  }}
                  className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                  placeholder="e.g. Premium Basmati Rice"
                />
                {aiSuggestedTitle && aiSuggestedTitle !== formData.name && (
                  <div className="flex items-center gap-2 text-xs bg-brand-50 text-brand-700 rounded-lg px-3 py-2 mt-1">
                    <HiOutlineSparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 font-medium">AI suggestion: "{aiSuggestedTitle}"</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, name: aiSuggestedTitle }))
                      }
                      className="font-bold underline shrink-0 hover:text-brand-900"
                    >
                      Use this title
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 flex flex-col">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">
                    About this item
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateWithAi}
                    disabled={isGeneratingAi || !formData.name.trim()}
                    className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-brand-600 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingAi ? (
                      <HiOutlineArrowPath className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <HiOutlineSparkles className="h-3.5 w-3.5" />
                    )}
                    {isGeneratingAi ? "Generating..." : "Generate with AI"}
                  </button>
                </div>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                      aiGenerated: false,
                    }))
                  }
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[140px] max-h-[260px] outline-none transition-all focus:ring-2 focus:ring-primary/5 resize-none overflow-y-auto custom-scrollbar"
                  placeholder="Describe the item here, or click Generate with AI"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Search Tags <span className="text-slate-400 font-normal normal-case">(comma-separated)</span>
                </label>
                <input
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      tags: e.target.value,
                      aiGenerated: false,
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                  placeholder="e.g. basmati rice, premium, 5kg"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Brand Name
                  </label>
                  <input
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. Amul"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Product Code
                  </label>
                  <input
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="AUTO-GENERATED"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Delivery & Shipping */}
          <Card
            title={CardTitle(HiOutlineCube, "Delivery & Shipping")}
            subtitle="How this item gets to the customer">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Delivery Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.deliveryType || "instant"}
                    onChange={(e) =>
                      setFormData({ ...formData, deliveryType: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all"
                  >
                    <option value="instant">Instant (Local Rider)</option>
                    <option value="scheduled">Scheduled (Nationwide Shipping)</option>
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Weight {formData.deliveryType === "scheduled" && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={formData.weightVal || ""}
                      type="number"
                      step="any"
                      min="0"
                      onChange={(e) => {
                        const val = e.target.value;
                        const unit = formData.weightUnit || "kg";
                        setFormData({
                          ...formData,
                          weightVal: val,
                          weight: val ? `${val} ${unit}` : "",
                        });
                      }}
                      className="flex-1 px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                      placeholder="e.g. 0.5 or 500"
                    />
                    <select
                      value={formData.weightUnit || "kg"}
                      onChange={(e) => {
                        const unit = e.target.value;
                        const val = formData.weightVal || "";
                        setFormData({
                          ...formData,
                          weightUnit: unit,
                          weight: val ? `${val} ${unit}` : "",
                        });
                      }}
                      className="w-24 px-2 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all"
                    >
                      <option value="kg">kg</option>
                      <option value="gm">gm</option>
                    </select>
                  </div>
                </div>
              </div>

              {formData.deliveryType === "scheduled" && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Package Size (cm) <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500 font-medium ml-1">
                    Required for Shiprocket delivery rate &amp; AWB calculation.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Length</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={formData.packageLength || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, packageLength: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/5"
                        placeholder="cm"
                      />
                    </div>
                    <div className="space-y-1 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Breadth</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={formData.packageBreadth || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, packageBreadth: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/5"
                        placeholder="cm"
                      />
                    </div>
                    <div className="space-y-1 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Height</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={formData.packageHeight || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, packageHeight: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/5"
                        placeholder="cm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Returns & Warranties */}
          <Card
            title={CardTitle(HiOutlineScale, "Returns & Warranties")}
            subtitle="Configure return policy for this product">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Returnable Product</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Allow customers to return this product</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.isReturnable}
                    onChange={(e) => setFormData({ ...formData, isReturnable: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {formData.isReturnable && (
                <div className="space-y-1.5 flex flex-col pt-4 border-t border-slate-100">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Return Window (Days) <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500 font-medium ml-1 mb-2">
                    Number of days from delivery the customer has to request a return.
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.returnWindowDays}
                    onChange={(e) => setFormData({ ...formData, returnWindowDays: parseInt(e.target.value) || 0 })}
                    className="w-full md:w-1/2 px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. 7"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Pricing & Variants */}
          <Card
            title={CardTitle(HiOutlineCurrencyDollar, "Pricing & Variants")}
            subtitle="Add different sizes, colors or weights"
            headerAction={
              <button
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    variants: [
                      ...prev.variants,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        price: "",
                        salePrice: "",
                        costPrice: "",
                        stock: "",
                        sku: makeSku(prev.name, prev.variants.length + 1),
                      },
                    ],
                  }))
                }
                className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all shrink-0">
                <HiOutlineSquaresPlus className="h-4 w-4" />
                <span>ADD VARIANT</span>
              </button>
            }>
            <div className="space-y-3">
              {(formData.variants || []).map((variant, index) => (
                <div
                  key={variant.id}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end group relative">
                  <div className="col-span-12 md:col-span-3 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Variant Name
                    </label>
                    <input
                      value={variant.name}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setFormData((prev) => {
                          const newVariants = prev.variants.map((item, idx) => {
                            if (idx !== index) return item;
                            return { ...item, name: nextValue };
                          });
                          return {
                            ...prev,
                            variants: newVariants,
                          };
                        });
                      }}
                      placeholder="e.g. 1kg, 1 pack, 1 liter..."
                      className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={variant.price}
                      onChange={(e) => {
                        const newVariants = [...formData.variants];
                        newVariants[index].price = e.target.value;
                        setFormData({ ...formData, variants: newVariants });
                      }}
                      placeholder="500"
                      className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <label className="text-[8px] font-bold text-brand-500 uppercase tracking-widest ml-1">
                      Sale
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={variant.salePrice}
                      onChange={(e) => {
                        const newVariants = [...formData.variants];
                        newVariants[index].salePrice = e.target.value;
                        setFormData({ ...formData, variants: newVariants });
                      }}
                      placeholder="450"
                      className="w-full px-3 py-2 bg-brand-50 ring-1 ring-brand-100 border-none rounded-xl text-xs font-bold text-brand-700 outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Cost Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={variant.costPrice || ""}
                      onChange={(e) => {
                        const newVariants = [...formData.variants];
                        newVariants[index].costPrice = e.target.value;
                        setFormData({ ...formData, variants: newVariants });
                      }}
                      placeholder="300"
                      className="w-full px-3 py-2 bg-emerald-50/50 ring-1 ring-emerald-100 border-none rounded-xl text-xs font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Stock
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={variant.stock}
                      onKeyDown={(e) => {
                        if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
                      }}
                      onChange={(e) => {
                        const newVariants = [...formData.variants];
                        const raw = e.target.value;
                        if (raw === "") {
                          newVariants[index].stock = "";
                        } else {
                          const n = Number(raw);
                          newVariants[index].stock = Number.isFinite(n)
                            ? Math.max(0, Math.floor(n))
                            : 0;
                        }
                        setFormData({ ...formData, variants: newVariants });
                      }}
                      placeholder="10"
                      className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <div className="col-span-5 md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                      Product Code
                    </label>
                    <input
                      value={variant.sku}
                      onChange={(e) => {
                        const newVariants = [...formData.variants];
                        newVariants[index].sku = e.target.value;
                        setFormData({ ...formData, variants: newVariants });
                      }}
                      placeholder={makeSku(formData.name, index + 1)}
                      className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  {/* Live Estimated Profit Calculator per variant */}
                  {(() => {
                    const selling = Number(variant.salePrice || variant.price || 0);
                    const cost = Number(variant.costPrice || 0);
                    if (selling > 0 && cost > 0) {
                      const estProfit = selling - cost;
                      const margin = Math.round((estProfit / selling) * 100);
                      return (
                        <div className="col-span-12 mt-1 p-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800">
                          <span>Estimated Gross Profit: <strong className="text-emerald-900">₹{estProfit.toFixed(2)}</strong></span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider">Margin: {margin}%</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="col-span-1 flex justify-end pb-1">
                    <button
                      onClick={() => {
                        if (formData.variants.length > 1) {
                          setFormData((prev) => {
                            const remaining = prev.variants
                              .map((variant, idx) => ({ variant, oldIndex: idx + 1 }))
                              .filter((item) => item.oldIndex !== index + 1)
                              .map((item, newIdx) => {
                                const shouldAuto =
                                  !item.variant.sku ||
                                  isAutoSku(item.variant.sku, prev.name, item.oldIndex);
                                return shouldAuto
                                  ? { ...item.variant, sku: makeSku(prev.name, newIdx + 1) }
                                  : item.variant;
                              });
                            return { ...prev, variants: remaining };
                          });
                        }
                      }}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                      <HiOutlineTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Category & Organization */}
          <Card
            title={CardTitle(HiOutlineFolderOpen, "Category & Organization")}
            subtitle="Helps shoppers find this item while browsing">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Main Group <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.header}
                    onChange={(e) =>
                      setFormData({ ...formData, header: e.target.value, category: "", subcategory: "" })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all">
                    <option value="">Select Main Group</option>
                    {categories.map((h) => (
                      <option key={h._id || h.id} value={h._id || h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Specific Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value, subcategory: "" })
                    }
                    disabled={!formData.header}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="">Select Category</option>
                    {categories
                      .find((h) => (h._id || h.id) === formData.header)
                      ?.children?.map((c) => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Sub-Category <span className="text-slate-400 font-medium lowercase italic">(Optional)</span>
                  </label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) =>
                      setFormData({ ...formData, subcategory: e.target.value })
                    }
                    disabled={!formData.category}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="">Select Sub-Category</option>
                    {categories
                      .find((h) => (h._id || h.id) === formData.header)
                      ?.children?.find((c) => (c._id || c.id) === formData.category)
                      ?.children?.map((sc) => (
                        <option key={sc._id || sc.id} value={sc._id || sc.id}>
                          {sc.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Media */}
          <Card
            title={CardTitle(HiOutlinePhoto, "Media")}
            subtitle="Photos that will appear on the store listing">
            <div className="space-y-8">
              {/* Main Image Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Main Cover Photo
                </label>
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-48 aspect-square rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer overflow-hidden relative">
                    {formData.mainImage ? (
                      <>
                        <img
                          src={formData.mainImage}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setFormData({ ...formData, mainImage: null, mainImageFile: null });
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white text-rose-500 rounded-full shadow-md hover:bg-rose-50 transition-colors z-20"
                          title="Remove cover photo"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          onChange={(e) => handleImageUpload(e, "main")}
                        />
                        <HiOutlinePhoto className="h-10 w-10 text-slate-200 group-hover:text-primary transition-colors" />
                        <p className="text-[9px] font-bold text-slate-600 mt-2 uppercase tracking-widest group-hover:text-primary">
                          Upload Cover
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 pt-2">
                    <p className="text-xs font-bold text-slate-900">
                      Choose a primary image
                    </p>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      We show this image on the search page and the main
                      store listing. Make sure it is clear and bright.
                    </p>
                    {formData.mainImage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAutoFillFromPhoto(formData.mainImageFile)}
                        disabled={isAnalyzingImage}
                        className="mt-2 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 text-xs font-bold"
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                        Auto-Fill Details from this Photo
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Gallery Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Gallery Photos (Max 5)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-md border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer relative overflow-hidden">
                      {formData.galleryImages[i - 1] ? (
                        <>
                          <img
                            src={formData.galleryImages[i - 1]}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const newImages = [...formData.galleryImages];
                              newImages.splice(i - 1, 1);
                              const newFiles = [...(formData.galleryFiles || [])];
                              if (newFiles.length > i - 1) {
                                newFiles.splice(i - 1, 1);
                              }
                              setFormData({
                                ...formData,
                                galleryImages: newImages,
                                galleryFiles: newFiles
                              });
                            }}
                            className="absolute top-1 right-1 p-1 bg-white text-rose-500 rounded-full shadow-sm hover:bg-rose-50 transition-colors z-20"
                            title="Remove photo"
                          >
                            <HiOutlineTrash className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={(e) => handleImageUpload(e, "gallery")}
                          />
                          <HiOutlinePlus className="h-5 w-5 text-slate-200 group-hover:text-primary transition-colors" />
                          <p className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-widest group-hover:text-primary">
                            Add
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-600 font-medium italic text-center pt-4 border-t border-slate-100">
                Quick Tip: Using WebP format at 800x800px makes your store load
                3x faster.
              </p>
            </div>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 space-y-6">
            {/* Publish Card */}
            <Card
              title={CardTitle(HiOutlineRocketLaunch, "Publish")}
              subtitle="Control the visibility of this listing">
              <div className="space-y-4">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all">
                    <option value="active">Published</option>
                    <option value="inactive">Draft</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Published items are submitted for admin approval before they
                  go live in your store.
                </p>
                <div className="pt-2 space-y-2">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full font-bold">
                    {isSaving ? (
                      <>
                        <HiOutlineArrowPath className="mr-2 h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      "Save & Publish"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                    onClick={() => handleDiscard(false)}>
                    <HiOutlineTrash className="mr-1.5 h-4 w-4" />
                    Discard & Clear Form
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-slate-600"
                    onClick={() => handleDiscard(true)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>

            {/* Live Preview Card */}
            <Card
              title={CardTitle(HiOutlineSwatch, "Preview")}
              subtitle="How it will look in your store">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {formData.mainImage ? (
                    <img src={formData.mainImage} className="w-full h-full object-cover" />
                  ) : (
                    <HiOutlinePhoto className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {formData.name || "Untitled product"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {firstVariant.salePrice ? (
                      <>
                        <span className="text-sm font-black text-brand-600">₹{firstVariant.salePrice}</span>
                        <span className="text-xs text-slate-400 line-through">₹{firstVariant.price || 0}</span>
                      </>
                    ) : (
                      <span className="text-sm font-black text-slate-900">
                        {firstVariant.price ? `₹${firstVariant.price}` : "₹--"}
                      </span>
                    )}
                  </div>
                  <Badge variant={firstVariant.stock > 0 ? "success" : "gray"} className="mt-1.5">
                    {firstVariant.stock || firstVariant.stock === 0 ? `${firstVariant.stock} in stock` : "Stock not set"}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Tips Card */}
            <Card
              title={CardTitle(HiOutlineSparkles, "Tips for a great listing")}>
              <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
                <li className="flex gap-2">
                  <span className="text-brand-500 font-black">•</span>
                  Use a clear, bright cover photo shot on a plain background.
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-500 font-black">•</span>
                  Keep titles short and specific, e.g. "Premium Basmati Rice 1kg".
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-500 font-black">•</span>
                  Set accurate stock counts to avoid overselling.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
