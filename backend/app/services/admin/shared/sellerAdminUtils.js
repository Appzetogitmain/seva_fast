import { formatDate, formatTime } from "../../../utils/formatDate.js";

const SELLER_DOC_LABELS = {
  tradeLicense: "Trade License",
  gstCertificate: "GST Certificate",
  idProof: "ID Proof",
  businessRegistration: "Business Registration",
  fssaiLicense: "FSSAI License",
  other: "Other Document",
};

function getSellerDocumentLabel(key) {
  return (
    SELLER_DOC_LABELS[key] ||
    key.replace(/([A-Z])/g, " $1").trim()
  );
}

function isViewableDocumentUrl(value = "") {
  return /^https?:\/\//i.test(String(value).trim());
}

export function formatSellerDocuments(documents) {
  if (!documents || typeof documents !== "object") {
    return [];
  }

  return Object.entries(documents)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => getSellerDocumentLabel(key));
}

export function formatSellerDocumentFiles(documents) {
  if (!documents || typeof documents !== "object") {
    return [];
  }

  // Use dynamic import or require if getMediaURL is needed. Let's assume frontend prepends backend URL if it's relative, 
  // or we can construct a Cloudinary URL if we know the cloud name.
  // Actually, we can use process.env.BACKEND_URL or just let the frontend handle relative URLs by making it viewable.

  return Object.entries(documents)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => {
      const normalizedValue = String(value).trim();
      const label = getSellerDocumentLabel(key);
      const isHttp = isViewableDocumentUrl(normalizedValue);
      const isRelativeOrPublicId = normalizedValue.startsWith('/') || normalizedValue.includes('/');
      
      const isViewable = isHttp || isRelativeOrPublicId;
      
      // If it's a cloudinary publicId (not http and doesn't start with /), we could guess the URL or rely on frontend.
      // But let's just use the value as the URL, the frontend can handle it if it's relative, 
      // or if it's a publicId, we can format it.
      let url = normalizedValue;
      if (!isHttp && !normalizedValue.startsWith('/') && normalizedValue.includes('/')) {
         // rough guess for cloudinary if process.env.CLOUDINARY_CLOUD_NAME is available
         const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
         url = `https://res.cloudinary.com/${cloudName}/image/upload/${normalizedValue}`;
      } else if (!isHttp && !normalizedValue.startsWith('/')) {
         url = `/uploads/${normalizedValue}`; // Fallback local path
      }

      const lowerValue = normalizedValue.toLowerCase();

      return {
        key,
        label,
        value: normalizedValue,
        url: url,
        fileName: isHttp
          ? normalizedValue.split("/").pop()?.split("?")[0] || label
          : normalizedValue.split("/").pop() || label,
        isViewable: isViewable,
        fileType: lowerValue.includes(".pdf") ? "pdf" : "image",
      };
    });
}

export function formatSellerApplication(seller) {
  const docs = formatSellerDocuments(seller.documents);
  const documentFiles = formatSellerDocumentFiles(seller.documents);
  const createdAt = seller.createdAt ? new Date(seller.createdAt) : new Date();
  const missingInfo = !seller.address || docs.length < 3;

  return {
    id: String(seller._id),
    shopName: seller.shopName || "Unnamed Store",
    ownerName: seller.name || "Unnamed Owner",
    email: seller.email || "",
    phone: seller.phone || "",
    whatsappNumber: seller.whatsappNumber || "",
    businessType: seller.businessType || "",
    sellerType: seller.sellerType || "",
    panNumber: seller.panNumber || "",
    aadhaarNumber: seller.aadhaarNumber || "",
    gstinNumber: seller.gstinNumber || "",
    udyamNumber: seller.udyamNumber || "",
    bankDetails: seller.bankDetails || null,
    businessInfo: seller.businessInfo || null,
    officialKycDocumentUrl: seller.officialKycDocumentUrl || "",
    kycUploadedAt: seller.kycUploadedAt || null,
    certificate: seller.certificate || null,
    category: seller.category || "General",
    applicationDate: formatDate(createdAt),
    receivedAt: formatTime(createdAt),
    createdAt: createdAt.toISOString(),
    status:
      seller.applicationStatus ||
      (seller.isVerified ? "approved" : "pending"),
    documents: docs,
    documentFiles,
    location: seller.address || "Not provided",
    description: seller.description || "No application note provided.",
    verificationScore: docs.length
      ? Math.min(100, 55 + docs.length * 12 + (seller.address ? 10 : 0))
      : 40,
    missingInfo,
    referredBy: seller.onboardedBy
      ? {
          id: String(seller.onboardedBy._id || seller.onboardedBy),
          name: seller.onboardedBy.name || "",
          phone: seller.onboardedBy.phone || "",
        }
      : null,
    referralCode: seller.referralCodeUsed || "",
  };
}

export function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getSellerDisplayLocation(seller) {
  if (seller.address) {
    return seller.address;
  }

  const coords = seller.location?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
    }
  }

  return "Location not set";
}

export function sortActiveSellerRows(rows, sortBy) {
  const safeRows = [...rows];
  const sorters = {
    recent: (a, b) =>
      new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime(),
    oldest: (a, b) =>
      new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
    name_asc: (a, b) => a.shopName.localeCompare(b.shopName),
    name_desc: (a, b) => b.shopName.localeCompare(a.shopName),
    revenue_desc: (a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0),
    revenue_asc: (a, b) => (a.totalRevenue || 0) - (b.totalRevenue || 0),
    orders_desc: (a, b) => (b.totalOrders || 0) - (a.totalOrders || 0),
    orders_asc: (a, b) => (a.totalOrders || 0) - (b.totalOrders || 0),
    products_desc: (a, b) => (b.productCount || 0) - (a.productCount || 0),
    products_asc: (a, b) => (a.productCount || 0) - (b.productCount || 0),
  };

  const compare = sorters[sortBy] || sorters.recent;
  return safeRows.sort(compare);
}

function isFiniteCoordinate(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeRadiusKm(value, fallback = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.min(100, parsed));
}

export function hasValidSellerLocation(seller) {
  const coords = seller?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    return false;
  }

  const [lng, lat] = coords.map(Number);
  if (!isFiniteCoordinate(lat) || !isFiniteCoordinate(lng)) {
    return false;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return false;
  }

  if (lat === 0 && lng === 0) {
    return false;
  }

  return true;
}

export function extractSellerCity(seller) {
  const source = String(seller?.address || "").trim();
  if (!source) {
    return "Unknown";
  }

  const parts = source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "Unknown";
  }

  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return parts[0];
}

export function resolveSellerLifecycleStatus(seller) {
  const applicationStatus =
    seller?.applicationStatus || (seller?.isVerified ? "approved" : "pending");

  if (applicationStatus === "rejected") {
    return "rejected";
  }

  if (seller?.isVerified && seller?.isActive) {
    return "active";
  }

  if (applicationStatus === "pending") {
    return "pending";
  }

  if (!seller?.isActive) {
    return "inactive";
  }

  if (seller?.isVerified) {
    return "verified";
  }

  return "unverified";
}

export function matchSellerLifecycleFilter(seller, lifecycle) {
  if (!lifecycle || lifecycle === "all") {
    return true;
  }

  return resolveSellerLifecycleStatus(seller) === lifecycle;
}

export function computeMapBounds(points) {
  if (!points.length) {
    return null;
  }

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  points.forEach((point) => {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  });

  return { north, south, east, west };
}

export function computeMapCenter(points) {
  if (!points.length) {
    return { lat: 20.5937, lng: 78.9629 };
  }

  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: Number((sum.lat / points.length).toFixed(6)),
    lng: Number((sum.lng / points.length).toFixed(6)),
  };
}
