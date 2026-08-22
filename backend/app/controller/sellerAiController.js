import { handleResponse } from "../utils/helper.js";
import { generateChatResponse, AiServiceError } from "../services/ai/geminiService.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import Wallet from "../models/wallet.js";
import SellerPlan from "../models/sellerPlan.js";
import Review from "../models/review.js";
import mongoose from "mongoose";

const SELLER_SYSTEM_INSTRUCTION = `
You are "Seva Seller AI", the official smart onboarding and operations assistant for the "Seva Fast" Seller Portal. Your goal is to guide local shop owners, merchants, and sellers through platform features, troubleshoot issues, and answer their business queries in a friendly, highly concise manner.

### App Ecosystem & Seller Domain Knowledge:

1. **Products & Inventory**:
   - Single item listing (\`/seller/products/add\`), Image-to-Listing Auto-Fill (AI extracts details from packaging photos), and Bulk CSV template upload.
   - Low stock alerts (items with stock <= 5) trigger notifications. Sellers must manage inventory via the "Stock" tab.

2. **Order Fulfillment Types**:
   - **Instant Quick-Commerce (10-20 min)**: Admin assigns a Seva Delivery Partner. Seller packs the order and hands it over using a secure **Pickup OTP**.
   - **Scheduled (Nationwide)**: Fulfilled via Shiprocket/Delhivery. Requires exact box dimensions (length/breadth/height) and weight.

3. **Photo Orders (/seller/photo-orders)**:
   - Customers upload a handwritten grocery list or prescription.
   - Sellers can chat with the customer in a dedicated drawer, understand the requested items, and convert the photo request into a real, priced cart order for delivery.

4. **Returns & Exchanges (/seller/returns)**:
   - Customer initiates a return -> Admin approves/rejects -> Admin Rider is assigned.
   - Rider picks up the return with a Drop OTP -> Merchant performs Quality Check (QC).
   - If QC Passes, merchant accepts the return. If QC Fails, return is rejected.

5. **Finances & Earnings**:
   - **Seva Wallet (/seller/earnings)**: All digital sales earnings go here. Sellers can request Withdrawal to their bank account (/seller/withdrawals).
   - **COD Cash (/seller/cod)**: If seller collects COD cash or delivery boys give COD cash to admin, the cash reconciliation happens here.

6. **Promotions & Ads (/seller/promotions)**:
   - Sellers can purchase in-app Carousel Banners and highlighted store positioning using their Wallet balance or UPI to boost sales.

7. **Seller Subscription Plans (/seller/plans)**:
   - Free tier operates on Category Commission (e.g. 5% on groceries, 10% on electronics).
   - Premium Subscription Plans (e.g. Silver, Gold) offer 0% commission and extra onboarding perks.

### Live Seller Tools:
Use your provided tools to fetch live database stats whenever the seller asks about their current business standing:
- **get_seller_overview**: Today's sales, pending orders, and wallet balance.
- **get_low_stock_products**: Products requiring restock (<= 5).
- **get_pending_returns**: Pending return requests.
- **get_seller_active_plan**: Current subscription plan and expiry.

### Formatting & Language Guardrails:
- **Multilingual Support (Hindi, Hinglish, Marathi, Gujarati, English)**: ALWAYS auto-detect the user's language/script and reply fluently in the EXACT same language and script.
- **Professional Formatting**: Use structured Markdown, bold text for emphasis, and concise bullet points. Avoid heavy corporate jargon; speak simply like a local merchant would understand.
- **NO LaTeX or Math Syntax**: NEVER output LaTeX delimiters or math notation like \`$\\le 5$\`, \`$\\ge 5$\`, or \`$x$\`. Always write plain text like \`<= 5\` or \`5 ya usse kam\`.
- **Currency**: Always use the Indian Rupee symbol (₹) for money (e.g. ₹500), NEVER the Dollar sign ($).
- **NEVER show Object IDs or raw database codes.**
- Keep responses short and scannable for mobile screens.
`;

const tools = [
  {
    name: "get_seller_overview",
    description: "Fetch live stats for the seller including today's sales revenue, pending order count, and current wallet balance.",
    parameters: {
      type: "OBJECT",
      properties: {},
    }
  },
  {
    name: "get_low_stock_products",
    description: "Fetch a list of products that are critically low in stock (<= 5 items) or out of stock.",
    parameters: {
      type: "OBJECT",
      properties: {},
    }
  },
  {
    name: "get_pending_returns",
    description: "Fetch a list of pending return requests that need the seller's attention.",
    parameters: {
      type: "OBJECT",
      properties: {},
    }
  },
  {
    name: "get_seller_active_plan",
    description: "Fetch details of the seller's active subscription plan.",
    parameters: {
      type: "OBJECT",
      properties: {},
    }
  }
];

export const handleSellerChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const sellerId = req.user.id;

    if (!message) {
      return handleResponse(res, 400, "Message is required");
    }

    const formattedHistory = history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const fullMessages = [
      ...formattedHistory,
      { role: "user", parts: [{ text: message }] }
    ];

    // Start single turn execution loop
    const result = await generateChatResponse({
      messages: fullMessages,
      systemInstruction: SELLER_SYSTEM_INSTRUCTION,
      tools: tools,
    });

    let finalResponseText = result.text;
    
    // If the model called a tool, execute it and feed the result back
    if (result.toolCall) {
      const functionName = result.toolCall.name;
      const functionArgs = result.toolCall.args;
      let functionResponse = {};

      try {
        switch (functionName) {
          case "get_seller_overview": {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const [orders, wallet] = await Promise.all([
              Order.find({
                sellerId,
                createdAt: { $gte: startOfDay },
              }).select("totalAmount orderStatus").lean(),
              Wallet.findOne({ userId: sellerId, userType: "seller" }).lean(),
            ]);

            const todaySales = orders
              .filter(o => o.orderStatus === "delivered")
              .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
              
            const pendingOrders = orders.filter(o => ["pending", "processing", "ready_for_pickup"].includes(o.orderStatus)).length;

            functionResponse = {
              todaySales: todaySales,
              pendingOrders: pendingOrders,
              walletBalance: wallet ? wallet.balance : 0,
            };
            break;
          }

          case "get_low_stock_products": {
            const lowStockProducts = await Product.find({
              sellerId,
              stock: { $lte: 5 }
            }).select("name stock price").limit(10).lean();
            
            functionResponse = {
              products: lowStockProducts.map(p => ({
                name: p.name,
                stock: p.stock,
                price: p.price
              }))
            };
            break;
          }

          case "get_pending_returns": {
            const pendingReturns = await Order.find({
              sellerId,
              returnStatus: { $in: ["requested", "in_transit", "qc_pending"] }
            }).select("orderId returnReason returnStatus").limit(5).lean();
            
            functionResponse = {
              returns: pendingReturns.map(r => ({
                orderId: r._id,
                reason: r.returnReason,
                status: r.returnStatus
              }))
            };
            break;
          }

          case "get_seller_active_plan": {
            const plan = await SellerPlan.findOne({ sellerId, status: "active" })
              .populate("planId", "name type price")
              .lean();
            
            if (plan) {
              functionResponse = {
                planName: plan.planId?.name || "Premium Plan",
                validUntil: plan.endDate,
                status: plan.status
              };
            } else {
              functionResponse = {
                message: "No active premium plan found. Seller is on default Category Commission plan."
              };
            }
            break;
          }

          default:
            functionResponse = { error: "Unknown tool call" };
        }
      } catch (err) {
        console.error(`Seller Tool Error [${functionName}]:`, err);
        functionResponse = { error: "Failed to execute tool" };
      }

      // Feed tool result back for final conversational response
      const followUpMessages = [
        ...formattedHistory,
        { role: "user", parts: [{ text: message }] },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: functionName,
                args: functionArgs,
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: functionName,
                response: functionResponse,
              },
            },
          ],
        }
      ];

      const followUpResult = await generateChatResponse({
        messages: followUpMessages,
        systemInstruction: SELLER_SYSTEM_INSTRUCTION,
        tools: tools,
      });

      finalResponseText = followUpResult.text;
    }

    return handleResponse(res, 200, "Success", { reply: finalResponseText });
  } catch (error) {
    console.error("[SellerAI] Chat error:", error);
    if (error instanceof AiServiceError) {
      if (error.code === "RATE_LIMITED") {
        return handleResponse(res, 429, "Seva AI is experiencing high demand right now. Please try again in a few moments.");
      }
      if (error.code === "UPSTREAM_ERROR") {
        return handleResponse(res, 503, "Seva AI is currently experiencing high demand. Please try again in a moment.");
      }
    }
    return handleResponse(res, 500, "Couldn't generate response. Please try again in a moment.");
  }
};
