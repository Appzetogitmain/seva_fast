import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import {
  approveSellerApplicationById,
  getPendingSellerApplications,
  rejectSellerApplicationById,
} from "../../services/admin/sellerApplicationService.js";
import { notify } from "../../modules/notifications/notification.service.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";
import { getIO } from "../../socket/socketManager.js";

export const getPendingSellers = async (req, res) => {
  try {
    const { q = "", status = "pending" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const assignedZones = req.assignedZones || [];
    const assignedCategories = req.assignedCategories || [];

    const data = await getPendingSellerApplications({
      q,
      status,
      page,
      limit,
      skip,
      assignedZones,
      assignedCategories,
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
      certificateDetails: req.body || {},
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

    // Real-time socket push to immediately unlock seller dashboard without re-login
    try {
      const io = getIO();
      if (io) {
        const targetId = String(seller._id || seller.id || id);
        io.to(`seller:${targetId}`).emit("seller:approval_status", {
          status: "approved",
          applicationStatus: "approved",
          isVerified: true,
          isActive: true,
        });
      }
    } catch (socketErr) {
      console.error("Failed to emit seller approval socket event:", socketErr);
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

    // Real-time socket push to notify rejected seller immediately
    try {
      const io = getIO();
      if (io) {
        const targetId = String(seller._id || seller.id || id);
        io.to(`seller:${targetId}`).emit("seller:approval_status", {
          status: "rejected",
          applicationStatus: "rejected",
          reason,
        });
      }
    } catch (socketErr) {
      console.error("Failed to emit seller rejection socket event:", socketErr);
    }

    return handleResponse(res, 200, "Seller application rejected", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const uploadSellerKycDocument = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return handleResponse(res, 400, "Please upload a valid KYC PDF document");
    }

    if (req.file.size > 2 * 1024 * 1024) {
      return handleResponse(res, 400, "File size exceeds 2 MB limit. Please select a smaller PDF document.");
    }

    const { uploadToCloudinary } = await import("../../services/mediaService.js");
    const Seller = (await import("../../models/seller.js")).default;
    const zlib = (await import("zlib")).default;

    let bufferToUpload = req.file.buffer;
    try {
      // Compress uncompressed PDF stream objects if any exist
      const rawStr = bufferToUpload.toString("binary");
      const compressedStr = rawStr.replace(/stream\r?\n([\s\S]*?)\r?\nendstream/g, (match, content) => {
        if (match.includes("/FlateDecode")) return match;
        try {
          const comp = zlib.deflateSync(Buffer.from(content, "binary"));
          return `/Filter /FlateDecode\nstream\n${comp.toString("binary")}\nendstream`;
        } catch {
          return match;
        }
      });
      const optimized = Buffer.from(compressedStr, "binary");
      if (optimized.length < bufferToUpload.length) {
        bufferToUpload = optimized;
      }
    } catch (compressErr) {
      console.warn("PDF stream compression skipped:", compressErr.message);
    }

    const fileUrl = await uploadToCloudinary(bufferToUpload, "seller_kyc_docs", {
      mimeType: "application/pdf",
      resourceType: "raw",
      public_id: `${Date.now()}_seller_kyc.pdf`,
    });

    const seller = await Seller.findByIdAndUpdate(
      id,
      {
        $set: {
          officialKycDocumentUrl: fileUrl,
          kycUploadedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    try {
      await notify(NOTIFICATION_EVENTS.KYC_DOCUMENT_UPLOADED, {
        sellerId: seller._id,
        title: "Official KYC Document Available",
        message: "Your official SEVAFAST Seller KYC & Verification document has been uploaded by the admin. You can view or download it anytime from your profile.",
        push: true,
        data: {
          kycDocumentUrl: fileUrl,
        },
      });
    } catch (notifyErr) {
      console.error("Error sending seller KYC document notification:", notifyErr);
    }

    const { formatSellerApplication } = await import("../../services/admin/shared/sellerAdminUtils.js");
    return handleResponse(res, 200, "Official KYC Document uploaded successfully", formatSellerApplication(seller));
  } catch (error) {
    console.error("uploadSellerKycDocument error:", error);
    return handleResponse(res, 500, error.message);
  }
};
