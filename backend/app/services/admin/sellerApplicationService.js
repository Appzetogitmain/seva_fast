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

export async function approveSellerApplicationById({ sellerId, reviewedBy, certificateDetails }) {
  const existingSeller = await Seller.findById(sellerId);
  if (!existingSeller) {
    return null;
  }

  const sellerCode = existingSeller.sellerCode || buildSellerCode();
  const certNo =
    certificateDetails?.certificateNo ||
    `SF-AS-${sellerCode.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString().slice(-6)}`;

  const todayStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const nextYearDate = new Date();
  nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
  const nextYearStr = nextYearDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const certificateData = {
    certificateNo: certNo,
    sellerId: certificateDetails?.sellerId || sellerCode,
    sellerName: certificateDetails?.sellerName || existingSeller.name || "",
    shopName: certificateDetails?.shopName || existingSeller.shopName || "",
    category: certificateDetails?.category || existingSeller.category || "General",
    cityLocation:
      certificateDetails?.cityLocation ||
      existingSeller.city ||
      existingSeller.address ||
      "Registered Location",
    issueDate: certificateDetails?.issueDate || todayStr,
    validFrom: certificateDetails?.validFrom || todayStr,
    validUntil: certificateDetails?.validUntil || nextYearStr,
    signatoryName: certificateDetails?.signatoryName || "SEVAFAST Operations",
    issuedAt: new Date(),
    accepted: false,
  };

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
        sellerCode,
        certificate: certificateData,
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
