import { handleResponse } from "../utils/helper.js";
import { 
  generateStructuredJson, 
  analyzeImageStructuredJson,
  AiServiceError 
} from "../services/ai/geminiService.js";
import Category from "../models/category.js";

const AI_ERROR_STATUS = {
  NOT_CONFIGURED: 503,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  PARSE_ERROR: 500,
  AI_ERROR: 500,
};

const AI_ERROR_MESSAGE = {
  NOT_CONFIGURED: "AI features are temporarily unavailable",
  RATE_LIMITED: "AI is busy right now, please try again in a moment",
  TIMEOUT: "AI generation took too long, please try again",
  UPSTREAM_ERROR: "AI generation took too long, please try again",
  PARSE_ERROR: "Couldn't generate content, please try again or fill manually",
  AI_ERROR: "Couldn't generate content, please try again or fill manually",
};

const LISTING_SYSTEM_INSTRUCTION =
  "You are an ecommerce copywriting assistant for an Indian quick-commerce marketplace. " +
  "Given a product name and optional category/notes, produce SEO-optimized, concise, honest " +
  "listing copy. Never invent specific numeric claims (weight, price, certifications) not " +
  "provided. Output must match the given JSON schema exactly.";

const LISTING_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    description: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["title", "description", "tags"],
  propertyOrdering: ["title", "description", "tags"],
};

function buildListingPrompt({ name, categoryName, notes, existingTags }) {
  return `Product name: ${name}
Category: ${categoryName || "not specified"}
Seller notes/specs: ${notes || "none"}
Existing tags: ${Array.isArray(existingTags) && existingTags.length ? existingTags.join(", ") : "none"}

Generate:
- title: refined, SEO-friendly product title, max 70 characters
- description: 2-4 sentences, highlight benefits/use-case, plain text no markdown, 40-80 words
- tags: 5-8 lowercase single/double-word search keywords, no duplicates, no hashtags`;
}

/**
 * POST /products/ai/generate-listing
 */
export const generateProductListing = async (req, res) => {
  try {
    const { name, categoryName, notes, existingTags } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return handleResponse(res, 400, "Product name is required");
    }

    const result = await generateStructuredJson({
      prompt: buildListingPrompt({
        name: name.trim(),
        categoryName,
        notes,
        existingTags,
      }),
      responseSchema: LISTING_RESPONSE_SCHEMA,
      systemInstruction: LISTING_SYSTEM_INSTRUCTION,
    });

    return handleResponse(res, 200, "Generated", {
      title: result.title,
      description: result.description,
      tags: Array.isArray(result.tags) ? result.tags : [],
    });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return handleResponse(
        res,
        AI_ERROR_STATUS[error.code] || 500,
        AI_ERROR_MESSAGE[error.code] || error.message,
      );
    }
    return handleResponse(res, 500, error.message);
  }
};

const IMAGE_LISTING_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    description: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    brand: { type: "STRING" },
    weightVal: { type: "STRING" },
    weightUnit: { type: "STRING" },
    deliveryType: { type: "STRING" },
    detectedHeaderName: { type: "STRING" },
    detectedCategoryName: { type: "STRING" },
    detectedSubcategoryName: { type: "STRING" },
  },
  required: [
    "title",
    "description",
    "tags",
  ],
};

/**
 * POST /products/ai/generate-listing-from-image
 * Seller uploads a photo of a product, and Gemini Multimodal Vision auto-extracts
 * title, description, tags, brand, weight, and matches store categories.
 */
export const generateListingFromImage = async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body || {};

    if (!imageBase64) {
      return handleResponse(res, 400, "Image data is required");
    }

    const imageBuffer = Buffer.from(imageBase64, "base64");

    // Fetch active categories to give Gemini context for category matching
    const [headers, categories, subcategories] = await Promise.all([
      Category.find({ status: "active", type: "header" }).select("name _id").lean(),
      Category.find({ status: "active", type: "category" }).select("name _id parentId").lean(),
      Category.find({ status: "active", type: "subcategory" }).select("name _id parentId").lean(),
    ]);

    const headerNames = headers.map(h => h.name).join(", ");
    const categoryNames = categories.map(c => c.name).join(", ");
    const subcategoryNames = subcategories.map(s => s.name).join(", ");

    const prompt = `
Analyze this product packaging/photo in detail and extract listing metadata for an Indian quick-commerce marketplace (Seva Fast):

Available Store Main Groups (Headers):
${headerNames || "Groceries, Snacks & Drinks, Personal Care, Fruits & Vegetables, Household"}

Available Store Categories:
${categoryNames || "Atta, Dal & Pulses, Biscuits & Cookies, Chocolates, Soaps & Bodywash, Shampoo"}

Available Store Subcategories:
${subcategoryNames || "Wheat Atta, Plain Biscuits, Body Soaps, Hair Oil"}

Generate:
1. title: Clean, attractive, SEO-friendly product title including brand name and weight/pack-size (max 70 characters).
2. description: 2-3 engaging, honest sentences highlighting key features, ingredients/material, and usage (40-70 words).
3. tags: 6-10 lowercase search keywords for buyer discovery.
4. brand: Detected brand name from the packaging or label.
5. weightVal: Numeric pack weight or volume if visible (e.g., "500", "1", "250").
6. weightUnit: "gm", "kg", "ml", "l", or "pcs".
7. deliveryType: "instant" (for 10-20 min quick delivery) or "scheduled" (for large/heavy/nationwide items).
8. detectedHeaderName: Exact or closest matching Main Group name from the provided list above.
9. detectedCategoryName: Exact or closest matching Category name from the provided list above.
10. detectedSubcategoryName: Exact or closest matching Subcategory name from the provided list above.
`;

    const visionResult = await analyzeImageStructuredJson({
      imageBuffer,
      mimeType,
      prompt,
      responseSchema: IMAGE_LISTING_SCHEMA,
      systemInstruction: "You are an expert product cataloger for Indian quick commerce. Accurately identify the product packaging and brand.",
    });

    // Match returned category names to DB IDs
    let matchedHeaderId = "";
    let matchedCategoryId = "";
    let matchedSubcategoryId = "";

    if (visionResult.detectedHeaderName) {
      const match = headers.find(h => 
        h.name.toLowerCase() === visionResult.detectedHeaderName.toLowerCase() ||
        h.name.toLowerCase().includes(visionResult.detectedHeaderName.toLowerCase()) ||
        visionResult.detectedHeaderName.toLowerCase().includes(h.name.toLowerCase())
      );
      if (match) matchedHeaderId = String(match._id);
    }

    if (visionResult.detectedCategoryName) {
      const match = categories.find(c => 
        c.name.toLowerCase() === visionResult.detectedCategoryName.toLowerCase() ||
        c.name.toLowerCase().includes(visionResult.detectedCategoryName.toLowerCase()) ||
        visionResult.detectedCategoryName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (match) {
        matchedCategoryId = String(match._id);
        if (!matchedHeaderId && match.parentId) {
          matchedHeaderId = String(match.parentId);
        }
      }
    }

    if (visionResult.detectedSubcategoryName) {
      const match = subcategories.find(s => 
        s.name.toLowerCase() === visionResult.detectedSubcategoryName.toLowerCase() ||
        s.name.toLowerCase().includes(visionResult.detectedSubcategoryName.toLowerCase()) ||
        visionResult.detectedSubcategoryName.toLowerCase().includes(s.name.toLowerCase())
      );
      if (match) {
        matchedSubcategoryId = String(match._id);
        if (!matchedCategoryId && match.parentId) {
          matchedCategoryId = String(match.parentId);
        }
      }
    }

    return handleResponse(res, 200, "Image listing generated successfully", {
      title: visionResult.title,
      description: visionResult.description,
      tags: Array.isArray(visionResult.tags) ? visionResult.tags.join(", ") : (visionResult.tags || ""),
      brand: visionResult.brand || "",
      weightVal: visionResult.weightVal || "",
      weightUnit: visionResult.weightUnit || "kg",
      deliveryType: visionResult.deliveryType || "instant",
      header: matchedHeaderId,
      category: matchedCategoryId,
      subcategory: matchedSubcategoryId,
      suggestedHeaderName: visionResult.detectedHeaderName,
      suggestedCategoryName: visionResult.detectedCategoryName,
      suggestedSubcategoryName: visionResult.detectedSubcategoryName,
    });
  } catch (error) {
    console.error("[ProductAI] generateListingFromImage error:", error);
    if (error instanceof AiServiceError) {
      return handleResponse(
        res,
        AI_ERROR_STATUS[error.code] || 500,
        AI_ERROR_MESSAGE[error.code] || error.message,
      );
    }
    return handleResponse(res, 500, error.message || "Failed to analyze image");
  }
};
