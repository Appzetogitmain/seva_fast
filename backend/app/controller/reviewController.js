import Review from "../models/review.js";
import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";

// Check if a user can review a product (has purchased + delivered, not already reviewed)
export const canReviewProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.id;

        const hasPurchased = await Order.findOne({
            customer: userId,
            "items.product": productId,
            status: "delivered"
        });

        if (!hasPurchased) {
            return handleResponse(res, 200, "Cannot review", { canReview: false, reason: "not_purchased" });
        }

        const alreadyReviewed = await Review.findOne({ userId, productId });
        if (alreadyReviewed) {
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
        const { productId, rating, comment } = req.body;
        const userId = req.user.id;

        // Check if user has purchased the product
        const hasPurchased = await Order.findOne({ 
            customer: userId, 
            "items.product": productId, 
            status: "delivered" 
        });

        if (!hasPurchased) {
            return handleResponse(res, 403, "You can only rate products you have purchased and received.");
        }

        // Check if user already reviewed this product
        const existingReview = await Review.findOne({ userId, productId });
        if (existingReview) {
            return handleResponse(res, 400, "You have already reviewed this product");
        }

        const newReview = new Review({
            userId,
            productId,
            rating,
            comment,
            status: "approved", // Automatically approve so they are visible
        });

        await newReview.save();
        return handleResponse(res, 201, "Review submitted successfully", newReview);
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

        const query = { status: "pending" };

        const [reviews, total] = await Promise.all([
            Review.find(query)
                .populate("userId", "name email")
                .populate("productId", "name images")
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
