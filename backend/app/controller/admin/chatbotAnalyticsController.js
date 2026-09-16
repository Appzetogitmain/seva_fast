import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import {
  getChatbotOverview,
  getChatbotSessions,
  getChatbotSessionDetail,
  getFlaggedQueue,
  reviewModerationEvent,
} from "../../services/admin/chatbotAnalyticsService.js";

export const getOverview = async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await getChatbotOverview({ from, to });
    return handleResponse(res, 200, "Chatbot analytics overview fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const listSessions = async (req, res) => {
  try {
    const { page, limit } = getPagination(req, { defaultLimit: 25, maxLimit: 100 });
    const { role, riskLevel, interestLevel, from, to, search } = req.query;
    const data = await getChatbotSessions({ role, riskLevel, interestLevel, from, to, search, page, limit });
    return handleResponse(res, 200, "Chatbot sessions fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getSessionDetail = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const data = await getChatbotSessionDetail(sessionId);
    if (!data) return handleResponse(res, 404, "Chat session not found");
    return handleResponse(res, 200, "Chat session detail fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const listFlagged = async (req, res) => {
  try {
    const { page, limit } = getPagination(req, { defaultLimit: 25, maxLimit: 100 });
    const { riskLevel, reviewStatus, role } = req.query;
    const data = await getFlaggedQueue({ riskLevel, reviewStatus, role, page, limit });
    return handleResponse(res, 200, "Flagged conversations fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const reviewFlagged = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewStatus, reviewNote } = req.body;
    if (!["reviewed", "actioned", "dismissed"].includes(reviewStatus)) {
      return handleResponse(res, 400, "Invalid reviewStatus");
    }
    const updated = await reviewModerationEvent(id, { reviewStatus, reviewNote, adminId: req.user.id });
    if (!updated) return handleResponse(res, 404, "Moderation event not found");
    return handleResponse(res, 200, "Moderation event updated", updated);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
