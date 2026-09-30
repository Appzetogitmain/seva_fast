import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Loader2, X, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Generated images come back as ~1024px PNGs (1-2MB). Resize to the panel's
// recommended size and re-encode as JPEG so the saved upload stays small.
const toSizedImage = (base64, mimeType, size, fileName) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is not supported on this device"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      // Center-crop to a square in case the model returns a non 1:1 image.
      const side = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
      );
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not prepare the image"));
            return;
          }
          resolve({
            file: new File([blob], fileName, { type: "image/jpeg" }),
            dataUrl,
          });
        },
        "image/jpeg",
        0.9,
      );
    };
    img.onerror = () => reject(new Error("Could not read the generated image"));
    img.src = `data:${mimeType};base64,${base64}`;
  });

/**
 * "Generate with AI" button + prompt dialog.
 * - generate: api call, e.g. adminApi.generateAiImage / sellerApi.generateAiImage
 * - target: "category" | "product" (picks the image style on the server)
 * - onUse({ file, dataUrl }): called when the user accepts the image
 */
const AiImageGenerator = ({
  generate,
  target = "product",
  defaultPrompt = "",
  size = 800,
  onUse,
  label = "Generate with AI",
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const open = () => {
    setPrompt(defaultPrompt || "");
    setResult(null);
    setIsOpen(true);
  };

  const close = () => {
    if (isGenerating) return;
    setIsOpen(false);
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 3) {
      toast.error("Please describe the image you want");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await generate({ prompt: cleanPrompt, target });
      const data = res.data.result || res.data.data || {};
      if (!data.imageBase64) throw new Error("No image returned");
      const sized = await toSizedImage(
        data.imageBase64,
        data.mimeType || "image/png",
        size,
        `ai-${target}-${Date.now()}.jpg`,
      );
      setResult(sized);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Couldn't generate the image. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUse = () => {
    if (!result) return;
    onUse?.(result);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm transition-colors cursor-pointer",
          className,
        )}>
        <Sparkles className="w-3.5 h-3.5" />
        {label}
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={close}>
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  Generate image with AI
                </h3>
                <button
                  type="button"
                  onClick={close}
                  className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Describe the image
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    maxLength={500}
                    disabled={isGenerating}
                    placeholder={
                      target === "category"
                        ? "e.g. Fresh fruits and vegetables in a basket"
                        : "e.g. 1 litre bottle of sunflower cooking oil"
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
                  />
                </div>

                <div className="aspect-square w-full max-w-[240px] mx-auto rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {isGenerating ? (
                    <div className="text-center text-gray-500">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto text-violet-600" />
                      <p className="text-xs mt-2">Generating… about 10-20 seconds</p>
                    </div>
                  ) : result ? (
                    <img
                      src={result.dataUrl}
                      alt="AI generated preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <p className="text-xs text-gray-400 px-6 text-center">
                      Your image preview will appear here
                    </p>
                  )}
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                    result
                      ? "bg-gray-100 hover:bg-gray-200 text-gray-800"
                      : "bg-violet-600 hover:bg-violet-700 text-white",
                  )}>
                  {result ? (
                    <RefreshCw className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {result ? "Regenerate" : "Generate"}
                </button>
                {result && (
                  <button
                    type="button"
                    onClick={handleUse}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60">
                    <Check className="w-4 h-4" />
                    Use this image
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default AiImageGenerator;
