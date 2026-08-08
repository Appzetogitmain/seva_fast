import Review from "../models/review.js";
import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";

// Check if a user can review a product (has purchased + delivered, not already reviewed for that order)
export const canReviewProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const { orderId } = req.query;
        const userId = req.user.id;

        const purchaseQuery = {
            customer: userId,
            "items.product": productId,
            status: "delivered",
        };
        if (orderId) purchaseQuery._id = orderId;

        const deliveredOrders = await Order.find(purchaseQuery).select("_id").lean();
        if (deliveredOrders.length === 0) {
            return handleResponse(res, 200, "Cannot review", { canReview: false, reason: "not_purchased" });
        }

        // A user can review a product again each time they buy it in a new order —
        // only block when every delivered order for this product already has a review.
        const reviewedOrderIds = new Set(
            (
                await Review.find({
                    userId,
                    productId,
                    orderId: { $in: deliveredOrders.map((o) => o._id) },
                })
                    .select("orderId")
                    .lean()
            ).map((r) => String(r.orderId))
        );

        const hasEligibleOrder = deliveredOrders.some((o) => !reviewedOrderIds.has(String(o._id)));
        if (!hasEligibleOrder) {
            return handleResponse(res, 200, "Already reviewed", { canReview: false, reason: "already_reviewed" });
        }

        return handleResponse(res, 200, "Can review", { canReview: true });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Submit a review (Customer)
export const submitReview = async (req, res) => {
    try {
        const { productId, orderId, rating, comment, images, video } = req.body;
        const userId = req.user.id;

        let targetOrder;

        if (orderId) {
            // Caller specified exactly which order this review is for (e.g. from the order detail page)
            targetOrder = await Order.findOne({
                _id: orderId,
                customer: userId,
                "items.product": productId,
                status: "delivered",
            });

            if (!targetOrder) {
                return handleResponse(res, 403, "You can only rate products you have purchased and received.");
            }

            const existingReview = await Review.findOne({ userId, productId, orderId: targetOrder._id });
            if (existingReview) {
                return handleResponse(res, 400, "You have already reviewed this product for this order");
            }
        } else {
            // No specific order given — pick any delivered order for this product that hasn't been reviewed yet
            const deliveredOrders = await Order.find({
                customer: userId,
                "items.product": productId,
                status: "delivered",
            }).select("_id");

            if (deliveredOrders.length === 0) {
                return handleResponse(res, 403, "You can only rate products you have purchased and received.");
            }

            const reviewedOrderIds = new Set(
                (
                    await Review.find({
                        userId,
                        productId,
                        orderId: { $in: deliveredOrders.map((o) => o._id) },
                    })
                        .select("orderId")
                        .lean()
                ).map((r) => String(r.orderId))
            );

            targetOrder = deliveredOrders.find((o) => !reviewedOrderIds.has(String(o._id)));
            if (!targetOrder) {
                return handleResponse(res, 400, "You have already reviewed this product");
            }
        }

        const newReview = new Review({
            userId,
            productId,
            orderId: targetOrder._id,
            rating,
            comment,
            images: images || [],
            video: video || null,
            status: "pending",
        });

        await newReview.save();
        return handleResponse(res, 201, "Review submitted successfully", newReview);
    } catch (error) {
        if (error.code === 11000) {
            return handleResponse(res, 400, "You have already reviewed this product for this order");
        }
        return handleResponse(res, 500, error.message);
    }
};

// Get current customer's reviews for a specific order's products
export const getMyReviewsForOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        // Fetch the order to get product IDs
        const order = await Order.findOne({
            $or: [
                { _id: orderId.length === 24 ? orderId : null },
                { orderId: orderId }
            ],
            customer: userId,
        }).select("items").lean();

        if (!order) {
            return handleResponse(res, 404, "Order not found");
        }

        const productIds = order.items.map(i => i.product);

        // Scoped to this order — the same product bought again in a different order
        // should not be marked "reviewed" just because an earlier order was.
        const reviews = await Review.find({
            userId,
            productId: { $in: productIds },
            orderId: order._id,
        }).lean();

        // Return as a map: productId -> review
        const reviewMap = {};
        for (const review of reviews) {
            reviewMap[String(review.productId)] = review;
        }

        return handleResponse(res, 200, "Reviews fetched", reviewMap);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};


// Get approved reviews for a product (Public)
export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId, status: "approved" })
            .populate("userId", "name image")
            .sort({ createdAt: -1 });

        return handleResponse(res, 200, "Reviews fetched successfully", reviews);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Get all pending reviews
export const getPendingReviews = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req, { defaultLimit: 25, maxLimit: 200 });

        const allowedStatuses = ["pending", "approved", "rejected"];
        const rawStatus = String(req.query.status || "pending").toLowerCase();
        const statusFilter = allowedStatuses.includes(rawStatus) ? rawStatus : "pending";

        const query = { status: statusFilter };

        const [reviews, total] = await Promise.all([
            Review.find(query)
                .populate("userId", "name email phone")
                .populate("productId", "name images mainImage price seller")
                .populate({
                    path: "orderId",
                    select: "orderId createdAt pricing items seller",
                    populate: {
                        path: "seller",
                        select: "name phone shopName"
                    }
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Review.countDocuments(query)
        ]);

        return handleResponse(res, 200, "Pending reviews fetched successfully", {
            items: reviews,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Update review status (Approve/Reject)
export const updateReviewStatus = async (req, res) => {
    try {
        const { status } = req.body; // approved or rejected
        const { id } = req.params;

        const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
        if (!review) return handleResponse(res, 404, "Review not found");

        return handleResponse(res, 200, `Review ${status} successfully`, review);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
