import React, { useState, useEffect, useRef } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  Plus,
  Search,
  Edit,
  Trash,
  Trash2,
  X,
  Upload,
  Image,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../../services/adminApi";
import { toast } from "sonner";
import IconSelector from "@shared/components/IconSelector";
import Pagination from "@shared/components/ui/Pagination";
import { getIconSvg } from "@shared/constants/categoryIcons";
import { useLockBodyScroll, preventBackdropScroll } from "@/shared/hooks/useLockBodyScroll";

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const isValidHexColor = (value) => HEX_COLOR_RE.test(String(value || "").trim());

const isValidCategoryName = (value) => {
  const name = String(value || "").trim();
  return name.length > 0;
};

/** Native <input type="color"> only accepts #rrggbb — expand #rgb when valid. */
const toColorInputValue = (value, fallback) => {
  const raw = String(value || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
};

const HEADER_COLOR_FIELDS = [
  { key: "headerColor", label: "Header Background" },
  { key: "headerFontColor", label: "Title/Text Color" },
  { key: "headerIconColor", label: "Active Tab / Icon Color" },
];

// MUI icon library (shared with customer app & icon selector)
import HomeIcon from "@mui/icons-material/Home";
import DevicesIcon from "@mui/icons-material/Devices";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import KitchenIcon from "@mui/icons-material/Kitchen";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SpaIcon from "@mui/icons-material/Spa";
import ToysIcon from "@mui/icons-material/Toys";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import YardIcon from "@mui/icons-material/Yard";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import DiamondIcon from "@mui/icons-material/Diamond";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import BuildIcon from "@mui/icons-material/Build";
import LuggageIcon from "@mui/icons-material/Luggage";

const makeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-");

const HeaderCategories = () => {
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    status: "active",
    type: "header",
    parentId: null,
    iconId: "",
    adminCommission: "",
    handlingFees: "",
    headerColor: "#FF1E1E",
    headerFontColor: "#111111",
    headerIconColor: "#111111",
    sortOrder: 0,
  });

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [colorErrors, setColorErrors] = useState({});
  const [nameError, setNameError] = useState("");
  const fileInputRef = useRef(null);

  const isAnyModalOpen = isAddModalOpen || isDeleteModalOpen || isIconSelectorOpen;
  useLockBodyScroll(isAnyModalOpen);

  // Map our icon ids to MUI icon components so admin UI
  // previews the same icons used in the customer app.
  const iconComponents = {
    electronics: DevicesIcon,
    fashion: CheckroomIcon,
    home: HomeIcon,
    food: LocalCafeIcon,
    sports: SportsSoccerIcon,
    books: MenuBookIcon,
    beauty: SpaIcon,
    toys: ToysIcon,
    automotive: DirectionsCarIcon,
    pets: PetsIcon,
    health: LocalHospitalIcon,
    garden: YardIcon,
    office: BusinessCenterIcon,
    music: MusicNoteIcon,
    jewelry: DiamondIcon,
    baby: ChildCareIcon,
    tools: BuildIcon,
    luggage: LuggageIcon,
    art: ColorLensIcon,
    grocery: LocalGroceryStoreIcon,
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchCategories(1), 400);
    return () => clearTimeout(timer);
  }, [searchTerm, pageSize]);

  const fetchCategories = async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const params = { type: "header", page: requestedPage, limit: pageSize };
      if (searchTerm) params.search = searchTerm;
      const res = await adminApi.getCategories(params);
      if (res.data.success) {
        const payload = res.data.result || {};
        const list = Array.isArray(payload.items) ? payload.items : [];
        const allCats = res.data.results || [];
        const headers = list.length > 0 ? list : allCats.filter((c) => c.type === "header");
        setCategories(headers);
        setTotal(typeof payload.total === "number" ? payload.total : headers.length);
        setPage(typeof payload.page === "number" ? payload.page : requestedPage);
      }
    } catch (error) {
      toast.error("Failed to fetch header categories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(categories.map((c) => c._id || c.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelect = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter((item) => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedItems.length === 0) return;
    // In a real app, you would have a bulk delete API endpoint
    // For now, we'll just show a toast
    toast.info(
      `Bulk delete functionality for ${selectedItems.length} items would be triggered here.`,
    );
    setSelectedItems([]);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleNameChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: makeSlug(value),
    }));
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      setNameError("Name is required");
    } else {
      setNameError("");
    }
  };

  const setColorField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setColorErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      if (isValidHexColor(value)) delete next[key];
      else next[key] = "Enter a valid hex color (e.g. #FF1E1E or #F00)";
      return next;
    });
  };

  const validateHeaderColors = () => {
    const nextErrors = {};
    for (const { key, label } of HEADER_COLOR_FIELDS) {
      const value = String(formData[key] || "").trim();
      if (!value) {
        nextErrors[key] = `${label} is required`;
      } else if (!isValidHexColor(value)) {
        nextErrors[key] = `Invalid hex for ${label}. Use #RGB or #RRGGBB`;
      }
    }
    setColorErrors(nextErrors);
    return nextErrors;
  };

  const handleSave = async () => {
    const trimmedName = String(formData.name || "").trim();
    if (!trimmedName || !formData.slug) {
      if (!trimmedName) setNameError("Name is required");
      toast.error("Name and slug are required");
      return;
    }
    setNameError("");

    const hexErrors = validateHeaderColors();
    if (Object.keys(hexErrors).length > 0) {
      const first = Object.values(hexErrors)[0];
      toast.error(first || "Please fix invalid hex color codes");
      return;
    }

    // Normalize to uppercase #RRGGBB / #RGB for consistent storage
    const normalizedColors = {};
    for (const { key } of HEADER_COLOR_FIELDS) {
      normalizedColors[key] = String(formData[key]).trim().toUpperCase();
    }

    setIsSaving(true);
    try {
      const data = new FormData();
      // Ensure type is always header
      data.append("type", "header");
      Object.keys(formData).forEach((key) => {
        if (key === "type") return;
        if (key === "adminCommission" || key === "handlingFees") {
          data.append(key, formData[key] === "" ? "0" : String(formData[key]));
          return;
        }
        if (normalizedColors[key]) {
          data.append(key, normalizedColors[key]);
          return;
        }
        data.append(key, formData[key]);
      });

      if (imageFile) {
        data.append("image", imageFile);
      } else if (previewUrl && !previewUrl.startsWith("blob:")) {
        data.append("image", previewUrl);
      }

      if (editingItem) {
        await adminApi.updateCategory(editingItem._id || editingItem.id, data);
        toast.success("Header category updated");
      } else {
        await adminApi.createCategory(data);
        toast.success("Header category created");
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
      setColorErrors({});
      fetchCategories(page);
    } catch (error) {
      console.error(error);
      const msg =
        error?.response?.data?.message ||
        (editingItem ? "Failed to update" : "Failed to create");
      const normalized = String(msg).toLowerCase();
      if (
        normalized.includes("already exist") ||
        normalized.includes("slug already") ||
        normalized.includes("duplicate")
      ) {
        setNameError(msg);
      }
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await adminApi.deleteCategory(deleteTarget._id || deleteTarget.id);
      toast.success("Header category deleted");
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchCategories(page);
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setColorErrors({});
    setNameError("");
    setFormData({
      name: "",
      slug: "",
      description: "",
      status: "active",
      type: "header",
      parentId: null,
      iconId: "",
      adminCommission: "",
      handlingFees: "",
      headerColor: "#FF1E1E",
      headerFontColor: "#111111",
      headerIconColor: "#111111",
      sortOrder: 0,
    });
    setImageFile(null);
    setPreviewUrl(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setColorErrors({});
    setNameError("");
    setFormData({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      status: item.status,
      type: "header",
      parentId: null,
      iconId: item.iconId || "",
      adminCommission: item.adminCommission ?? "",
      handlingFees: item.handlingFees ?? "",
      headerColor: item.headerColor || "#FF1E1E",
      headerFontColor: item.headerFontColor || "#FFFFFF",
      headerIconColor: item.headerIconColor || "#111111",
      sortOrder: item.sortOrder ?? 0,
    });
    setPreviewUrl(item.image || null);
    setIsAddModalOpen(true);
  };

  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedMasterCategories = async () => {
    if (!window.confirm("Seed master categories? This will auto-populate and sync master categories (Grocery, Electronics, Beauty, Home, Baby Care, Pet Care, etc.). Existing custom categories will not be lost.")) {
      return;
    }
    setIsSeeding(true);
    const toastId = toast.loading("Seeding master categories & subcategories...");
    try {
      const res = await adminApi.seedMasterCategories();
      toast.success(res.data?.message || "Master categories seeded successfully!", { id: toastId });
      fetchCategories();
    } catch (err) {
      console.error("Master category seeding error:", err);
      toast.error(err.response?.data?.message || "Failed to seed master categories", { id: toastId });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Header Categories
          </h1>
          <p className="text-gray-500 mt-1">Manage top-level categories</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSeedMasterCategories}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-semibold shadow-sm active:scale-95 disabled:opacity-50 text-sm cursor-pointer"
            title="Auto-populate Blinkit Master Categories & Subcategories"
          >
            <Sparkles className={cn("w-4 h-4", isSeeding && "animate-spin")} />
            {isSeeding ? "Seeding..." : "Seed Master Categories"}
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-black text-primary-foreground px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-semibold cursor-pointer">
            <Plus className="w-5 h-5" />
            Add New Header
          </button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <div className="p-4 border-b border-gray-100 flex gap-4 items-center">
          {selectedItems.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium">
              <Trash2 className="w-4 h-4" />
              Delete ({selectedItems.length})
            </button>
          )}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search header categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="w-12 py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    checked={
                      selectedItems.length > 0 &&
                      categories.length > 0 &&
                      selectedItems.length === categories.length
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Comm (%)
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Fees (₹)
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    No header categories found
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr
                    key={cat._id || cat.id}
                    className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        checked={selectedItems.includes(cat._id || cat.id)}
                        onChange={() => handleSelect(cat._id || cat.id)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                        {cat.iconId && iconComponents[cat.iconId] ? (
                          <div className="w-6 h-6 text-brand-600 flex items-center justify-center">
                            {(() => {
                              const IconComp = iconComponents[cat.iconId];
                              return <IconComp fontSize="medium" />;
                            })()}
                          </div>
                        ) : cat.iconId && getIconSvg(cat.iconId) ? (
                          <div
                            className="w-6 h-6 text-brand-600"
                            dangerouslySetInnerHTML={{
                              __html: getIconSvg(cat.iconId),
                            }}
                          />
                        ) : cat.image ? (
                          <img
                            src={cat.image}
                            alt={cat.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Image className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {cat.name}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{cat.slug}</td>
                    <td className="py-3 px-4 text-gray-500 font-medium">
                      {cat.adminCommission ?? 0}%
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-medium">
                      ₹{cat.handlingFees ?? 0}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          cat.status === "active" ? "success" : "warning"
                        }>
                        {cat.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-1 text-gray-500 hover:text-brand-600 transition-colors">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(cat);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1 text-gray-500 hover:text-red-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / pageSize) || 1}
            total={total}
            pageSize={pageSize}
            onPageChange={(p) => fetchCategories(p)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            loading={isLoading}
          />
        </div>
      </Card>

      {/* Add/Edit Modal — z above Topbar (z-200) so navbar is covered */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onWheel={preventBackdropScroll}
            onTouchMove={preventBackdropScroll}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsAddModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingItem ? "Edit Header Category" : "Add Header Category"}
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div
                className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y"
                tabIndex={0}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {/* Icon/Image Selection */}
                <div className="flex flex-col items-center gap-4">
                  <div className="flex gap-4">
                    {/* SVG Icon Display */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-24 h-24 rounded-full bg-linear-to-br from-brand-50 to-purple-50 border-2 border-brand-200 flex items-center justify-center">
                        {formData.iconId && iconComponents[formData.iconId] ? (
                          <div className="w-12 h-12 text-brand-600 flex items-center justify-center">
                            {(() => {
                              const IconComp = iconComponents[formData.iconId];
                              return <IconComp fontSize="large" />;
                            })()}
                          </div>
                        ) : formData.iconId && getIconSvg(formData.iconId) ? (
                          <div
                            className="w-12 h-12 text-brand-600"
                            dangerouslySetInnerHTML={{
                              __html: getIconSvg(formData.iconId),
                            }}
                          />
                        ) : (
                          <Sparkles className="w-10 h-10 text-brand-300" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsIconSelectorOpen(true)}
                        className="px-3 py-1.5 text-sm bg-black text-primary-foreground rounded-lg hover:bg-brand-700 transition-colors">
                        {formData.iconId ? 'Change Icon' : 'Select Icon'}
                      </button>
                    </div>

                    {/* OR Divider */}
                    <div className="flex items-center">
                      <span className="text-gray-400 font-medium">OR</span>
                    </div>

                    {/* Image Upload */}
                    <div className="flex flex-col items-center gap-2">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-brand-500 overflow-hidden transition-colors">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center">
                            <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                            <span className="text-xs text-gray-500 mt-1">
                              Upload
                            </span>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleImageChange}
                        accept="image/*"
                      />
                      <span className="text-xs text-gray-500">Custom Image</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Choose an SVG icon or upload a custom image
                  </p>
                </div>

                {/* Header Color Picker */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Header Background
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={toColorInputValue(formData.headerColor, "#FF1E1E")}
                        onChange={(e) => setColorField("headerColor", e.target.value)}
                        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.headerColor || ""}
                        onChange={(e) => setColorField("headerColor", e.target.value)}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2",
                          colorErrors.headerColor
                            ? "border-rose-400 focus:ring-rose-500/20"
                            : "border-gray-300 focus:ring-brand-500/20",
                        )}
                        placeholder="#FF1E1E"
                        aria-invalid={Boolean(colorErrors.headerColor)}
                      />
                    </div>
                    {colorErrors.headerColor && (
                      <p className="text-[11px] font-semibold text-rose-600">{colorErrors.headerColor}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Title/Text Color
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={toColorInputValue(formData.headerFontColor, "#FFFFFF")}
                        onChange={(e) => setColorField("headerFontColor", e.target.value)}
                        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.headerFontColor || ""}
                        onChange={(e) => setColorField("headerFontColor", e.target.value)}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2",
                          colorErrors.headerFontColor
                            ? "border-rose-400 focus:ring-rose-500/20"
                            : "border-gray-300 focus:ring-brand-500/20",
                        )}
                        placeholder="#FFFFFF"
                        aria-invalid={Boolean(colorErrors.headerFontColor)}
                      />
                    </div>
                    {colorErrors.headerFontColor && (
                      <p className="text-[11px] font-semibold text-rose-600">{colorErrors.headerFontColor}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Active Tab / Icon Color
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={toColorInputValue(formData.headerIconColor, "#111111")}
                        onChange={(e) => setColorField("headerIconColor", e.target.value)}
                        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
                      />
                      <input
                        type="text"
                        value={formData.headerIconColor || ""}
                        onChange={(e) => setColorField("headerIconColor", e.target.value)}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2",
                          colorErrors.headerIconColor
                            ? "border-rose-400 focus:ring-rose-500/20"
                            : "border-gray-300 focus:ring-brand-500/20",
                        )}
                        placeholder="#111111"
                        aria-invalid={Boolean(colorErrors.headerIconColor)}
                      />
                    </div>
                    {colorErrors.headerIconColor && (
                      <p className="text-[11px] font-semibold text-rose-600">{colorErrors.headerIconColor}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2",
                      nameError
                        ? "border-rose-400 focus:ring-rose-500/20"
                        : "border-gray-300 focus:ring-brand-500/20 focus:border-brand-500",
                    )}
                    placeholder="e.g., Electronics"
                    aria-invalid={Boolean(nameError)}
                  />
                  {nameError && (
                    <p className="text-[11px] font-semibold text-rose-600">{nameError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    readOnly
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g., electronics"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Display Order # (Position)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.sortOrder ?? 0}
                    onChange={(e) =>
                      setFormData({ ...formData, sortOrder: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="e.g. 1, 2, 3"
                  />
                  <p className="text-[11px] text-gray-500">Lower numbers appear first on customer header (e.g. 1 for Grocery, 2 for Baby Care).</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Admin Commission (%)
                    </label>
                    <input
                      type="number"
                      value={formData.adminCommission}
                      onChange={(e) =>
                        setFormData({ ...formData, adminCommission: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      placeholder="0"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Handling Fees (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.handlingFees}
                      onChange={(e) =>
                        setFormData({ ...formData, handlingFees: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 shrink-0">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-black text-primary-foreground rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 flex items-center gap-2">
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {editingItem ? "Update Header" : "Create Header"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Icon Selector Modal */}
      <AnimatePresence>
        {isIconSelectorOpen && (
          <IconSelector
            selectedIcon={formData.iconId}
            onSelect={(iconId) => {
              setFormData({ ...formData, iconId });
              setIsIconSelectorOpen(false);
            }}
            onClose={() => setIsIconSelectorOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onWheel={preventBackdropScroll}
            onTouchMove={preventBackdropScroll}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Delete Category?
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-900">
                    {deleteTarget?.name}
                  </span>
                  ? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HeaderCategories;
