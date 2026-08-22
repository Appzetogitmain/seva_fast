import { handleResponse } from "../utils/helper.js";
import { generateStructuredJson, AiServiceError } from "../services/ai/geminiService.js";
import Review from "../models/review.js";
import Order from "../models/order.js";
import Product from "../models/product.js";

const SENTIMENT_SYSTEM_INSTRUCTION = `
You are an expert E-commerce Analytics & Customer Sentiment AI Specialist for "Seva Fast" - an Indian quick-commerce & hyper-local retail platform.
Your task is to analyze real customer reviews and return reasons to give the seller a concise, highly actionable Sentiment & Return Reduction Report.

Focus on:
1. Identifying the core drivers of returns & low ratings (e.g. sizing discrepancies, broken seals, packaging transit damage, quality mismatch, incorrect item).
2. Estimating the customer complaint percentage impact.
3. Identifying positive highlights (what customers loved).
4. Providing specific, practical, high-ROI actionable recommendations to reduce return rates and boost repeat orders.

Output must strictly match the given JSON schema.
`;

const SENTIMENT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    productName: { type: "STRING" },
    summary: { type: "STRING" },
    returnRiskLevel: { type: "STRING", enum: ["Low", "Medium", "High"] },
    sentimentScore: {
      type: "OBJECT",
      properties: {
        positivePercent: { type: "NUMBER" },
        neutralPercent: { type: "NUMBER" },
        negativePercent: { type: "NUMBER" },
      },
      required: ["positivePercent", "neutralPercent", "negativePercent"],
    },
    topComplaints: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          issue: { type: "STRING" },
          percentage: { type: "STRING" },
          severity: { type: "STRING", enum: ["High", "Medium", "Low"] },
          sampleQuote: { type: "STRING" },
        },
        required: ["issue", "percentage", "severity", "sampleQuote"],
      },
    },
    highlights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          feature: { type: "STRING" },
          praise: { type: "STRING" },
          sentiment: { type: "STRING" },
        },
        required: ["feature", "praise"],
      },
    },
    actionableAdvice: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          impact: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["title", "impact", "description"],
      },
    },
  },
  required: [
    "productName",
    "summary",
    "returnRiskLevel",
    "sentimentScore",
    "topComplaints",
    "highlights",
    "actionableAdvice",
  ],
};

/**
 * GET /api/seller/ai/sentiment-intelligence
 * Query params:
 * - productId (optional): Target specific product. If omitted, analyzes overall seller catalog returns/reviews.
 */
export const getSentimentIntelligence = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    const { productId } = req.query;

    let targetProduct = null;
    let reviews = [];
    let returns = [];

    if (productId) {
      targetProduct = await Product.findOne({ _id: productId, seller: sellerId })
        .select("name price salePrice category description")
        .populate("category", "name")
        .lean();

      if (!targetProduct) {
        return handleResponse(res, 404, "Product not found or access denied");
      }

      // Fetch reviews for this specific product
      reviews = await Review.find({ productId })
        .select("rating comment createdAt status")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Fetch return orders containing this product
      returns = await Order.find({
        seller: sellerId,
        "items.product": productId,
        returnStatus: { $exists: true, $nin: ["none", null] },
      })
        .select("returnReason returnCustomerComment returnStatus createdAt items")
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
    } else {
      // Analyze entire seller store
      const sellerProducts = await Product.find({ seller: sellerId })
        .select("_id name")
        .limit(100)
        .lean();
      
      const productIds = sellerProducts.map((p) => p._id);

      reviews = await Review.find({ productId: { $in: productIds } })
        .select("rating comment createdAt productId")
        .populate("productId", "name")
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();

      returns = await Order.find({
        seller: sellerId,
        returnStatus: { $exists: true, $nin: ["none", null] },
      })
        .select("returnReason returnCustomerComment returnStatus createdAt items")
        .populate("items.product", "name")
        .sort({ createdAt: -1 })
        .limit(40)
        .lean();
    }

    // Build raw text digest for Gemini
    const reviewTexts = reviews.map((r, i) => {
      const prodName = r.productId?.name || targetProduct?.name || "Product";
      return `[Review ${i + 1}] (${r.rating}★) "${r.comment}" on ${prodName}`;
    });

    const returnTexts = returns.map((ret, i) => {
      const reason = ret.returnReason || "General return";
      const comment = ret.returnCustomerComment || "No comment provided";
      return `[Return ${i + 1}] Reason: "${reason}" | Customer Note: "${comment}" (Status: ${ret.returnStatus})`;
    });

    const productNameHeader = targetProduct ? targetProduct.name : "All Store Products / Catalog Overview";
    const totalReviewsCount = reviews.length;
    const totalReturnsCount = returns.length;
    const avgRating = totalReviewsCount > 0
      ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / totalReviewsCount).toFixed(1)
      : "N/A";

    const prompt = `
Analyze the following e-commerce product feedback & return data:

Product/Store Target: ${productNameHeader}
Total Reviews Count: ${totalReviewsCount} (Average Star Rating: ${avgRating})
Total Return Requests: ${totalReturnsCount}

Customer Reviews:
${reviewTexts.length > 0 ? reviewTexts.join("\n") : "No text reviews available yet. Please generate industry benchmark predictive quality analysis for Indian quick-commerce."}

Return Order Feedback & Reasons:
${returnTexts.length > 0 ? returnTexts.join("\n") : "No return complaints registered yet. Generate proactive quality assurance recommendations."}

Instructions:
1. Synthesize concise executive summary.
2. Group and rank Top Complaints with percentage impact and real/representative quotes.
3. Group top Highlights that customers praised.
4. Give high-impact Actionable Advice to minimize returns and improve buyer satisfaction.
`;

    const aiResult = await generateStructuredJson({
      prompt,
      systemInstruction: SENTIMENT_SYSTEM_INSTRUCTION,
      responseSchema: SENTIMENT_RESPONSE_SCHEMA,
    });

    return handleResponse(res, 200, "Sentiment intelligence analysis generated successfully", {
      product: targetProduct ? { id: targetProduct._id, name: targetProduct.name } : null,
      stats: {
        totalReviews: totalReviewsCount,
        totalReturns: totalReturnsCount,
        averageRating: avgRating,
      },
      intelligence: aiResult,
    });
  } catch (error) {
    console.error("[ReviewAI] Error generating sentiment intelligence:", error?.message);
    if (error instanceof AiServiceError) {
      return handleResponse(res, 500, error.message);
    }
    return handleResponse(res, 500, "Failed to generate sentiment analysis. Please try again.");
  }
};
