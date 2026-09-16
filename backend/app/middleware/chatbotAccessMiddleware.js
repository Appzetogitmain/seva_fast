import ChatbotAccessControl from "../models/chatbot/chatbotAccessControl.js";
import handleResponse from "../utils/helper.js";

/**
 * Gates access to the chatbot specifically — never the underlying account.
 * Mirrors the requireApprovedSeller/requireApprovedDelivery pattern in
 * authMiddleware.js but for a chatbot-only enable/disable status set by admin.
 *
 * Only applies when the requester has a known identity (req.user from a
 * verified JWT). The customer panel's chat route also accepts anonymous
 * traffic (no auth) — there is no identity to gate on for those requests,
 * so this middleware simply no-ops for them.
 */
export const requireChatbotAccess = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;

    if (!role || !userId) {
      return next();
    }

    const access = await ChatbotAccessControl.findOne({ role, userRef: userId }).lean();
    if (!access || access.status === "ACTIVE") {
      return next();
    }

    if (access.status === "TEMPORARILY_DISABLED") {
      if (access.disabledUntil && new Date(access.disabledUntil) <= new Date()) {
        // Window has passed — auto-reactivate rather than requiring an admin to remember.
        await ChatbotAccessControl.updateOne(
          { _id: access._id },
          { $set: { status: "ACTIVE", disabledUntil: null, disabledAt: null } },
        );
        return next();
      }
      return handleResponse(res, 403, "Chatbot access is temporarily disabled for your account.", {
        chatbotAccessStatus: "TEMPORARILY_DISABLED",
        disabledUntil: access.disabledUntil,
        reason: access.reason || "",
      });
    }

    return handleResponse(res, 403, "Chatbot access has been disabled for your account.", {
      chatbotAccessStatus: "PERMANENTLY_DISABLED",
      reason: access.reason || "",
    });
  } catch (error) {
    console.error("[ChatbotAccess] check failed:", error.message);
    // Fail open — an infra hiccup on this add-on gate shouldn't take the chatbot down.
    return next();
  }
};
