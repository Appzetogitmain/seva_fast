import handleResponse from "../../utils/helper.js";
import { getAdminDashboardStats, getAdminAnalyticsOverview } from "../../services/admin/dashboardService.js";

export const getAdminStats = async (req, res) => {
  try {
    const assignedZones = req.assignedZones || [];
    const stats = await getAdminDashboardStats(assignedZones);
    return handleResponse(res, 200, "Admin stats fetched successfully", stats);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getAdminAnalytics = async (req, res) => {
  try {
    const assignedZones = req.assignedZones || [];
    const { range } = req.query;
    const overview = await getAdminAnalyticsOverview({ range, assignedZones });
    return handleResponse(res, 200, "Admin analytics fetched successfully", overview);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
