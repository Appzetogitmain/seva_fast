import React, { useEffect, useState } from "react";
import {
  HiOutlinePencilSquare,
  HiOutlinePhoto,
  HiOutlinePlus,
  HiOutlineXMark,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import { adminApi } from "../services/adminApi";
import Card from "@shared/components/ui/Card";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import { cn } from "@/lib/utils";

const emptyBannerItem = () => ({
  imageUrl: "",
  title: "",
  subtitle: "",
  linkType: "none",
  linkValue: "",
  isUploading: false,
});

export default function HeroCategoriesPerPage() {
  const { showToast } = useToast();
  const [headers, setHeaders] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [pageData, setPageData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [formBanners, setFormBanners] = useState([emptyBannerItem()]);
  const [formCategoryIds, setFormCategoryIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const treeRes = await adminApi.getCategoryTree();
        const tree = treeRes.data?.results || treeRes.data?.result || [];
        const headerList = Array.isArray(tree) ? tree : [];
        if (cancelled) return;
        setHeaders(headerList);

        const flatCategories = headerList.flatMap((h) => (h.children || []).map((c) => ({ ...c, headerName: h.name })));
        setAllCategories(flatCategories);

        const homeRes = await adminApi.getHeroConfig({ pageType: "home" });
        const homeResult = homeRes.data?.result || homeRes.data || {};
        const homeBanners = homeResult.banners?.items || [];
        const homeCatIds = homeResult.categoryIds || [];

        const rows = [
          {
            id: "home",
            label: "Home",
            pageType: "home",
            headerId: null,
            bannerCount: homeBanners.length,
            categoryCount: homeCatIds.length,
          },
        ];

        await Promise.all(
          headerList.map(async (h) => {
            const res = await adminApi.getHeroConfig({
              pageType: "header",
              headerId: h._id,
            });
            if (cancelled) return;
            const result = res.data?.result || res.data || {};
            const items = result.banners?.items || [];
            const catIds = result.categoryIds || [];
            rows.push({
              id: h._id,
              label: h.name || "Unnamed",
              pageType: "header",
              headerId: h._id,
              bannerCount: items.length,
              categoryCount: catIds.length,
            });
          })
        );

        if (!cancelled) setPageData(rows);
      } catch (e) {
        if (!cancelled) console.error(e);
        showToast("Failed to load hero config", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [showToast]);

  const openEdit = async (row) => {
    setEditingRow(row);
    setFormCategoryIds([]);
    setFormBanners([emptyBannerItem()]);
    try {
      const res = await adminApi.getHeroConfig({
        pageType: row.pageType,
        headerId: row.headerId || undefined,
      });
      const result = res.data?.result || res.data || {};
      const items = result.banners?.items || [];
      const catIds = result.categoryIds || [];
      setFormBanners(
        items.length
          ? items.map((b) => ({
              imageUrl: b.imageUrl || "",
              title: b.title || "",
              subtitle: b.subtitle || "",
              linkType: b.linkType || (b.linkValue ? "url" : "none"),
              linkValue: b.linkValue || "",
              status: b.status || "active",
              isUploading: false,
            }))
          : [emptyBannerItem()]
      );
      setFormCategoryIds(Array.isArray(catIds) ? catIds : []);
    } catch (e) {
      console.error(e);
    }
    setModalOpen(true);
  };

  const updateBannerItem = (idx, changes) => {
    setFormBanners((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...changes };
      return next;
    });
  };

  const addBannerItem = () => {
    setFormBanners((prev) => [...prev, emptyBannerItem()]);
  };

  const removeBannerItem = (idx) => {
    setFormBanners((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleBannerFileChange = async (idx, file) => {
    if (!file) return;
    updateBannerItem(idx, { isUploading: true });
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await adminApi.uploadExperienceBanner(fd);
      const url = res.data?.result?.url || res.data?.url;
      if (!url) throw new Error("Upload failed");
      updateBannerItem(idx, { imageUrl: url, isUploading: false });
      showToast("Banner image uploaded", "success");
    } catch (e) {
      console.error(e);
      updateBannerItem(idx, { isUploading: false });
      showToast("Failed to upload banner image", "error");
    }
  };

  const toggleCategory = (catId) => {
    setFormCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const moveCategoryUp = (index) => {
    if (index === 0) return;
    setFormCategoryIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveCategoryDown = (index) => {
    if (index === formCategoryIds.length - 1) return;
    setFormCategoryIds((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    const items = formBanners.filter((b) => b.imageUrl).map((b) => ({
      imageUrl: b.imageUrl,
      title: b.title || "",
      subtitle: b.subtitle || "",
      linkType: b.linkType || "none",
      linkValue: b.linkValue || "",
      status: b.status || "active",
    }));

    if (!editingRow) return;
    setSaving(true);
    try {
      await adminApi.setHeroConfig({
        pageType: editingRow.pageType,
        headerId: editingRow.headerId || undefined,
        banners: { items },
        categoryIds: formCategoryIds,
      });
      showToast("Hero config saved", "success");
      setPageData((prev) =>
        prev.map((p) =>
          p.id === editingRow.id
            ? {
              ...p,
              bannerCount: items.length,
              categoryCount: formCategoryIds.length,
            }
            : p
        )
      );
      setModalOpen(false);
      setEditingRow(null);
    } catch (e) {
      console.error(e);
      showToast(e.response?.data?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Hero & categories per page
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure the <strong>separate</strong> hero banners and categories strip at the top of each page.
          If a header page has no config, the storefront shows the home page hero and categories.
          Create Sections are for the main content area only.
        </p>
      </div>

      <Card className="p-4 md:p-6 border border-slate-100 bg-white rounded-xl shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-bold">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Page
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Hero (top banners)
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Categories below hero
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-slate-50 last:border-0",
                      "hover:bg-slate-50/50 transition-colors"
                    )}
                  >
                    <td className="py-4 pr-4">
                      <span className="font-bold text-slate-800">{row.label}</span>
                    </td>
                    <td className="py-4 pr-4">
                      {row.bannerCount > 0 ? (
                        <span className="text-xs font-semibold text-slate-600">
                          {row.bannerCount} banner(s)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      {row.categoryCount > 0 ? (
                        <span className="text-xs font-semibold text-slate-600">
                          {row.categoryCount} categor
                          {row.categoryCount === 1 ? "y" : "ies"}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                      >
                        <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        This is a <strong>separate</strong> hero section. Experience sections in Create Sections
        are unchanged and used for the main content area below.
      </p>

      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingRow ? `Edit hero & categories — ${editingRow.label}` : "Edit"}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        {editingRow && (
          <div className="space-y-6">
            <div>
              {/* Banner Size Recommendation Notice */}
              <div className="p-3 mb-3 bg-amber-50/90 border border-amber-200/80 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
                  <HiOutlinePhoto className="h-5 w-5" />
                </div>
                <div className="text-xs text-amber-950 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-[11px] text-amber-900 uppercase tracking-wider">Recommended Hero Banner Size</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-[10px] font-black">1200 × 520 px (~2.3:1)</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 leading-relaxed">
                    • <strong>Safe Area:</strong> Keep key text, offers & logo centered (middle 70–80%) so edges are not cut on mobile app screens.<br />
                    • Formats: PNG, JPG, WebP up to 5MB.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Hero banners (Top Carousel)
                </label>
                <button
                  type="button"
                  onClick={addBannerItem}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:opacity-80"
                >
                  <HiOutlinePlus className="h-3 w-3" />
                  Add banner
                </button>
              </div>
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {formBanners.map((item, idx) => (
                  <Card key={idx} className="p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2.5">
                        <div className="flex items-start gap-3">
                          <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title || `Banner ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <HiOutlinePhoto className="h-7 w-7 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                id={`hero-banner-file-${idx}`}
                                onChange={(e) => handleBannerFileChange(idx, e.target.files?.[0])}
                              />
                              <label
                                htmlFor={`hero-banner-file-${idx}`}
                                className="inline-block px-2.5 py-1 rounded-lg bg-slate-900 text-[10px] font-bold text-white cursor-pointer hover:bg-slate-800 transition-colors shadow-sm"
                              >
                                {item.isUploading ? "Uploading…" : item.imageUrl ? "Change Image" : "Choose Image"}
                              </label>
                              {item.imageUrl && (
                                <span className="text-[10px] text-emerald-600 font-bold">Image ready</span>
                              )}
                            </div>
                            <input
                              value={item.title || ""}
                              onChange={(e) => updateBannerItem(idx, { title: e.target.value })}
                              className="w-full p-2 bg-white rounded-lg text-xs font-bold border border-slate-200 outline-none focus:border-primary"
                              placeholder="Title (optional)"
                            />
                            <input
                              value={item.subtitle || ""}
                              onChange={(e) => updateBannerItem(idx, { subtitle: e.target.value })}
                              className="w-full p-2 bg-white rounded-lg text-xs font-bold border border-slate-200 outline-none focus:border-primary"
                              placeholder="Subtitle (optional)"
                            />
                          </div>
                        </div>

                        {/* Link / URL Destination Configuration */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              On Click Navigate To:
                            </span>
                            {item.linkType !== "none" && (
                              <span className="text-[9px] font-bold text-primary">Active Link</span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                                Link Destination Type
                              </label>
                              <select
                                value={item.linkType || "none"}
                                onChange={(e) => {
                                  const newType = e.target.value;
                                  let defaultVal = "";
                                  if (newType === "header" && headers.length) {
                                    defaultVal = headers[0]._id;
                                  } else if (newType === "category" && allCategories.length) {
                                    defaultVal = allCategories[0]._id;
                                  }
                                  updateBannerItem(idx, { linkType: newType, linkValue: defaultVal });
                                }}
                                className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border border-slate-200 outline-none focus:border-primary"
                              >
                                <option value="none">No Action (None)</option>
                                <option value="url">Website URL / Page Path</option>
                                <option value="category">Category Page</option>
                                <option value="header">Header Category</option>
                                <option value="product">Product Page</option>
                                <option value="subcategory">Subcategory Page</option>
                              </select>
                            </div>

                            {item.linkType !== "none" && (
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                                  {item.linkType === "url"
                                    ? "Page Path or External URL"
                                    : item.linkType === "category"
                                    ? "Select Category"
                                    : item.linkType === "header"
                                    ? "Select Header"
                                    : "ID / Slug / Path"}
                                </label>
                                {item.linkType === "category" ? (
                                  <select
                                    value={item.linkValue || ""}
                                    onChange={(e) => updateBannerItem(idx, { linkValue: e.target.value })}
                                    className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border border-slate-200 outline-none focus:border-primary"
                                  >
                                    <option value="">-- Choose Category --</option>
                                    {allCategories.map((c) => (
                                      <option key={c._id} value={c._id}>
                                        {c.name} {c.headerName ? `(${c.headerName})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                ) : item.linkType === "header" ? (
                                  <select
                                    value={item.linkValue || ""}
                                    onChange={(e) => updateBannerItem(idx, { linkValue: e.target.value })}
                                    className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border border-slate-200 outline-none focus:border-primary"
                                  >
                                    <option value="">-- Choose Header --</option>
                                    {headers.map((h) => (
                                      <option key={h._id} value={h._id}>
                                        {h.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={item.linkValue || ""}
                                    onChange={(e) => updateBannerItem(idx, { linkValue: e.target.value })}
                                    className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border border-slate-200 outline-none focus:border-primary"
                                    placeholder={
                                      item.linkType === "url"
                                        ? "e.g. /offers, /plans, or https://..."
                                        : item.linkType === "product"
                                        ? "e.g. product_id or /product/..."
                                        : "Slug or ID"
                                    }
                                  />
                                )}
                              </div>
                            )}
                          </div>
                          {item.linkType === "url" && (
                            <p className="text-[10px] text-slate-400">
                              Tip: Enter relative paths like <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded">/offers</code>, <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded">/plans</code>, <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded">/categories</code>, or full external URLs starting with <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded">https://</code>.
                            </p>
                          )}
                        </div>
                      </div>

                      {formBanners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBannerItem(idx)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Remove banner"
                        >
                          <HiOutlineXMark className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Categories below hero
              </label>

              <div className="space-y-4">
                {/* Selected Categories */}
                {formCategoryIds.length > 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-bold text-slate-500 mb-2">Selected Categories (in order):</p>
                    <div className="flex flex-col gap-2">
                      {formCategoryIds.map((catId, index) => {
                        const c = allCategories.find((cat) => cat._id === catId);
                        if (!c) return null;
                        return (
                          <div key={catId} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">{index + 1}</span>
                              {c.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveCategoryUp(index)}
                                disabled={index === 0}
                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md disabled:opacity-30 transition-colors"
                              >
                                <HiOutlineChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveCategoryDown(index)}
                                disabled={index === formCategoryIds.length - 1}
                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md disabled:opacity-30 transition-colors"
                              >
                                <HiOutlineChevronDown className="w-4 h-4" />
                              </button>
                              <div className="w-px h-4 bg-slate-200 mx-1" />
                              <button
                                type="button"
                                onClick={() => toggleCategory(catId)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                              >
                                <HiOutlineXMark className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available Categories */}
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">Available Categories (click to add):</p>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.filter(c => !formCategoryIds.includes(c._id)).map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => toggleCategory(c._id)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold border bg-slate-50 text-slate-600 border-slate-200 hover:bg-white transition-all"
                      >
                        + {c.name}
                      </button>
                    ))}
                  </div>
                  {allCategories.length === 0 && (
                    <p className="text-xs text-slate-400">No main categories found. Add categories in Header / Main Categories first.</p>
                  )}
                  {allCategories.length > 0 && allCategories.filter(c => !formCategoryIds.includes(c._id)).length === 0 && (
                    <p className="text-xs text-slate-400">All categories selected.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

