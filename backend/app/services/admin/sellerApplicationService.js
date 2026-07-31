import Seller from "../../models/seller.js";
import {
  escapeRegExp,
  formatSellerApplication,
  formatSellerDocuments,
} from "./shared/sellerAdminUtils.js";
import { registerOrUpdateSellerPickupLocation } from "../shiprocket/shiprocketOrderService.js";
import { generateSellerCertificatePdf } from "../sellerCertificateService.js";
import { sendSellerApprovalEmail } from "../emailService.js";
import logger from "../logger.js";

function buildSellerCode() {
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SV-${randomCode}`;
}

async function ensureSellerCodeForCertificate(seller) {
  if (seller?.sellerCode) {
    return seller;
  }

  const sellerCode = buildSellerCode();
  const updatedSeller = await Seller.findByIdAndUpdate(
    seller._id,
    { $set: { sellerCode } },
    { new: true },
  );

  return updatedSeller || { ...seller.toObject?.() ?? seller, sellerCode };
}

export async function getPendingSellerApplications({
  q = "",
  status = "pending",
  page,
  limit,
  skip,
  assignedZones,
}) {
  const normalizedStatus = String(status || "pending").trim().toLowerCase();
  let baseStatusQuery = { isVerified: { $ne: true } };

  if (normalizedStatus === "pending") {
    baseStatusQuery = {
      isVerified: { $ne: true },
      $or: [
        { applicationStatus: "pending" },
        { applicationStatus: { $exists: false } },
        { applicationStatus: null },
      ],
    };
  } else if (normalizedStatus !== "all") {
    baseStatusQuery = {
      isVerified: { $ne: true },
      applicationStatus: normalizedStatus,
    };
  }

  const conditions = [baseStatusQuery];
  if (assignedZones && assignedZones.length > 0) {
    conditions.push({ zoneId: { $in: assignedZones } });
  }
  const search = String(q || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    conditions.push({
      $or: [
        { name: regex },
        { shopName: regex },
        { email: regex },
        { phone: regex },
        { address: regex },
      ],
    });
  }

  const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

  const statsQuery = {
    isVerified: { $ne: true },
    $or: [
      { applicationStatus: "pending" },
      { applicationStatus: { $exists: false } },
    ],
  };
  if (assignedZones && assignedZones.length > 0) {
    statsQuery.zoneId = { $in: assignedZones };
  }

  const [sellers, total, allPendingForStats] = await Promise.all([
    Seller.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Seller.countDocuments(query),
    Seller.find(statsQuery)
      .select("address documents createdAt")
      .lean(),
  ]);

  const items = sellers.map(formatSellerApplication);
  const totalApplications = allPendingForStats.length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const receivedToday = allPendingForStats.filter(
    (seller) => seller.createdAt && new Date(seller.createdAt) >= todayStart,
  ).length;

  const missingInfo = allPendingForStats.filter((seller) => {
    const docs = formatSellerDocuments(seller.documents);
    return !seller.address || docs.length < 3;
  }).length;

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalApplications,
      receivedToday,
      missingInfo,
      avgReviewTimeHours: 24,
    },
  };
}

export async function approveSellerApplicationById({ sellerId, reviewedBy }) {
  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    {
      $set: {
        isVerified: true,
        isActive: true,
        applicationStatus: "approved",
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: null,
      },
    },
    { new: true },
  );

  if (!seller) {
    return null;
  }

  // Multi-vendor: register this seller's shop as a Shiprocket pickup location
  setImmediate(() => {
    registerOrUpdateSellerPickupLocation(seller).catch((err) => {
      console.warn(
        `[SellerApprove] Shiprocket pickup sync failed for ${seller._id}:`,
        err.message,
      );
    });
  });

  // Send approval email + filled Authorized Seller Certificate (non-blocking)
  setImmediate(() => {
    (async () => {
      const sellerForCertificate = await ensureSellerCodeForCertificate(seller);
      const certificate = await generateSellerCertificatePdf(sellerForCertificate);
      await sendSellerApprovalEmail({
        email: sellerForCertificate.email,
        sellerName: sellerForCertificate.name,
        shopName: sellerForCertificate.shopName,
        sellerId: sellerForCertificate.sellerCode || String(sellerForCertificate._id),
        mobile: sellerForCertificate.phone,
        certificateNo: certificate.certificateNo,
        issueDate: certificate.issueDate,
        certificatePdf: certificate.buffer,
        certificateFilename: certificate.filename,
      });
    })().catch((err) => {
      logger.warn("Seller approval email/certificate failed", {
        sellerId: String(seller._id),
        email: seller.email,
        error: err?.message || String(err),
      });
    });
  });

  return formatSellerApplication(seller);
}

export async function rejectSellerApplicationById({
  sellerId,
  reviewedBy,
  reason,
}) {
  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    {
      $set: {
        isVerified: false,
        isActive: false,
        applicationStatus: "rejected",
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: reason || "",
      },
    },
    { new: true },
  );

  if (!seller) {
    return null;
  }

  return formatSellerApplication(seller);
}
