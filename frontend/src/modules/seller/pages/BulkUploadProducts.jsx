import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowDownTray,
  HiOutlineCloudArrowUp,
  HiOutlineDocumentArrowUp,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineXMark,
} from "react-icons/hi2";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import { cn } from "@/lib/utils";

const BulkUploadProducts = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);

  const acceptFile = (selected) => {
    if (!selected) return;
    const name = String(selected.name || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      toast.error("Please select an Excel file (.xlsx)");
      return;
    }
    setFile(selected);
    setResult(null);
  };

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const res = await sellerApi.downloadBulkTemplate();
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-bulk-upload-sample.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Sample Excel downloaded");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to download sample Excel",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Select an Excel file first");
      return;
    }
    setIsUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await sellerApi.bulkUploadProducts(formData);
      const payload = res.data?.result || {};
      setResult(payload);
      if (payload.created > 0) {
        toast.success(res.data?.message || `${payload.created} products uploaded`);
      } else {
        toast.error(res.data?.message || "No products were created");
      }
    } catch (error) {
      const payload = error?.response?.data?.result;
      if (payload) {
        setResult(payload);
      }
      toast.error(
        error?.response?.data?.message || "Bulk upload failed. Check your file.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/seller/products")}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <HiOutlineArrowLeft className="h-4 w-4" />
            Back to products
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Bulk Upload Products</h1>
          <p className="text-gray-500 mt-1">
            Download the sample Excel, fill your products, then upload the file.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <HiOutlineArrowDownTray className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900">1. Download sample Excel</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Includes Instructions sheet and sample product rows. Replace samples
              with your real data. Use exact header / category / subcategory names
              from your catalog Groups. Variant columns are already included.
            </p>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={isDownloading}
              className="mt-3 inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
            >
              <HiOutlineDocumentArrowUp className="h-4 w-4" />
              {isDownloading ? "Downloading…" : "Download sample Excel"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <HiOutlineCloudArrowUp className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900">2. Upload filled Excel</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Required columns: name, price, stock, category. Header optional hai.
              You can also add variants via variant1/2/3 columns or variantsJson.
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-gray-800 bg-slate-50"
              : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/50",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <HiOutlineCheckCircle className="h-8 w-8 text-emerald-600" />
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB — click to change file
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setResult(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="mt-1 inline-flex items-center gap-1 text-xs text-rose-600 hover:underline"
              >
                <HiOutlineXMark className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <HiOutlineCloudArrowUp className="h-8 w-8" />
              <p className="font-medium text-gray-700">
                Drop your .xlsx file here, or click to browse
              </p>
              <p className="text-xs">Excel only (.xlsx)</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          <HiOutlineCloudArrowUp className="h-4 w-4" />
          {isUploading ? "Uploading…" : "Upload products"}
        </button>
      </div>

      {result && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Upload result</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">
                Created
              </p>
              <p className="text-2xl font-bold text-emerald-800 mt-1">
                {result.created ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
              <p className="text-xs text-rose-700 font-medium uppercase tracking-wide">
                Failed
              </p>
              <p className="text-2xl font-bold text-rose-800 mt-1">
                {result.failed ?? 0}
              </p>
            </div>
          </div>

          {result.requiresApproval && result.created > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Created products were submitted for admin approval.
            </p>
          )}

          {Array.isArray(result.errors) && result.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                <HiOutlineExclamationCircle className="h-4 w-4 text-rose-500" />
                Errors
              </p>
              <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                {result.errors.map((err, idx) => (
                  <li key={`${err.row}-${idx}`} className="px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800">
                      Row {err.row}
                      {err.name ? ` · ${err.name}` : ""}
                    </span>
                    <span className="text-gray-500"> — {err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.created > 0 && (
            <button
              type="button"
              onClick={() => navigate("/seller/products")}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 hover:underline"
            >
              View product list
              <HiOutlineArrowLeft className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1 px-1">
        <p>
          <span className="font-medium text-gray-700">Required:</span> name, price,
          stock, category
        </p>
        <p>
          <span className="font-medium text-gray-700">Header:</span> optional, but
          recommended when same category name exists in multiple headers.
        </p>
        <p>
          <span className="font-medium text-gray-700">Scheduled delivery:</span> also
          needs weight and packageLength / packageBreadth / packageHeight (cm)
        </p>
        <p>
          <span className="font-medium text-gray-700">Images:</span> optional public
          URL in mainImage column (file images not supported in bulk)
        </p>
        <p>
          <span className="font-medium text-gray-700">Variants:</span> use
          variant1/2/3 columns (name/price/salePrice/stock/sku) or `variantsJson`.
          When variants are filled, product stock is calculated from variant stock.
        </p>
      </div>
    </div>
  );
};

export default BulkUploadProducts;
