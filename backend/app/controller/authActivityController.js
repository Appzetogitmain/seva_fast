import handleResponse from "../utils/helper.js";
import Customer from "../models/customer.js";
import Seller from "../models/seller.js";
import Admin from "../models/admin.js";
import Delivery from "../models/delivery.js";
import {
  listAuthActivityLogs,
  normalizeAuthRole,
  recordAuthActivity,
} from "../services/authActivityService.js";

function isDatabaseUnavailableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "MongoNotConnectedError" ||
    error?.name === "MongoServerSelectionError" ||
    error?.name === "MongoNetworkError" ||
    message.includes("buffering timed out") ||
    message.includes("not connected") ||
    message.includes("maxtimems")
  );
}

async function resolveUserForLogout(role, userId) {
  const normalizedRole = normalizeAuthRole(role);
  if (normalizedRole === "customer") {
    return Customer.findById(userId).lean();
  }
  if (normalizedRole === "seller") {
    return Seller.findById(userId).lean();
  }
  if (normalizedRole === "delivery") {
    return Delivery.findById(userId).lean();
  }
  if (normalizedRole === "admin" || normalizedRole === "sub-admin") {
    return Admin.findById(userId).lean();
  }
  return null;
}

export const recordLogoutActivity = async (req, res) => {
  try {
    const role = normalizeAuthRole(req.user?.role);
    const userId = req.user?.id;

    if (!userId || !role) {
      return handleResponse(res, 400, "Unable to resolve user session");
    }

    const user = await resolveUserForLogout(role, userId);
    await recordAuthActivity({
      role,
      action: "logout",
      userId,
      user: user || { role },
      req,
    });

    return handleResponse(res, 200, "Logout recorded");
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return handleResponse(res, 503, "Database is temporarily unavailable. Please retry.");
    }
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const getAuthActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      role = "all",
      action = "all",
      search = "",
      from = "",
      to = "",
    } = req.query || {};

    const result = await listAuthActivityLogs({
      page,
      limit,
      role,
      action,
      search,
      from: from || null,
      to: to || null,
    });

    return handleResponse(res, 200, "Auth activity logs fetched", result);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return handleResponse(res, 503, "Database is temporarily unavailable. Please retry.");
    }
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
