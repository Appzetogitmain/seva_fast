import { handleResponse } from "../utils/helper.js";
import { generateImage, AiServiceError } from "../services/ai/geminiService.js";

const AI_ERROR_STATUS = {
  NOT_CONFIGURED: 503,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  NO_IMAGE: 422,
  AI_ERROR: 500,
};

const AI_ERROR_MESSAGE = {
  NOT_CONFIGURED: "AI features are temporarily unavailable",
  RATE_LIMITED: "AI is busy right now, please try again in a moment",
  TIMEOUT: "Image generation took too long, please try again",
  UPSTREAM_ERROR: "Image generation took too long, please try again",
  NO_IMAGE: "Couldn't create an image for that prompt. Try describing it differently.",
  AI_ERROR: "Couldn't generate the image, please try again or upload one manually",
};

// Matches the panel's own image guidelines: 1:1, subject centered with
// padding so nothing is cut in circular badges / product cards.
const IMAGE_STYLE = {
  category:
    "Create a clean, modern e-commerce CATEGORY thumbnail. A single clear, appealing visual that represents the category, centered with generous padding on every side so it is not cut inside a circular badge. Plain soft light background, bright even lighting, realistic style.",
  product:
    "Create a professional e-commerce PRODUCT photo. One product, centered, fully visible with 10-15% empty margin on every side. Pure white background, soft studio lighting, sharp focus, realistic.",
};

const COMMON_RULES =
  "Square 1:1 composition. Do NOT add any text, captions, watermarks, logos, borders, or price tags to the image.";

// Reference mode: a second photo of the SAME item (for the gallery), so the
// product itself must not be redesigned.
const REFERENCE_STYLE =
  "The attached photo shows a product. Create a NEW professional e-commerce photo of the EXACT same product — keep its design, colours, pattern, material, shape and any branding identical. Only change how it is shown (angle, framing, background or setting) as described below. Product fully visible and centered with some margin, sharp focus, realistic lighting.";
const DEFAULT_REFERENCE_CHANGE = "Show the same product from a different angle on a clean white background.";

const REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
// The panel downsizes the reference before sending; the JSON body limit is 1MB.
const MAX_REFERENCE_BYTES = 700 * 1024;

const MAX_PROMPT_LENGTH = 500;

/**
 * POST /admin/ai/generate-image, POST /seller/ai/generate-image
 * Returns the image as base64 — the panel attaches it to the normal
 * category/product form, so it is only stored when that form is saved.
 */
export const generateCatalogImage = async (req, res) => {
  try {
    const { prompt, target, referenceImageBase64, referenceMimeType } = req.body || {};
    const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const hasReference = typeof referenceImageBase64 === "string" && referenceImageBase64.length > 0;

    if (hasReference) {
      if (!REFERENCE_MIME_TYPES.includes(referenceMimeType)) {
        return handleResponse(res, 400, "Reference image must be a JPG, PNG or WebP");
      }
      if (Buffer.byteLength(referenceImageBase64, "base64") > MAX_REFERENCE_BYTES) {
        return handleResponse(res, 413, "Reference image is too large");
      }
    } else if (cleanPrompt.length < 3) {
      return handleResponse(res, 400, "Please describe the image you want");
    }
    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
      return handleResponse(res, 400, `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`);
    }

    const style = IMAGE_STYLE[target] || IMAGE_STYLE.product;

    const image = await generateImage(
      hasReference
        ? {
            prompt: `${REFERENCE_STYLE} ${COMMON_RULES}\n\nWhat to change: ${cleanPrompt || DEFAULT_REFERENCE_CHANGE}`,
            referenceImage: { data: referenceImageBase64, mimeType: referenceMimeType },
          }
        : { prompt: `${style} ${COMMON_RULES}\n\nSubject: ${cleanPrompt}` },
    );

    return handleResponse(res, 200, "Image generated", {
      imageBase64: image.data,
      mimeType: image.mimeType,
    });
  } catch (error) {
    console.error("[ImageAI] generateCatalogImage error:", error?.message, error?.code);
    if (error instanceof AiServiceError) {
      return handleResponse(
        res,
        AI_ERROR_STATUS[error.code] || 500,
        AI_ERROR_MESSAGE[error.code] || AI_ERROR_MESSAGE.AI_ERROR,
      );
    }
    return handleResponse(res, 500, AI_ERROR_MESSAGE.AI_ERROR);
  }
};
