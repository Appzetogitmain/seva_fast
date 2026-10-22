import mongoose from "mongoose";
import ProfessionalReview from "../models/professionalReview.js";
import ProfessionalAd from "../models/professionalAd.js";
import AdInteractionLog from "../models/adInteractionLog.js";
import handleResponse from "../utils/helper.js";

/**
 * Get all approved reviews and rating breakdown for a service provider
 */
export const getProviderReviews = async (req, res) => {
    try {
        const { providerId } = req.params;
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "20", 10)));
        const skip = (page - 1) * limit;

        if (!mongoose.Types.ObjectId.isValid(providerId)) {
            return handleResponse(res, 400, "Invalid provider ID");
        }

        const provider = await ProfessionalAd.findById(providerId).select("name rating ratingCount").lean();
        if (!provider) {
            return handleResponse(res, 404, "Professional profile listing not found");
        }

        const [reviews, totalCount, distribution] = await Promise.all([
            ProfessionalReview.find({
                providerId,
                status: "approved",
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProfessionalReview.countDocuments({ providerId, status: "approved" }),
            ProfessionalReview.aggregate([
                { $match: { providerId: new mongoose.Types.ObjectId(providerId), status: "approved" } },
                { $group: { _id: "$rating", count: { $sum: 1 } } },
            ]),
        ]);

        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        distribution.forEach(d => {
            if (breakdown[d._id] !== undefined) {
                breakdown[d._id] = d.count;
            }
        });

        return handleResponse(res, 200, "Reviews fetched successfully", {
            reviews,
            totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit) || 1,
            averageRating: provider.ratingCount > 0 ? Number(provider.rating.toFixed(1)) : 5.0,
            ratingCount: provider.ratingCount || 0,
            breakdown,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/**
 * Check if the current user is eligible to review (Verified Contact Model)
 */
export const checkCanReview = async (req, res) => {
    try {
        const { providerId } = req.params;
        const visitorId = req.query.visitorId || req.body?.visitorId || "";

        if (!mongoose.Types.ObjectId.isValid(providerId)) {
            return handleResponse(res, 400, "Invalid provider ID");
        }

        const provider = await ProfessionalAd.findById(providerId).select("name owner").lean();
        if (!provider) {
            return handleResponse(res, 404, "Professional profile not found");
        }

        // If not logged in
        if (!req.user?.id) {
            return handleResponse(res, 200, "Authentication required to review", {
                canReview: false,
                reason: "unauthenticated",
                message: "Please log in to share a review for this professional.",
            });
        }

        // Owner cannot review their own listing
        if (provider.owner && provider.owner.toString() === req.user.id.toString()) {
            return handleResponse(res, 200, "Provider cannot review own listing", {
                canReview: false,
                isOwner: true,
                reason: "owner",
                message: "You cannot review your own listing.",
            });
        }

        // Fetch existing review if any
        const existingReview = await ProfessionalReview.findOne({
            providerId,
            userId: req.user.id,
        }).lean();

        // Check if customer contacted provider via Call, WhatsApp, or Contact
        const candidateVisitorIds = [`usr_${req.user.id}`];
        if (visitorId) {
            candidateVisitorIds.push(`gst_${String(visitorId).trim()}`);
        }

        const contactInteraction = await AdInteractionLog.findOne({
            targetType: "ProfessionalAd",
            targetId: providerId,
            interactionType: { $in: ["call", "whatsapp", "contact"] },
            visitorId: { $in: candidateVisitorIds },
        });

        const hasContacted = Boolean(contactInteraction);

        return handleResponse(res, 200, "Review eligibility checked", {
            canReview: hasContacted,
            hasContacted,
            existingReview: existingReview || null,
            reason: hasContacted ? "eligible" : "not_contacted",
            message: hasContacted
                ? (existingReview ? "You can update your review." : "You are verified to review this provider.")
                : "Verified Contact Required: Please connect with the provider via Call or WhatsApp before sharing your review.",
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/**
 * Submit or update a review for a service provider (enforces Verified Contact check)
 */
export const submitProviderReview = async (req, res) => {
    try {
        const { providerId } = req.params;
        const { rating, comment, visitorId } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return handleResponse(res, 401, "Authentication required");
        }

        if (!mongoose.Types.ObjectId.isValid(providerId)) {
            return handleResponse(res, 400, "Invalid provider ID");
        }

        const parsedRating = Number(rating);
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return handleResponse(res, 400, "Rating must be a valid number between 1 and 5");
        }

        const cleanRating = Math.round(parsedRating);

        const provider = await ProfessionalAd.findById(providerId);
        if (!provider) {
            return handleResponse(res, 404, "Professional profile not found");
        }

        // Prevent self review
        if (provider.owner && provider.owner.toString() === userId.toString()) {
            return handleResponse(res, 403, "You cannot review your own listing");
        }

        // Verified Contact check
        const candidateVisitorIds = [`usr_${userId}`];
        if (visitorId) {
            candidateVisitorIds.push(`gst_${String(visitorId).trim()}`);
        }

        const contactInteraction = await AdInteractionLog.findOne({
            targetType: "ProfessionalAd",
            targetId: providerId,
            interactionType: { $in: ["call", "whatsapp", "contact"] },
            visitorId: { $in: candidateVisitorIds },
        });

        if (!contactInteraction) {
            return handleResponse(
                res,
                403,
                "Verified Contact Required: Please connect with this provider via Call or WhatsApp before submitting a rating."
            );
        }

        // Upsert review
        const review = await ProfessionalReview.findOneAndUpdate(
            { providerId, userId },
            {
                userName: req.user.name || "Customer",
                userPhone: req.user.phone || "",
                rating: cleanRating,
                comment: (comment || "").trim().slice(0, 1000),
                status: "approved",
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Recalculate average rating & ratingCount for the provider
        const stats = await ProfessionalReview.aggregate([
            { $match: { providerId: new mongoose.Types.ObjectId(providerId), status: "approved" } },
            {
                $group: {
                    _id: "$providerId",
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 },
                },
            },
        ]);

        const avg = stats.length > 0 ? Number(stats[0].avgRating.toFixed(1)) : 5.0;
        const total = stats.length > 0 ? stats[0].totalReviews : 0;

        provider.rating = avg;
        provider.ratingCount = total;
        await provider.save();

        return handleResponse(res, 200, "Review submitted successfully", {
            review,
            averageRating: avg,
            ratingCount: total,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/**
 * Delete a review (Author or Admin)
 */
export const deleteProviderReview = async (req, res) => {
    try {
        const { providerId, reviewId } = req.params;
        const userId = req.user?.id;
        const isAdmin = req.user?.role === "admin";

        if (!userId) {
            return handleResponse(res, 401, "Authentication required");
        }

        const review = await ProfessionalReview.findById(reviewId);
        if (!review) {
            return handleResponse(res, 404, "Review not found");
        }

        // Only author or admin can delete
        if (!isAdmin && review.userId.toString() !== userId.toString()) {
            return handleResponse(res, 403, "You do not have permission to delete this review");
        }

        await ProfessionalReview.findByIdAndDelete(reviewId);

        // Recalculate average
        const stats = await ProfessionalReview.aggregate([
            { $match: { providerId: new mongoose.Types.ObjectId(providerId), status: "approved" } },
            {
                $group: {
                    _id: "$providerId",
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 },
                },
            },
        ]);

        const avg = stats.length > 0 ? Number(stats[0].avgRating.toFixed(1)) : 5.0;
        const total = stats.length > 0 ? stats[0].totalReviews : 0;

        await ProfessionalAd.findByIdAndUpdate(providerId, {
            rating: avg,
            ratingCount: total,
        });

        return handleResponse(res, 200, "Review deleted successfully", {
            averageRating: avg,
            ratingCount: total,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/**
 * Admin: Get all reviews with provider details
 */
export const adminGetAllReviews = async (req, res) => {
    try {
        const { providerId, status, page = 1, limit = 25 } = req.query;
        const query = {};
        if (providerId) query.providerId = providerId;
        if (status) query.status = status;

        const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
        const [reviews, total] = await Promise.all([
            ProfessionalReview.find(query)
                .populate("providerId", "name profession city phone")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit, 10))
                .lean(),
            ProfessionalReview.countDocuments(query),
        ]);

        return handleResponse(res, 200, "Reviews fetched successfully", {
            reviews,
            total,
            page: parseInt(page, 10),
            totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/**
 * Admin: Moderate a review status (approve, flag, hide)
 */
export const adminModerateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status } = req.body;

        if (!["approved", "flagged", "hidden"].includes(status)) {
            return handleResponse(res, 400, "Invalid status. Must be 'approved', 'flagged', or 'hidden'");
        }

        const review = await ProfessionalReview.findByIdAndUpdate(
            reviewId,
            { status },
            { new: true }
        );
        if (!review) {
            return handleResponse(res, 404, "Review not found");
        }

        // Recalculate provider average
        const stats = await ProfessionalReview.aggregate([
            { $match: { providerId: review.providerId, status: "approved" } },
            {
                $group: {
                    _id: "$providerId",
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 },
                },
            },
        ]);
        const avg = stats.length > 0 ? Number(stats[0].avgRating.toFixed(1)) : 5.0;
        const total = stats.length > 0 ? stats[0].totalReviews : 0;
        await ProfessionalAd.findByIdAndUpdate(review.providerId, {
            rating: avg,
            ratingCount: total,
        });

        return handleResponse(res, 200, "Review status updated successfully", review);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/**
 * Admin: Delete review permanently
 */
export const adminDeleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const review = await ProfessionalReview.findByIdAndDelete(reviewId);
        if (!review) {
            return handleResponse(res, 404, "Review not found");
        }

        // Recalculate provider average
        const stats = await ProfessionalReview.aggregate([
            { $match: { providerId: review.providerId, status: "approved" } },
            {
                $group: {
                    _id: "$providerId",
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 },
                },
            },
        ]);
        const avg = stats.length > 0 ? Number(stats[0].avgRating.toFixed(1)) : 5.0;
        const total = stats.length > 0 ? stats[0].totalReviews : 0;
        await ProfessionalAd.findByIdAndUpdate(review.providerId, {
            rating: avg,
            ratingCount: total,
        });

        return handleResponse(res, 200, "Review deleted by admin", {
            averageRating: avg,
            ratingCount: total,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
