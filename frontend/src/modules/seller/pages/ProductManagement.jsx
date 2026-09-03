import React, { useState, useMemo, useRef, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlinePlus,
  HiOutlineCube,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineEye,
  HiOutlinePhoto,
  HiOutlineArchiveBox,
  HiOutlineTag,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineXMark,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineFolderOpen,
  HiOutlineSwatch,
  HiOutlineSquaresPlus,
  HiOutlineCloudArrowUp,
} from "react-icons/hi2";
import Modal from "@shared/components/ui/Modal";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import Pagination from "@shared/components/ui/Pagination";
import { Sparkles } from "lucide-react";
import SentimentIntelligenceModal from "../components/SentimentIntelligenceModal";

const ProductManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") || "";

  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAiProduct, setSelectedAiProduct] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [summaryStats, setSummaryStats] = useState(null);

  const fetchProducts = async (requestedPage = 1) => {
    setIsLoading(true);
    
    let apiStockStatus = undefined;
    let apiStatus = undefined;
    if (filterStatus === "Active") apiStatus = "active";
    if (filterStatus === "Low Stock") apiStockStatus = "low";
    if (filterStatus === "Out of Stock") apiStockStatus = "out";

    try {
      const res = await sellerApi.getProducts({
        page: requestedPage,
        limit: pageSize,
        sort: sortBy,
        ...(apiStockStatus ? { stockStatus: apiStockStatus } : {}),
        ...(apiStatus ? { status: apiStatus } : {}),
      });
      if (res.data.success) {
        // Backend returns handleResponse(..., { items, page, limit, total, totalPages })
        const payload = res.data.result || {};
        const rawProducts = Array.isArray(payload.items)
          ? payload.items
          : (res.data.results || []);
        const safe = Array.isArray(rawProducts) ? rawProducts : [];
        setProducts(safe);
        if (typeof payload.total === "number") {
          setTotal(payload.total);
        } else {
          setTotal(safe.length);
        }
        if (payload.summary && typeof payload.summary === "object") {
          setSummaryStats({
            total: Number(payload.summary.total) || 0,
            active: Number(payload.summary.active) || 0,
            lowStock: Number(payload.summary.lowStock) || 0,
            outOfStock: Number(payload.summary.outOfStock) || 0,
          });
        } else {
          setSummaryStats(null);
        }
        if (typeof payload.page === "number") {
          setPage(payload.page);
        } else {
          setPage(requestedPage);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch products");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await sellerApi.getCategoryTree();
      if (res.data.success) {
        setDbCategories(res.data.results || res.data.result || []);
      }
    } catch (error) {
      // fail silently
    }
  };

  React.useEffect(() => {
    fetchCategories();
  }, []);

  const categories = dbCategories;

  const [searchTerm, setSearchTerm] = useState(qFromUrl);

  React.useEffect(() => {
    if (qFromUrl !== searchTerm) setSearchTerm(qFromUrl);
  }, [qFromUrl]);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [viewingVariants, setViewingVariants] = useState(null);
  const [isVariantsViewModalOpen, setIsVariantsViewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalTab, setModalTab] = useState("general");

  const makeSku = (name, index = 1) => {
    const prefix = String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5) || "item";
    return `${prefix}-${String(index).padStart(3, "0")}`;
  };

  const isAutoSku = (sku, name, index = 1) =>
    String(sku || "").toLowerCase() === makeSku(name, index);

  const displaySku = (product) =>
    product.sku ||
    (Array.isArray(product.variants) && product.variants.length > 0 && product.variants[0]?.sku) ||
    makeSku(product.name, 1);

  const resolveLowStockThreshold = (product) => {
    const parsed = Number(product?.lowStockAlert);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  };

  const getEffectiveProductStock = (product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (variants.length > 0) {
      return variants.reduce((sum, v) => sum + (Number(v?.stock) || 0), 0);
    }
    const top = Number(product?.stock);
    return Number.isFinite(top) ? top : 0;
  };

  const handleModalScrollWheel = (event) => {
    const container = event.currentTarget;
    if (container.scrollHeight <= container.clientHeight) return;
    container.scrollTop += event.deltaY;
    event.preventDefault();
    event.stopPropagation();
  };

  React.useEffect(() => {
    if (!isProductModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isProductModalOpen]);

  // Close filter dropdown on outside click
  React.useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (event) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  React.useEffect(() => {
    fetchProducts(1);
  }, [searchTerm, filterCategory, filterStatus, sortBy, pageSize]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    stock: "",
    lowStockAlert: 5,
    category: "",
    header: "",
    subcategory: "",
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
      { id: Date.now(), name: "", price: "", salePrice: "", stock: "", sku: "" },
    ],
  });

  const safeProducts = useMemo(
    () => (Array.isArray(products) ? products : []),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;

    return safeProducts.filter((p) => {
      const variantSkus = Array.isArray(p.variants)
        ? p.variants
          .map((v) => (v?.sku || "").toString().toLowerCase())
          .filter(Boolean)
        : [];
      const skuCandidate =
        (p.sku || "").toString().toLowerCase() ||
        (variantSkus.length > 0 ? variantSkus[0] : "");

      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (!!skuCandidate && skuCandidate.includes(term));
      const matchesCategory =
        filterCategory === "all" ||
        (p.categoryId?._id || p.categoryId) === filterCategory ||
        (p.headerId?._id || p.headerId) === filterCategory;

      let matchesStatus = filterStatus === "All";
      if (filterStatus === "Active") matchesStatus = p.status === "active";
      if (filterStatus === "Low Stock")
        matchesStatus = (() => {
          const stock = getEffectiveProductStock(p);
          return stock > 0 && stock <= resolveLowStockThreshold(p);
        })();
      if (filterStatus === "Out of Stock") matchesStatus = getEffectiveProductStock(p) === 0;

      let matchesPrice = true;
      const effectivePrice = Number(p.salePrice ?? p.price ?? 0);
      if (min !== null && !Number.isNaN(min)) {
        matchesPrice = matchesPrice && effectivePrice >= min;
      }
      if (max !== null && !Number.isNaN(max)) {
        matchesPrice = matchesPrice && effectivePrice <= max;
      }

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesPrice
      );
    });
  }, [
    safeProducts,
    searchTerm,
    filterCategory,
    filterStatus,
    priceMin,
    priceMax,
  ]);

  const stats = useMemo(
    () => ({
      total:
        summaryStats?.total ??
        (typeof total === "number" ? total : safeProducts.length),
      lowStock:
        summaryStats?.lowStock ??
        safeProducts.filter((p) => {
          const stock = getEffectiveProductStock(p);
          return stock > 0 && stock <= resolveLowStockThreshold(p);
        }).length,
      outOfStock:
        summaryStats?.outOfStock ??
        safeProducts.filter((p) => getEffectiveProductStock(p) === 0).length,
      active:
        summaryStats?.active ??
        safeProducts.filter((p) => p.status === "active").length,
    }),
    [safeProducts, summaryStats, total],
  );

  const ApprovalBadge = ({ approvalStatus }) => {
    const normalized = String(approvalStatus || "approved").toLowerCase();
    if (normalized === "pending") {
      return <Badge variant="warning" className="text-[10px] px-2 py-0.5">Pending Approval</Badge>;
    }
    if (normalized === "rejected") {
      return <Badge variant="error" className="text-[10px] px-2 py-0.5">Rejected</Badge>;
    }
    return <Badge variant="success" className="text-[10px] px-2 py-0.5">Approved</Badge>;
  };

  const handleSave = async () => {
    try {
      if (!formData.name || formData.price === "" || formData.price == null || formData.stock === "" || formData.stock == null || !formData.header || !formData.category) {
        toast.error("Please fill all required fields, including Main Group and Specific Category");
        return;
      }

      const mainStock = Number(formData.stock);
      if (!Number.isFinite(mainStock) || mainStock < 0) {
        toast.error("Stock cannot be negative");
        return;
      }
      const negativeVariant = (formData.variants || []).find((v) => {
        const s = Number(v.stock);
        return v.stock !== "" && v.stock != null && (!Number.isFinite(s) || s < 0);
      });
      if (negativeVariant) {
        toast.error("Variant stock cannot be negative");
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

      const data = new FormData();
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      const firstVariant = formData.variants[0] || {};
      data.append("price", Number(firstVariant.price || formData.price));
      data.append("salePrice", Number(firstVariant.salePrice || formData.salePrice || 0));
      data.append("costPrice", Number(firstVariant.costPrice || formData.costPrice || 0));
      data.append("stock", Number(firstVariant.stock || formData.stock));
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);
      data.append("status", formData.status);
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("deliveryType", formData.deliveryType || "instant");
      if (formData.deliveryType === "scheduled") {
        data.append("packageLength", formData.packageLength);
        data.append("packageBreadth", formData.packageBreadth);
        data.append("packageHeight", formData.packageHeight);
      }
      data.append("isReturnable", formData.isReturnable);
      if (formData.isReturnable) {
        data.append("returnWindowDays", formData.returnWindowDays);
      }
      data.append("tags", formData.tags);
      data.append("variants", JSON.stringify(formData.variants));

      if (formData.mainImageFile) {
        data.append("mainImage", formData.mainImageFile);
      }
      const keptGalleryUrls = (formData.galleryImages || []).filter(
        (url) => typeof url === "string" && /^https?:\/\//i.test(url),
      );
      data.append("existingGalleryImages", JSON.stringify(keptGalleryUrls));
      if (formData.galleryFiles && formData.galleryFiles.length > 0) {
        formData.galleryFiles.forEach((file) => data.append("galleryImages", file));
      }

      if (editingItem) {
        const response = await sellerApi.updateProduct(editingItem._id || editingItem.id, data);
        const approvalStatus = response?.data?.result?.approvalStatus;
        if (approvalStatus === "pending") {
          toast.success("Product changes submitted for admin approval");
        } else {
          toast.success(response?.data?.message || "Product updated successfully");
        }
      } else {
        const response = await sellerApi.createProduct(data);
        const approvalStatus = response?.data?.result?.approvalStatus;
        if (approvalStatus === "pending") {
          toast.success("Product submitted for admin approval");
        } else {
          toast.success(response?.data?.message || "Product created successfully");
        }
      }

      setIsProductModalOpen(false);
      setEditingItem(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "main") {
          setFormData({ ...formData, mainImage: reader.result, mainImageFile: file });
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

  const exportProducts = () => {
    console.log("Exporting products...");
    alert("Exporting " + safeProducts.length + " products as CSV (Simulation)");
  };

  const handleDeleteClick = (product) => {
    setItemToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await sellerApi.deleteProduct(itemToDelete._id || itemToDelete.id);
      toast.success("Product deleted successfully");
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchProducts();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const openEditModal = (item = null) => {
    if (item) {
      setFormData({
        name: item.name || "",
        slug: item.slug || "",
        sku: item.sku || "",
        description: item.description || "",
        price: item.price || "",
        salePrice: item.salePrice || "",
        costPrice: item.costPrice || "",
        stock: item.stock || "",
        lowStockAlert: item.lowStockAlert || 5,
        header: item.headerId?._id || item.headerId || "",
        category: item.categoryId?._id || item.categoryId || "",
        subcategory: item.subcategoryId?._id || item.subcategoryId || "",
        status: item.status || "active",
        tags: Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "",
        weight: item.weight || "",
        weightVal: Number.isFinite(parseFloat(String(item.weight || "").replace(/[^\d.]/g, ""))) ? String(parseFloat(String(item.weight || "").replace(/[^\d.]/g, ""))) : "",
        weightUnit: (String(item.weight || "").toLowerCase().includes("gm") || String(item.weight || "").toLowerCase().includes("gram")) ? "gm" : "kg",
        packageLength: item.packageLength != null && item.packageLength !== "" ? String(item.packageLength) : "",
        packageBreadth: item.packageBreadth != null && item.packageBreadth !== "" ? String(item.packageBreadth) : "",
        packageHeight: item.packageHeight != null && item.packageHeight !== "" ? String(item.packageHeight) : "",
        deliveryType: item.deliveryType || "instant",
        brand: item.brand || "",
        isReturnable: item.isReturnable ?? true,
        returnWindowDays: item.returnWindowDays ?? 1,
        mainImage: item.mainImage || null,
        galleryImages: item.galleryImages || [],
        variants: (item.variants && item.variants.length > 0) ? item.variants.map(v => ({ ...v, id: v._id || Date.now(), costPrice: v.costPrice || "" })) : [
          {
            id: Date.now(),
            name: "",
            price: item.price || "",
            salePrice: item.salePrice || "",
            costPrice: item.costPrice || "",
            stock: item.stock || "",
            sku: item.sku || "",
          },
        ],
      });
      setEditingItem(item);
    } else {
      setFormData({
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
        isReturnable: true,
        returnWindowDays: 1,
        mainImage: null,
        galleryImages: [],
        variants: [
          {
            id: Date.now(),
            name: "",
            price: "",
            salePrice: "",
            costPrice: "",
            stock: "",
            sku: "",
          },
        ],
      });
      setEditingItem(null);
    }
    setModalTab("general");
    setIsProductModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-16">

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Product List
            <Badge
              variant="primary"
              className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase">
              Live
            </Badge>
          </h1>
          <p className="text-gray-500 mt-1">
            Track your items, prices, and how many are left in stock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate("/seller/products/bulk")}
            className="flex items-center gap-2 bg-white border border-slate-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <HiOutlineCloudArrowUp className="h-5 w-5" />
            Bulk Upload
          </button>
          <button
            onClick={() => navigate("/seller/products/add")}
            className="flex items-center gap-2 bg-black  text-primary-foreground px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
            <HiOutlinePlus className="h-5 w-5" />
            Add New Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "All Items",
            val: stats.total,
            icon: HiOutlineCube,
            color: "text-brand-600",
            bg: "bg-brand-50",
            status: "All",
          },
          {
            label: "Active Items",
            val: stats.active,
            icon: HiOutlineCheckCircle,
            color: "text-brand-600",
            bg: "bg-brand-50",
            status: "Active",
          },
          {
            label: "Low Stock",
            val: stats.lowStock,
            icon: HiOutlineExclamationCircle,
            color: "text-amber-600",
            bg: "bg-amber-50",
            status: "Low Stock",
          },
          {
            label: "Out of Stock",
            val: stats.outOfStock,
            icon: HiOutlineArchiveBox,
            color: "text-rose-600",
            bg: "bg-rose-50",
            status: "Out of Stock",
          },
        ].map((stat, i) => (
          <Card
            key={i}
            className={cn(
              "border-none shadow-sm ring-1 ring-slate-100 p-4 relative overflow-hidden group cursor-pointer",
              filterStatus === stat.status && "ring-2 ring-brand-500",
            )}
            onClick={() => setFilterStatus(stat.status)}
          >
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300", stat.bg, stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="ds-label">{stat.label}</p>
                <h4 className="ds-stat-medium">{stat.val}</h4>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbox */}

      <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row gap-3 items-center">
          <div className="relative flex-1 group w-full">
            <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-all" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                const next = new URLSearchParams(searchParams);
                if (value) next.set("q", value);
                else next.delete("q");
                setSearchParams(next);
              }}
              placeholder="Search by name, SKU or slug..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/5 transition-all outline-none"
            />
          </div>
          <div className="relative flex gap-2 shrink-0 w-full lg:w-auto">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((h) => (
                <optgroup key={h._id || h.id} label={h.name}>
                  <option value={h._id || h.id}>All {h.name}</option>
                  {(h.children || []).map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div ref={filterDropdownRef}>
              <button
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <HiOutlineFunnel className="h-4 w-4" />
                <span>Filters</span>
              </button>

              {isFilterOpen && (
                <div className="absolute z-[100] right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-4 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                      Status
                    </p>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
                    >
                      <option value="All">All</option>
                      <option value="Active">Active</option>
                      <option value="Low Stock">Low Stock</option>
                      <option value="Out of Stock">Out of Stock</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                        Min Price
                      </p>
                      <input
                        type="number"
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                        Max Price
                      </p>
                      <input
                        type="number"
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)}
                        placeholder="e.g. 1000"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCategory("all");
                        setFilterStatus("All");
                        setPriceMin("");
                        setPriceMax("");
                        setSearchTerm("");
                        setSearchParams({});
                      }}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-700"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="price-asc">Price Low-High</option>
              <option value="price-desc">Price High-Low</option>
              <option value="stock-asc">Stock Low-High</option>
              <option value="stock-desc">Stock High-Low</option>
            </select>
          </div>
        </div>
      </Card>


      {/* Product Table */}

      <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Product Code
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Header
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Subcategory
                </th>
                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Variant
                </th>
                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Approval
                </th>
                <th className="px-6 py-3 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-3">
                        <HiOutlineMagnifyingGlass className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">No products found</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Try adjusting your search or filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                <tr
                  key={p._id || p.id}
                  className="hover:bg-gray-50/50 transition-colors group border-b border-gray-100 last:border-b-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200">
                        <img
                          src={
                            p.mainImage ||
                            p.image ||
                            "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400"
                          }
                          alt={p.name}
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {p.name}
                        </p>
                        {String(p.approvalStatus || "").toLowerCase() === "pending" ? (
                          <p className="text-[10px] font-medium text-amber-600">
                            Hidden from customers until admin approval.
                          </p>
                        ) : null}
                        {String(p.approvalStatus || "").toLowerCase() === "rejected" ? (
                          <p className="text-[10px] font-medium text-rose-600">
                            {p.approvalNote ? `Rejected: ${p.approvalNote}` : "Rejected by admin. Update and resubmit."}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-900">
                      {displaySku(p)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-slate-900 uppercase tracking-tight bg-slate-100 px-3 py-0.5 rounded-full w-fit">
                        {p.headerId?.name || "N/A"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-900">
                      {p.categoryId?.name || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-900">
                      {p.subcategoryId?.name || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {p.variants?.length > 0 ? (
                      <div
                        onClick={() => {
                          setViewingVariants(p);
                          setIsVariantsViewModalOpen(true);
                        }}
                        className="flex flex-col items-center cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-all active:scale-95 group"
                      >
                        <Badge
                          variant="indigo"
                          className="text-xs font-medium px-3 py-0.5 group-hover:shadow-sm transition-all"
                        >
                          {p.variants.length} VARIANTS
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded italic">
                        None
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <ApprovalBadge approvalStatus={p.approvalStatus} />
                      {p.approvalReviewedAt ? (
                        <span className="text-[10px] text-slate-400">
                          Reviewed
                        </span>
                      ) : p.approvalRequestedAt ? (
                        <span className="text-[10px] text-slate-400">
                          Submitted
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => {
                          setSelectedAiProduct(p);
                          setIsAiModalOpen(true);
                        }}
                        className="p-1.5 hover:text-primary hover:bg-primary/10 rounded-lg transition-all text-primary/80"
                        title="AI Sentiment & Return Intelligence"
                      >
                        <Sparkles className="h-4 w-4 animate-pulse" />
                      </button>
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 hover:text-brand-600 rounded-lg transition-all text-slate-500"
                        title="Edit Product"
                      >
                        <HiOutlinePencilSquare className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(p)}
                        className="p-1.5 hover:text-rose-600 rounded-lg transition-all text-slate-500"
                        title="Delete Product"
                      >
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>




      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.ceil(total / pageSize) || 1}
          total={total}
          pageSize={pageSize}
          onPageChange={(p) => fetchProducts(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
            fetchProducts(1);
          }}
          loading={isLoading}
        />
      </div>

      {/* Edit Modal (Copy from Admin) */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setIsProductModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-5xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                    <HiOutlineCube className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Edit Product
                    </h3>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <Badge
                        variant="primary"
                        className="text-[7px] font-bold uppercase tracking-widest px-1 bg-brand-100 text-brand-700">
                        SELLER
                      </Badge>
                      <HiOutlineChevronRight className="h-2.5 w-2.5 text-slate-300" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                        {formData.sku || "PENDING SKU"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
                {/* Modal Sidebar Tabs */}
                <div
                  className="lg:w-1/4 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto min-h-0"
                  onWheel={handleModalScrollWheel}>
                  {[
                    {
                      id: "general",
                      label: "General Info",
                      icon: HiOutlineTag,
                    },
                    {
                      id: "variants",
                      label: "Item Variants",
                      icon: HiOutlineSwatch,
                    },
                    {
                      id: "category",
                      label: "Groups",
                      icon: HiOutlineFolderOpen,
                    },
                    { id: "media", label: "Photos", icon: HiOutlinePhoto },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setModalTab(tab.id)}
                      className={cn(
                        "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left",
                        modalTab === tab.id
                          ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                          : "text-slate-600 hover:bg-slate-100",
                      )}>
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="pt-8 px-4">
                    <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
                      <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest mb-1">
                        Status
                      </p>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        className="w-full bg-transparent border-none text-xs font-bold text-brand-700 outline-none p-0 cursor-pointer focus:ring-0">
                        <option value="active">PUBLISHED</option>
                        <option value="inactive">DRAFT</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Modal Content Area */}
                <div
                  className="flex-1 p-8 overflow-y-auto min-h-0 overscroll-contain custom-scrollbar"
                  onWheel={handleModalScrollWheel}>
                  {modalTab === "general" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                            placeholder="e.g. Premium Basmati Rice"
                          />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Web Address
                          </label>
                          <div className="flex items-center bg-slate-50 rounded-xl px-4 py-2.5">
                            <span className="text-[10px] text-slate-600 font-bold mr-1">
                              /product/
                            </span>
                            <input
                              value={formData.slug}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  slug: e.target.value,
                                })
                              }
                              className="flex-1 bg-transparent border-none text-sm text-slate-600 font-semibold outline-none"
                              placeholder="premium-basmati-rice"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          About this item
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          onWheel={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none resize-none overflow-y-auto custom-scrollbar"
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
                              setFormData({
                                ...formData,
                                brand: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2"
                            placeholder="AUTO-GENERATED"
                          />
                        </div>
                      </div>

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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all"
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
                              className="flex-1 px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
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
                              className="w-24 px-2 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all"
                            >
                              <option value="kg">kg</option>
                              <option value="gm">gm</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {formData.deliveryType === "scheduled" && (
                        <div className="space-y-2 pt-2">
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
                                className="w-full px-3 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/5"
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
                                className="w-full px-3 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/5"
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
                                className="w-full px-3 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/5"
                                placeholder="cm"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Returns & Warranties */}
                      <div className="pt-6 mt-6 border-t border-slate-100 space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Returnable Product</h3>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Allow customers to return this product</p>
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
                          <div className="space-y-1.5 flex flex-col pt-2">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                              Return Window (Days) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={formData.returnWindowDays}
                              onChange={(e) => setFormData({ ...formData, returnWindowDays: parseInt(e.target.value) || 0 })}
                              className="w-full md:w-1/2 px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                              placeholder="e.g. 7"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Additional tabs populated as needed */}
                  {modalTab === "category" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer">
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
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
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
                          className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
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
                  )}

                  {modalTab === "media" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Main Cover Photo
                        </label>
                        <div className="flex flex-col md:flex-row items-start gap-6">
                          <div className="w-48 aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer overflow-hidden relative">
                            <input
                              type="file"
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                              onChange={(e) => handleImageUpload(e, "main")}
                            />
                            {formData.mainImage ? (
                              <img src={formData.mainImage} alt="Main Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center">
                                <HiOutlinePhoto className="h-10 w-10 text-slate-200" />
                                <p className="text-[10px] text-slate-600 font-bold mt-2">UPLOAD</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Gallery Photos
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {(formData.galleryImages || []).slice(0, 4).map((img, idx) => (
                            <div
                              key={`${img}-${idx}`}
                              className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden relative">
                              <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 4 - (formData.galleryImages || []).length) }).map((_, idx) => (
                            <div
                              key={`upload-${idx}`}
                              className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer overflow-hidden relative">
                              <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(e) => handleImageUpload(e, "gallery")}
                              />
                              <div className="flex flex-col items-center">
                                <HiOutlinePhoto className="h-8 w-8 text-slate-200" />
                                <p className="text-[10px] text-slate-600 font-bold mt-2">UPLOAD</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Existing gallery images are shown here. Uploading new images will append them to the gallery.
                        </p>
                      </div>
                    </div>
                  )}

                  {modalTab === "variants" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold">Product Variants</h4>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              variants: [
                                ...prev.variants,
                                {
                                  id: Date.now(),
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
                          className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-[10px] font-bold">+ ADD</button>
                      </div>
                      <div className="space-y-3">
                        {formData.variants.map((v, i) => (
                          <div key={v.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                            <div className="md:col-span-2 space-y-1">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Variant Name</label>
                              <input value={v.name} onChange={e => {
                                const news = [...formData.variants];
                                news[i].name = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="e.g. 1kg, 1 pack, 1 liter..." className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Price</label>
                              <input type="number" value={v.price} onChange={e => {
                                const news = [...formData.variants];
                                news[i].price = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Price" className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-brand-400 uppercase tracking-widest ml-1">Sale Price</label>
                              <input type="number" value={v.salePrice} onChange={e => {
                                const news = [...formData.variants];
                                news[i].salePrice = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Sale" className="w-full bg-brand-50/50 px-3 py-2 rounded-xl text-xs ring-1 ring-brand-100 text-brand-700 outline-none" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest ml-1">Cost Price (₹)</label>
                              <input type="number" value={v.costPrice || ""} onChange={e => {
                                const news = [...formData.variants];
                                news[i].costPrice = e.target.value;
                                setFormData({ ...formData, variants: news });
                              }} placeholder="Cost" className="w-full bg-emerald-50/50 px-3 py-2 rounded-xl text-xs ring-1 ring-emerald-100 text-emerald-800 outline-none" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">Stock</label>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                value={v.stock}
                                onKeyDown={(e) => {
                                  if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                                }}
                                onChange={e => {
                                  const news = [...formData.variants];
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    news[i].stock = '';
                                  } else {
                                    const n = Number(raw);
                                    news[i].stock = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                                  }
                                  const nextStock = i === 0 ? news[i].stock : formData.stock;
                                  setFormData({ ...formData, variants: news, stock: nextStock });
                                }}
                                placeholder="Stock"
                                className="w-full bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 space-y-1">
                                <label className="text-[8px] font-bold text-slate-600 uppercase tracking-widest ml-1">SKU</label>
                                <input value={v.sku} onChange={e => {
                                  const news = [...formData.variants];
                                  news[i].sku = e.target.value;
                                  setFormData({ ...formData, variants: news });
                                }} placeholder="SKU" className="w-full bg-white px-3 py-2 rounded-xl text-[10px] ring-1 ring-slate-100 outline-none" />
                              </div>
                              <button type="button" onClick={() => {
                                setFormData((prev) => {
                                  const remaining = prev.variants
                                    .map((variant, idx) => ({ variant, oldIndex: idx + 1 }))
                                    .filter((item, idx) => idx !== i)
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
                              }} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg shrink-0 mb-0.5">
                                <HiOutlineTrash className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                  CLOSE
                </button>
                <button
                  onClick={handleSave}
                  className="bg-slate-900 text-white px-10 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:-translate-y-0.5 transition-all">
                  SAVE CHANGES
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <div className="flex gap-4 justify-end w-full">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95">
              Delete product
            </button>
          </div>
        }>
        <div className="px-6 py-6 flex flex-col items-center text-center space-y-5">
          <div className="h-18 w-18 md:h-20 md:w-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <HiOutlineTrash className="h-9 w-9 md:h-10 md:w-10" />
          </div>
          <div className="space-y-2 max-w-md">
            <h4 className="text-lg font-semibold text-slate-900">
              Are you absolutely sure?
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              This action cannot be undone. This will permanently remove{" "}
              <span className="font-semibold text-slate-900">
                {itemToDelete?.name}
              </span>{" "}
              from the catalog.
            </p>
          </div>
        </div>
      </Modal>

      {/* Viewing Variants Modal */}
      <Modal
        isOpen={isVariantsViewModalOpen}
        onClose={() => setIsVariantsViewModalOpen(false)}
        title="Product Variants Details"
        size="lg"
      >
        <div className="py-2">
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="h-16 w-16 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center border border-slate-100">
              {viewingVariants?.mainImage || viewingVariants?.galleryImages?.[0] || viewingVariants?.image ? (
                <img src={viewingVariants.mainImage || viewingVariants.galleryImages?.[0] || viewingVariants.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <HiOutlineCube className="h-8 w-8 text-slate-200" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">{viewingVariants?.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="primary" className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">{viewingVariants?.categoryId?.name || 'Category'}</Badge>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Master SKU: {viewingVariants?.sku || viewingVariants?._id?.slice(-6).toUpperCase() || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Variant Specification</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Unit Price</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Available Stock</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">Variant SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {viewingVariants?.variants?.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 transition-all cursor-default">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700 group-hover:text-primary transition-colors">{v.name}</span>
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Variation {idx + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn("text-xs font-bold", v.salePrice > 0 ? "text-slate-600 line-through scale-90" : "text-slate-900")}>₹{v.price}</span>
                        {v.salePrice > 0 && <span className="text-xs font-bold text-brand-600">₹{v.salePrice}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={v.stock === 0 ? "rose" : v.stock <= 10 ? "amber" : "emerald"} className="text-[10px] font-black uppercase tracking-widest px-2 shadow-sm">
                        {v.stock === 0 ? 'OUT OF STOCK' : `${v.stock} UNITS`}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[10px] font-bold text-slate-600 font-mono tracking-tighter uppercase bg-slate-100 px-2 py-1 rounded-lg">
                        {v.sku || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setIsVariantsViewModalOpen(false)}
              className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
            >
              CLOSE VIEWER
            </button>
          </div>
        </div>
      </Modal>

      {/* AI Review & Sentiment Intelligence Modal */}
      <SentimentIntelligenceModal
        isOpen={isAiModalOpen}
        onClose={() => {
          setIsAiModalOpen(false);
          setSelectedAiProduct(null);
        }}
        productId={selectedAiProduct?._id}
        productName={selectedAiProduct?.name}
      />
    </div >
  );
};

export default ProductManagement;
