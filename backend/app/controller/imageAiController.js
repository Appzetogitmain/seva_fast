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

const MAX_PROMPT_LENGTH = 500;

/**
 * POST /admin/ai/generate-image, POST /seller/ai/generate-image
 * Returns the image as base64 — the panel attaches it to the normal
 * category/product form, so it is only stored when that form is saved.
 */
export const generateCatalogImage = async (req, res) => {
  try {
    const { prompt, target } = req.body || {};
    const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";

    if (cleanPrompt.length < 3) {
      return handleResponse(res, 400, "Please describe the image you want");
    }
    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
      return handleResponse(res, 400, `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`);
    }

    const style = IMAGE_STYLE[target] || IMAGE_STYLE.product;

    const image = await generateImage({
      prompt: `${style} ${COMMON_RULES}\n\nSubject: ${cleanPrompt}`,
    });

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
