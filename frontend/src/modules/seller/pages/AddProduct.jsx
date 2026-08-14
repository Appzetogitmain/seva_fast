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
    weight: "",
    weightVal: "",
    weightUnit: "kg",
    packageLength: "",
    packageBreadth: "",
    packageHeight: "",
    deliveryType: "instant",
    brand: "",
    mainImage: null,
    galleryImages: [],
    variants: [
      {
        id: crypto.randomUUID(),
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
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 md:flex-none" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
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
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  About this item
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[140px] max-h-[260px] outline-none transition-all focus:ring-2 focus:ring-primary/5 resize-none overflow-y-auto custom-scrollbar"
                  placeholder="Describe the item here..."
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
                    <input
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleImageUpload(e, "main")}
                    />
                    {formData.mainImage ? (
                      <img
                        src={formData.mainImage}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
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
                        <img
                          src={formData.galleryImages[i - 1]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            capture="environment"
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
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full">
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
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(-1)}>
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
