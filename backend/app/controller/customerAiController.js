import { handleResponse } from "../utils/helper.js";
import { generateChatResponse, analyzeImageForSearch, AiServiceError } from "../services/ai/geminiService.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import Coupon from "../models/coupon.js";
import FAQ from "../models/faq.js";
import Category from "../models/category.js";
import Plan from "../models/plan.js";
import Review from "../models/review.js";

const CUSTOMER_SYSTEM_INSTRUCTION = `
You are "Seva AI", the official smart and multilingual (Marathi, Gujarati, Hindi, Hinglish, Bengali, Tamil, Telugu, Kannada, English) assistant for "Seva Fast" - India's premier hyper-local quick-commerce, home services & community referral platform.

### App Ecosystem & Core Business Logic:

1. **Quick-Commerce Delivery (10-20 mins)**:
   - Superfast doorstep delivery for Groceries, Fruits & Vegetables, Snacks, Dairy, Personal Care, and Household items.
   - Live order tracking with verified Delivery Partners.

2. **Top-Rated & Best Selling Products (Live Catalog)**:
   - When user asks for items in Hindi, Marathi, Gujarati, or spoken transliteration, ALWAYS map/translate them to standard English store keywords for \`search_products\` (e.g. 'साबुन' / 'शोप' -> 'soap', 'केला' -> 'banana', 'तेल' -> 'oil', 'दूध' -> 'milk', 'चावल' / 'तांदूळ' -> 'rice', 'जूते' -> 'shoes', 'शाम्पू' -> 'shampoo').
   - If user asks for best/highest rating, use \`search_products\` with \`sort_by: "rating"\`.

3. **MLM, Referral Network & Earning Program**:
   - **Referral Code**: Every customer has a unique Referral Code in their profile to invite friends and family.
   - **Multi-Level Commission (MLM Tree)**: Users earn rewards not only when their direct referrals order, but across multiple referral tiers/levels (as defined in their active subscription plan).
   - **Earnings & Wallet**: Referral rewards and cashbacks are directly credited to the user's "Seva Wallet", which can be used for future grocery orders or service bookings.
   - **Monthly Referral Targets**: Members who achieve monthly referral goals unlock special Target Rewards and Turnover/Order commission bonuses.

4. **Subscription Plans & Membership**:
   - Customers can upgrade to Premium Plans (e.g. Silver, Gold) in the Plans section.
   - **Plan Benefits**: 100% Free Delivery, Zero Handling Fees, Extra Cashback % on every order, Multi-Level Referral Commissions, and Vendor Onboarding privileges.
   - Use the \`get_subscription_plans\` tool to fetch current live plan prices and features.

5. **Home & Professional Services**:
   - On-demand booking of verified local professionals: Electricians, Plumbers, Appliance Repair, Home Cleaning, and more.

6. **Custom Photo Orders**:
   - Customers can upload a photo of a handwritten grocery list, prescription, or product note, and nearby local merchants fulfill and deliver it.

7. **Welcome Offers & Coupons**:
   - New users get a "Welcome Scratch Card" on their first order with guaranteed discounts and free delivery.
   - Active promo codes can be retrieved via the \`get_active_coupons\` tool.

8. **Payment & Return Policy**:
   - Payments: UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Netbanking, Seva Wallet, and COD where available.
   - Returns: Smooth return/replacement policy with secure OTP verification during delivery partner pickup.

### Guidelines for Response Formatting (Google Gemini Style):
- **Multilingual Support (Marathi, Gujarati, Hindi, English, etc.)**: Always detect the customer's language (e.g. Marathi, Gujarati, Hindi, Hinglish, English) and respond fluently in that exact same language and script.
- **Professional Formatting**: Format text cleanly like Google Gemini. Use structured bold section headers, concise bullet points, and neat line breaks.
- **Never Show Product IDs**: NEVER mention product IDs, database IDs, or hexadecimal codes in your text response. Only mention the product name and price. Clickable product cards are already rendered in the UI automatically.
- **Minimal Emojis**: Use very minimal, professional emojis only when helpful (e.g. 1-2 per message max). Avoid decorative or flashy emoji spam.
- **Clarity**: Keep sentences direct, factual, and easy to read on mobile screens.
- **Product & Rating Queries**: State product details clearly with bold names and clean price/rating figures.
- **Strict Guardrail**: Always use tools for dynamic data. Never fabricate non-existent ratings, plan fees, coupon codes, or fake tracking details.
`;

const tools = [
  {
    name: "search_products",
    description: "Search for products from the live Seva Fast catalog. ALWAYS pass English product keywords in the query parameter (e.g. if user asks for 'साबुन' or 'शोप', pass 'soap'; if 'केला', pass 'banana').",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { 
          type: "STRING", 
          description: "English product search keyword (e.g., 'soap', 'milk', 'shoes', 'oil', 'rice', 'biscuit', 'shampoo')." 
        },
        max_budget: { type: "NUMBER", description: "Maximum price budget in INR (e.g., 500)." },
        category: { type: "STRING", description: "Category name to filter by." },
        sort_by: { 
          type: "STRING", 
          description: "Sort criteria: 'rating' (for highest customer ratings), 'price_asc' (low to high), 'price_desc' (high to low)." 
        },
      },
    },
  },
  {
    name: "get_order_status",
    description: "Fetch live real-time status, tracking info, items, and total amount of a customer's order.",
    parameters: {
      type: "OBJECT",
      properties: {
        order_id: { type: "STRING", description: "The unique order ID (e.g. 'SF1234' or MongoDB ObjectId)." },
      },
      required: ["order_id"],
    },
  },
  {
    name: "get_subscription_plans",
    description: "Retrieve all active Seva Fast subscription plans, prices, validity, and membership benefits (Free delivery, referral rewards, MLM level commissions).",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_active_coupons",
    description: "Retrieve all currently active promo codes, discount percentages, and minimum order criteria on Seva Fast.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_faqs",
    description: "Search help topics and frequently asked questions regarding returns, delivery times, payments, referrals, and support.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Search term like 'referral', 'refund', 'delivery time', 'plan', etc." },
      },
    },
  },
  {
    name: "get_categories",
    description: "List the popular product and service categories available on Seva Fast.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
];

export const handleChat = async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return handleResponse(res, 400, "Messages array is required");
    }

    let attachedProducts = [];

    let response = await generateChatResponse({
      messages,
      systemInstruction: CUSTOMER_SYSTEM_INSTRUCTION,
      tools,
    });

    const functionCalls = response.functionCalls || [];
    
    if (functionCalls.length > 0) {
      const toolCall = functionCalls[0];
      let toolResult = {};

      try {
        if (toolCall.name === "search_products") {
          const { query = "", max_budget, sort_by } = toolCall.args || {};
          let dbQuery = { status: "active" };
          
          if (query && query.trim()) {
            const cleanQ = query.trim();
            dbQuery.$or = [
              { name: { $regex: cleanQ, $options: "i" } },
              { tags: { $regex: cleanQ, $options: "i" } },
              { description: { $regex: cleanQ, $options: "i" } }
            ];
          }

          if (max_budget && Number(max_budget) > 0) {
            const num = Number(max_budget);
            const budgetFilter = {
              $or: [
                { salePrice: { $lte: num, $gt: 0 } },
                { price: { $lte: num } },
                { "variants.price": { $lte: num } },
                { "variants.salePrice": { $lte: num, $gt: 0 } }
              ]
            };
            
            if (dbQuery.$or) {
              dbQuery = { $and: [ { $or: dbQuery.$or }, budgetFilter ] };
            } else {
              dbQuery = { ...dbQuery, ...budgetFilter };
            }
          }
          
          let sortOption = { createdAt: -1 };
          if (sort_by === "price_asc") sortOption = { salePrice: 1, price: 1 };
          if (sort_by === "price_desc") sortOption = { price: -1, salePrice: -1 };

          const products = await Product.find(dbQuery)
            .sort(sortOption)
            .limit(10)
            .select("name price salePrice mainImage thumbnail galleryImages _id unit variants")
            .lean();

          if (products.length > 0) {
            // Aggregate live customer ratings from Review collection
            const productIds = products.map(p => p._id);
            const reviewStats = await Review.aggregate([
              { $match: { productId: { $in: productIds } } },
              { $group: { _id: "$productId", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
            ]);

            const statsMap = {};
            reviewStats.forEach(r => {
              statsMap[String(r._id)] = {
                rating: Number(r.avgRating.toFixed(1)),
                totalReviews: r.count
              };
            });

            let enriched = products.map(p => {
              const v = p.variants?.[0];
              const effectivePrice = Number(p.salePrice) > 0
                ? Number(p.salePrice)
                : (v && Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(p.price || v?.price || 0));
              
              const originalMrp = Number(p.price || v?.price || effectivePrice);
              const img = p.mainImage || p.thumbnail || p.galleryImages?.[0] || "";

              return {
                id: p._id,
                name: p.name,
                price: effectivePrice,
                mrp: originalMrp > effectivePrice ? originalMrp : null,
                thumbnail: img,
                rating: statsMap[String(p._id)]?.rating || null,
                reviewsCount: statsMap[String(p._id)]?.totalReviews || 0
              };
            });

            if (sort_by === "rating") {
              enriched.sort((a, b) => {
                const rA = typeof a.rating === 'number' ? a.rating : 0;
                const rB = typeof b.rating === 'number' ? b.rating : 0;
                return rB - rA;
              });
            }

            attachedProducts = enriched.slice(0, 6);
            toolResult = {
              products: attachedProducts.map(p => ({
                name: p.name,
                price: `₹${p.price}`,
                mrp: p.mrp ? `₹${p.mrp}` : undefined,
                rating: p.rating ? `${p.rating} / 5` : undefined,
                reviewsCount: p.reviewsCount || 0
              }))
            };
          } else {
            toolResult = { products: "No matching products found in store right now." };
          }
        } 
        else if (toolCall.name === "get_order_status") {
          const { order_id } = toolCall.args || {};
          const cleanId = String(order_id || "").trim();
          let order = null;
          
          if (cleanId) {
            order = await Order.findOne({
              $or: [
                { orderId: cleanId.toUpperCase() },
                { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
              ].filter(Boolean)
            })
            .select("orderId orderStatus totalAmount paymentStatus createdAt items")
            .lean();
          }

          if (order) {
            toolResult = {
              orderId: order.orderId,
              status: order.orderStatus,
              totalAmount: order.totalAmount,
              paymentStatus: order.paymentStatus,
              itemCount: order.items?.length || 0,
              createdAt: order.createdAt
            };
          } else {
            toolResult = { error: `Order #${cleanId} not found. Please verify the Order ID.` };
          }
        }
        else if (toolCall.name === "get_subscription_plans") {
          const plans = await Plan.find({ isActive: true })
            .sort({ sortOrder: 1, price: 1 })
            .select("name price originalPrice description features validityDays")
            .lean();
          toolResult = {
            plans: plans.map(p => ({
              name: p.name,
              price: p.price,
              originalPrice: p.originalPrice,
              description: p.description,
              validityDays: p.validityDays,
              features: p.features?.map(f => `${f.label}: ${f.value}${f.unit !== 'Boolean' ? f.unit : ''}`)
            }))
          };
        }
        else if (toolCall.name === "get_active_coupons") {
          const now = new Date();
          const coupons = await Coupon.find({
            status: "active",
            $or: [
              { expiryDate: { $gte: now } },
              { expiryDate: null },
              { isNeverExpire: true }
            ]
          })
          .limit(5)
          .select("code title description discountType discountValue minOrderAmount")
          .lean();
          toolResult = { coupons: coupons.length > 0 ? coupons : "No active coupons at this moment." };
        }
        else if (toolCall.name === "get_faqs") {
          const { query = "" } = toolCall.args || {};
          const faqQuery = { status: "published" };
          if (query && query.trim()) {
            faqQuery.$or = [
              { question: { $regex: query.trim(), $options: "i" } },
              { answer: { $regex: query.trim(), $options: "i" } }
            ];
          }
          const faqs = await FAQ.find(faqQuery).limit(4).select("question answer category").lean();
          toolResult = { faqs: faqs.length > 0 ? faqs : "No specific FAQ found for this query." };
        }
        else if (toolCall.name === "get_categories") {
          const categories = await Category.find({ status: "active" })
            .limit(10)
            .select("name image")
            .lean();
          toolResult = { categories: categories.map(c => c.name) };
        }
      } catch (toolErr) {
        console.error("[CustomerAI] Tool execution error:", toolErr);
        toolResult = { error: "Failed to fetch live data from database." };
      }

      // Preserve candidate content including thought signatures for model turn
      if (response.candidates?.[0]?.content) {
        messages.push(response.candidates[0].content);
      } else {
        messages.push({
          role: "model",
          parts: [{ functionCall: toolCall }],
        });
      }

      // Send tool execution output back to Gemini
      messages.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: toolCall.name,
            response: toolResult
          }
        }]
      });

      // Try to get model's natural conversational response
      try {
        const secondResponse = await generateChatResponse({
          messages,
          systemInstruction: CUSTOMER_SYSTEM_INSTRUCTION,
        });

        if (secondResponse?.text) {
          response = secondResponse;
        } else if (secondResponse?.candidates?.[0]?.content?.parts) {
          const textParts = secondResponse.candidates[0].content.parts
            .filter(p => p.text && !p.thought)
            .map(p => p.text);
          if (textParts.length > 0) {
            response = { text: textParts.join("\n") };
          }
        }
      } catch (secondErr) {
        console.warn("[CustomerAI] Second LLM call skipped/rate-limited, generating direct response:", secondErr.message);
      }
    }

    let replyText = response.text;
    if (!replyText && response.candidates?.[0]?.content?.parts) {
      const textParts = response.candidates[0].content.parts
        .filter(p => p.text && !p.thought)
        .map(p => p.text);
      if (textParts.length > 0) {
        replyText = textParts.join("\n");
      }
    }

    if (!replyText) {
      if (attachedProducts.length > 0) {
        replyText = "Here are the matching products from our store:";
      } else {
        replyText = "I found what you were looking for:";
      }
    }

    return handleResponse(res, 200, "Success", { reply: replyText, messages, products: attachedProducts });
  } catch (error) {
    console.error("[CustomerAI] handleChat error:", error?.message, error?.code);
    if (error instanceof AiServiceError) {
      if (error.code === "RATE_LIMITED") {
        return handleResponse(res, 429, "Seva AI is busy right now. Please try again in a moment.");
      }
      if (error.code === "UPSTREAM_ERROR") {
        return handleResponse(res, 503, "Seva AI is currently experiencing high demand. Please try again in a moment.");
      }
      return handleResponse(res, 500, error.message);
    }
    return handleResponse(res, 500, error.message);
  }
};

export const handleVisualSearch = async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    
    if (!imageBase64 || !mimeType) {
      return handleResponse(res, 400, "imageBase64 and mimeType are required in the request body");
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const prompt = "Describe this image in a few short keywords (max 3-4 words) that would be useful for searching an e-commerce store (e.g. 'red sports shoes', 'cotton blue shirt', 'fresh apples'). Only return the keywords.";

    const keywords = await analyzeImageForSearch({
      imageBuffer,
      mimeType,
      prompt,
    });

    const products = await Product.find({
      name: { $regex: keywords.trim().replace(/\s+/g, '|'), $options: "i" },
      status: "active",
    }).limit(10).select("name price salePrice mainImage thumbnail _id");

    return handleResponse(res, 200, "Visual search successful", {
      keywords: keywords.trim(),
      products,
    });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return handleResponse(res, 500, error.message);
    }
    return handleResponse(res, 500, error.message);
  }
};
