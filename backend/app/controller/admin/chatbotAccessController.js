import handleResponse from "../../utils/helper.js";
import {
  getChatbotAccessStatus,
  disableChatbotAccess,
  enableChatbotAccess,
} from "../../services/admin/chatbotAccessService.js";

const VALID_ROLES = ["user", "seller", "delivery", "admin", "sub-admin"];

export const getAccessStatus = async (req, res) => {
  try {
    const { role, userId } = req.params;
    if (!VALID_ROLES.includes(role)) return handleResponse(res, 400, "Invalid role");
    const data = await getChatbotAccessStatus(role, userId);
    return handleResponse(res, 200, "Chatbot access status fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const disableAccess = async (req, res) => {
  try {
    const { role, userId } = req.params;
    const { mode, duration, reason } = req.body;
    if (!VALID_ROLES.includes(role)) return handleResponse(res, 400, "Invalid role");
    if (!["temporary", "permanent"].includes(mode)) {
      return handleResponse(res, 400, "mode must be 'temporary' or 'permanent'");
    }
    if (!reason || !reason.trim()) {
      return handleResponse(res, 400, "An admin reason is required to disable chatbot access");
    }

    const doc = await disableChatbotAccess({
      role,
      userRef: userId,
      mode,
      duration,
      reason: reason.trim(),
      adminId: req.user.id,
    });
    return handleResponse(res, 200, "Chatbot access disabled", doc);
  } catch (error) {
    const statusCode = error.message?.startsWith("Invalid duration") ? 400 : 500;
    return handleResponse(res, statusCode, error.message);
  }
};

export const enableAccess = async (req, res) => {
  try {
    const { role, userId } = req.params;
    const { reason } = req.body;
    if (!VALID_ROLES.includes(role)) return handleResponse(res, 400, "Invalid role");

    const doc = await enableChatbotAccess({ role, userRef: userId, reason, adminId: req.user.id });
    return handleResponse(res, 200, "Chatbot access re-enabled", doc);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
