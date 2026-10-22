import crypto from "crypto";
import ProfessionalAd from "../models/professionalAd.js";
import PlatformAd from "../models/platformAd.js";
import AdInteractionLog from "../models/adInteractionLog.js";
import handleResponse from "../utils/helper.js";

/**
 * Record a profile visit or contact click for a Service Provider or Promotional Platform Ad
 * Enforces a 24-hour deduplication window per unique visitor (Instagram-style).
 */
export const trackAdInteraction = async (req, res) => {
    try {
        const { targetType, targetId, interactionType, visitorId } = req.body;

        if (!targetType || !targetId || !interactionType) {
            return handleResponse(res, 400, "targetType, targetId, and interactionType are required");
        }

        if (!["ProfessionalAd", "PlatformAd"].includes(targetType)) {
            return handleResponse(res, 400, "Invalid targetType. Must be 'ProfessionalAd' or 'PlatformAd'");
        }

        if (!["visit", "contact", "call", "whatsapp"].includes(interactionType)) {
            return handleResponse(res, 400, "Invalid interactionType. Must be 'visit', 'contact', 'call', or 'whatsapp'");
        }

        // Determine effective visitor identifier:
        // 1. Logged in customer ID (if authenticated)
        // 2. Client-generated visitorId (stored in localStorage)
        // 3. Fallback: hash of IP address + User-Agent
        const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
        const userAgent = req.headers["user-agent"] || "";
        const fallbackFingerprint = crypto
            .createHash("sha256")
            .update(`${clientIp}-${userAgent}`)
            .digest("hex")
            .slice(0, 24);

        const effectiveVisitorId = req.user?.id
            ? `usr_${req.user.id}`
            : (visitorId ? `gst_${String(visitorId).trim()}` : `ip_${fallbackFingerprint}`);

        // Check for an existing interaction log within the past 24 hours (86,400,000 ms)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const existingLog = await AdInteractionLog.findOne({
            targetType,
            targetId,
            interactionType,
            visitorId: effectiveVisitorId,
            lastInteractedAt: { $gte: twentyFourHoursAgo },
        });

        if (existingLog) {
            // Already counted within the 24-hour window
            return handleResponse(res, 200, "Interaction already recorded within 24 hours", {
                counted: false,
                reason: "deduplicated_24h",
                lastInteractedAt: existingLog.lastInteractedAt,
            });
        }

        // Upsert log record with lastInteractedAt = now
        await AdInteractionLog.findOneAndUpdate(
            { targetType, targetId, interactionType, visitorId: effectiveVisitorId },
            { lastInteractedAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Prepare counter increment object
        const incUpdate = {};
        if (interactionType === "visit") {
            incUpdate.visitsCount = 1;
        } else if (interactionType === "call") {
            incUpdate.contactsCount = 1;
            incUpdate.callClicksCount = 1;
        } else if (interactionType === "whatsapp") {
            incUpdate.contactsCount = 1;
            incUpdate.whatsappClicksCount = 1;
        } else if (interactionType === "contact") {
            incUpdate.contactsCount = 1;
        }

        let updatedAd = null;
        if (targetType === "ProfessionalAd") {
            updatedAd = await ProfessionalAd.findByIdAndUpdate(
                targetId,
                { $inc: incUpdate },
                { new: true, select: "visitsCount contactsCount callClicksCount whatsappClicksCount" }
            );
        } else if (targetType === "PlatformAd") {
            updatedAd = await PlatformAd.findByIdAndUpdate(
                targetId,
                { $inc: incUpdate },
                { new: true, select: "visitsCount contactsCount callClicksCount whatsappClicksCount" }
            );
        }

        return handleResponse(res, 200, "Interaction recorded successfully", {
            counted: true,
            counts: updatedAd,
        });
    } catch (error) {
        console.error("Error in trackAdInteraction:", error);
        return handleResponse(res, 500, "Internal error while recording interaction", error.message);
    }
};

/**
 * Get detailed interaction metrics for a specific target ad
 */
export const getAdInteractionStats = async (req, res) => {
    try {
        const { targetType, targetId } = req.params;

        if (!["ProfessionalAd", "PlatformAd"].includes(targetType)) {
            return handleResponse(res, 400, "Invalid targetType");
        }

        let ad = null;
        if (targetType === "ProfessionalAd") {
            ad = await ProfessionalAd.findById(targetId)
                .select("visitsCount contactsCount callClicksCount whatsappClicksCount name profession")
                .lean();
        } else {
            ad = await PlatformAd.findById(targetId)
                .select("visitsCount contactsCount callClicksCount whatsappClicksCount title")
                .lean();
        }

        if (!ad) {
            return handleResponse(res, 404, "Ad not found");
        }

        return handleResponse(res, 200, "Stats fetched successfully", {
            visitsCount: ad.visitsCount || 0,
            contactsCount: ad.contactsCount || 0,
            callClicksCount: ad.callClicksCount || 0,
            whatsappClicksCount: ad.whatsappClicksCount || 0,
            target: ad,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
