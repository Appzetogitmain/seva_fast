import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import {
  approveSellerApplicationById,
  getPendingSellerApplications,
  rejectSellerApplicationById,
} from "../../services/admin/sellerApplicationService.js";
import { notify } from "../../modules/notifications/notification.service.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";

export const getPendingSellers = async (req, res) => {
  try {
    const { q = "", status = "pending" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const assignedZones = req.assignedZones || [];

    const data = await getPendingSellerApplications({
      q,
      status,
      page,
      limit,
      skip,
      assignedZones,
    });

    return handleResponse(res, 200, "Pending seller applications fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const approveSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await approveSellerApplicationById({
      sellerId: id,
      reviewedBy: req.user.id,
    });

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    try {
      await notify(NOTIFICATION_EVENTS.SELLER_APPROVED, {
        sellerId: seller._id,
        title: "Store Approved!",
        message: "Congratulations! Your store application has been approved. You can now start adding products.",
        push: true,
      });
    } catch (notifyErr) {
      console.error("Error sending seller approval notification:", notifyErr);
    }

    return handleResponse(res, 200, "Seller approved successfully", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const seller = await rejectSellerApplicationById({
      sellerId: id,
      reviewedBy: req.user.id,
      reason,
    });

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    try {
      await notify(NOTIFICATION_EVENTS.SELLER_REJECTED, {
        sellerId: seller._id,
        title: "Application Update",
        message: `Your store application requires attention. ${reason ? "Reason: " + reason : "Please review your details and apply again."}`,
        push: true,
      });
    } catch (notifyErr) {
      console.error("Error sending seller rejection notification:", notifyErr);
    }

    return handleResponse(res, 200, "Seller application rejected", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
