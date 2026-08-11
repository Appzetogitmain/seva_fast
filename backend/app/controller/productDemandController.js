import mongoose from "mongoose";
import ProductDemand from "../models/productDemand.js";
import handleResponse from "../utils/helper.js";
import Product from "../models/product.js";
import logger from "../services/logger.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";

// Customer: Register a demand for an out of stock product
export const registerDemand = async (req, res) => {
    try {
        const { productId, variantSku, location, coordinates } = req.body;
        const customerId = req.user.id;

        if (!productId) {
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }

        const product = await Product.findById(productId).select("sellerId stock variants name");
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Check stock
        let isOutOfStock = false;
        if (variantSku && product.variants && product.variants.length > 0) {
            const variant = product.variants.find(v => v.sku === variantSku);
            if (variant && variant.stock <= 0) {
                isOutOfStock = true;
            }
        } else {
            if (product.stock <= 0) {
                isOutOfStock = true;
            }
        }

        if (!isOutOfStock) {
            return res.status(400).json({ success: false, message: "Product is currently in stock. You can add it to cart." });
        }

        // Check if already demanded
        const existingDemand = await ProductDemand.findOne({
            product: productId,
            customer: customerId,
            variantSku: variantSku || null,
            status: "pending"
        });

        if (existingDemand) {
            return res.status(400).json({ success: false, message: "You have already registered demand for this product. We will notify you." });
        }

        // Upsert rather than create: a customer may have an older demand doc
        // from a previous out-of-stock cycle (status "notified"/"restocked")
        // for this exact product+variant. The unique index only guards
        // against duplicate *pending* rows, so re-subscribing must reuse
        // that row instead of inserting a fresh one.
        const demand = await ProductDemand.findOneAndUpdate(
            {
                product: productId,
                customer: customerId,
                variantSku: variantSku || null,
            },
            {
                $set: {
                    seller: product.sellerId,
                    location: location || "",
                    coordinates: coordinates || {},
                    status: "pending",
                    notifiedAt: null,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        emitNotificationEvent(NOTIFICATION_EVENTS.PRODUCT_DEMAND_REGISTERED, {
            sellerId: String(product.sellerId),
            productId: String(product._id),
            productName: product.name,
            variantSku: variantSku || "",
        });

        res.status(201).json({
            success: true,
            message: "We will notify you when this product is back in stock.",
            demand
        });
    } catch (error) {
        logger.error("Error in registerDemand:", error);
        res.status(500).json({ success: false, message: "Failed to register demand" });
    }
};

// Seller: Get demands for their out of stock products
export const getSellerDemands = async (req, res) => {
    try {
        const sellerId = req.user.id;

        // Group demands by product and variant
        const demands = await ProductDemand.aggregate([
            { $match: { seller: new mongoose.Types.ObjectId(sellerId), status: "pending" } },
            {
                $group: {
                    _id: { product: "$product", variantSku: "$variantSku" },
                    demandCount: { $sum: 1 },
                    locations: { $push: "$location" },
                    latestRequestAt: { $max: "$createdAt" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $project: {
                    _id: 0,
                    productId: "$_id.product",
                    variantSku: "$_id.variantSku",
                    productName: "$productDetails.name",
                    productImage: "$productDetails.mainImage",
                    currentStock: "$productDetails.stock",
                    demandCount: 1,
                    latestRequestAt: 1,
                    // Get top 3 locations
                    topLocations: {
                        $slice: [
                            {
                                $setUnion: ["$locations"]
                            },
                            3
                        ]
                    }
                }
            },
            { $sort: { demandCount: -1 } }
        ]);

        res.status(200).json({ success: true, demands });
    } catch (error) {
        logger.error("Error in getSellerDemands:", error);
        res.status(500).json({ success: false, message: "Failed to fetch demands" });
    }
};
