import Product from "../models/product.js";
import Seller from "../models/seller.js";
import SellerStorePromotion from "../models/sellerStorePromotion.js";
import { handleResponse } from "../utils/helper.js";
import { slugify } from "../utils/slugify.js";
import getPagination from "../utils/pagination.js";
import {
  parseCustomerCoordinates,
  getNearbySellerIdsForCustomer,
} from "../services/customerVisibilityService.js";
import {
  enqueueProductIndex,
  enqueueProductRemoval,
} from "../services/searchSyncService.js";
import { buildKey, getOrSet, getTTL, invalidate } from "../services/cacheService.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import { resolveCategoryName, resolveSellerName } from "../services/entityNameCache.js";
import {
  PRODUCT_APPROVAL_STATUS,
  getProductApprovalConfig,
  getApprovedOrLegacyFilter,
  buildApprovalStatusFilter,
  normalizeProductModerationFields,
  sanitizeApprovalNote,
  resolveProductApprovalStatus,
} from "../services/productModerationService.js";
import { getAdminIds } from "../utils/adminIds.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";

function buildProductListKey(queryParams) {
  const sorted = Object.keys(queryParams)
    .sort()
    .reduce((acc, k) => {
      acc[k] = String(queryParams[k] ?? "").trim().toLowerCase();
      return acc;
    }, {});
  return buildKey("catalog", "productList", JSON.stringify(sorted));
}

function isCustomerVisibilityRequest(req) {
  const role = String(req.user?.role || "").toLowerCase();
  // Admin and seller should not be subject to location filtering
  return !role || (role !== "admin" && role !== "seller" && role !== "delivery");
}

function parseSellerIdFilters({ sellerId, sellerIds }) {
  if (typeof sellerIds === "string" && sellerIds.trim()) {
    return sellerIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map(String);
  }

  if (sellerId) {
    return [String(sellerId)];
  }

  return [];
}

function makeProductSku(name, index = 1) {
  const prefix = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5) || "item";
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function parsePositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseWeightKgFromString(weightStr) {
  const raw = String(weightStr || "").trim();
  if (!raw) return null;
  let val = parseFloat(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(val) || val <= 0) return null;
  if (raw.toLowerCase().includes("gm") || raw.toLowerCase().includes("gram")) {
    val = val / 1000;
  }
  return val;
}

/**
 * For scheduled (Shiprocket) products, weight + package L/B/H (cm) are required.
 * Coerces numeric package fields onto productData when valid.
 */
function validateAndNormalizeScheduledPackageFields(productData = {}) {
  const deliveryType = String(productData.deliveryType || "instant").toLowerCase();
  if (deliveryType !== "scheduled") {
    return null;
  }

  if (!parseWeightKgFromString(productData.weight)) {
    return "Weight is required for scheduled nationwide delivery products";
  }

  const length = parsePositiveNumber(productData.packageLength);
  const breadth = parsePositiveNumber(productData.packageBreadth);
  const height = parsePositiveNumber(productData.packageHeight);

  if (!length || !breadth || !height) {
    return "Package length, breadth and height (cm) are required for scheduled nationwide delivery";
  }

  productData.packageLength = length;
  productData.packageBreadth = breadth;
  productData.packageHeight = height;
  return null;
}

function parseJsonIfString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeUrl(value) {
  const normalized = String(value || "").trim();
  if (!/^https?:\/\//i.test(normalized)) return "";
  return normalized;
}

function parseImageList(input) {
  const candidate = parseJsonIfString(input);
  if (Array.isArray(candidate)) {
    return candidate.map((item) => normalizeUrl(item)).filter(Boolean);
  }
  if (typeof candidate === "string" && candidate.includes(",")) {
    return candidate
      .split(",")
      .map((item) => normalizeUrl(item))
      .filter(Boolean);
  }
  const single = normalizeUrl(candidate);
  return single ? [single] : [];
}

function applyMediaFields(productData, { promoteGalleryToMain = true } = {}) {
  const explicitMainImage = normalizeUrl(productData.mainImage || productData.mainImageUrl);
  const galleryImages = parseImageList(productData.galleryImages);
  const genericImages = parseImageList(productData.images);

  const mergedGallery = [...galleryImages, ...genericImages].filter(Boolean);
  if (explicitMainImage) {
    productData.mainImage = explicitMainImage;
  } else if (promoteGalleryToMain && mergedGallery.length > 0) {
    productData.mainImage = mergedGallery[0];
    mergedGallery.shift();
  } else {
    // Update path: do not overwrite cover with a gallery upload.
    delete productData.mainImage;
  }

  if (
    mergedGallery.length > 0 ||
    Array.isArray(productData.galleryImages) ||
    Object.prototype.hasOwnProperty.call(productData, "galleryImages")
  ) {
    productData.galleryImages = mergedGallery;
  }
}

/** @returns {string|null} error message when stock is invalid */
function validateNonNegativeStockFields(productData) {
  if (Object.prototype.hasOwnProperty.call(productData, "stock")) {
    const stockNum = Number(productData.stock);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      return "Stock cannot be negative";
    }
    productData.stock = Math.floor(stockNum);
  }
  if (Array.isArray(productData.variants)) {
    for (const variant of productData.variants) {
      if (variant?.stock === undefined || variant?.stock === null || variant?.stock === "") {
        continue;
      }
      const vs = Number(variant.stock);
      if (!Number.isFinite(vs) || vs < 0) {
        return "Variant stock cannot be negative";
      }
      variant.stock = Math.floor(vs);
    }
  }
  return null;
}

/** Mongo filter: stock > 0 and stock <= lowStockAlert (default 5). */
function buildLowStockMongoFilter() {
  return {
    $expr: {
      $and: [
        {
          $gt: [
            {
              $convert: {
                input: "$stock",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
            0,
          ],
        },
        {
          $lte: [
            {
              $convert: {
                input: "$stock",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
            {
              $let: {
                vars: {
                  rawThreshold: {
                    $convert: {
                      input: "$lowStockAlert",
                      to: "double",
                      onError: 0,
                      onNull: 0,
                    },
                  },
                },
                in: {
                  $cond: [{ $gt: ["$$rawThreshold", 0] }, "$$rawThreshold", 5],
                },
              },
            },
          ],
        },
      ],
    },
  };
}

function applyStockStatusFilter(query, stockStatus) {
  const normalized = String(stockStatus || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return query;
  if (normalized === "out" || normalized === "out_of_stock") {
    return { ...query, stock: 0 };
  }
  if (normalized === "low" || normalized === "low_stock") {
    return { $and: [query, buildLowStockMongoFilter()] };
  }
  if (normalized === "in") {
    return { ...query, stock: { $gt: 0 } };
  }
  return query;
}

const RESTRICTED_MODERATION_FIELDS = [
  "approvalStatus",
  "approvalRequestedAt",
  "approvalReviewedAt",
  "approvalReviewedBy",
  "approvalNote",
  "lastSubmittedByRole",
];

function stripRestrictedModerationFields(payload = {}) {
  for (const field of RESTRICTED_MODERATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      delete payload[field];
    }
  }
}

function normalizeProductDocumentModeration(product) {
  if (!product) return product;
  return normalizeProductModerationFields(product);
}

function normalizeProductListModeration(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => normalizeProductDocumentModeration(item));
}

function buildSellerPendingModerationUpdate() {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
    approvalRequestedAt: new Date(),
    approvalReviewedAt: null,
    approvalReviewedBy: null,
    approvalNote: "",
    lastSubmittedByRole: "seller",
  };
}

function buildSellerApprovedModerationUpdate() {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
    approvalRequestedAt: null,
    approvalReviewedAt: null,
    approvalReviewedBy: null,
    approvalNote: "",
    lastSubmittedByRole: "seller",
  };
}

function buildAdminApprovedModerationUpdate(adminId, note = "") {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
    approvalRequestedAt: null,
    approvalReviewedAt: new Date(),
    approvalReviewedBy: adminId || null,
    approvalNote: sanitizeApprovalNote(note),
    lastSubmittedByRole: "admin",
  };
}

function buildAdminRejectedModerationUpdate(adminId, note = "") {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
    approvalRequestedAt: null,
    approvalReviewedAt: new Date(),
    approvalReviewedBy: adminId || null,
    approvalNote: sanitizeApprovalNote(note),
    lastSubmittedByRole: "admin",
  };
}

/* ===============================
   GET ALL PRODUCTS (Public/Admin)
================================ */
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      subcategory,
      header,
      status,
      approvalStatus,
      sellerId,
      featured,
      categoryId,
      subcategoryId,
      headerId,
      categoryIds,
      sellerIds,
      sort,
      lat,
      lng,
    } = req.query;
    const enforceRadius = isCustomerVisibilityRequest(req);

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Support both field names for flexibility (backward compatibility)
    const finalHeaderId = header || headerId;
    const finalCategoryId = category || categoryId;
    const finalSubcategoryId = subcategory || subcategoryId;

    if (finalHeaderId && finalHeaderId !== "all") query.headerId = finalHeaderId;
    if (finalCategoryId && finalCategoryId !== "all") query.categoryId = finalCategoryId;
    if (finalSubcategoryId && finalSubcategoryId !== "all") query.subcategoryId = finalSubcategoryId;

    const requestedSellerIds = parseSellerIdFilters({ sellerId, sellerIds });
    const coords = parseCustomerCoordinates({ lat, lng });
    const shouldApplyLocationFilter = coords.valid;

    if (shouldApplyLocationFilter) {
      const nearbySellerIds = await getNearbySellerIdsForCustomer(
        coords.lat,
        coords.lng,
      );

      const nearbySet = new Set(nearbySellerIds.map(String));
      const finalSellerIds = requestedSellerIds.length
        ? requestedSellerIds.filter((id) => nearbySet.has(String(id)))
        : nearbySellerIds;

      if (requestedSellerIds.length > 0) {
        query.$or = [
          { sellerId: { $in: finalSellerIds } },
          { sellerId: { $in: requestedSellerIds }, deliveryType: "scheduled" }
        ];
      } else {
        if (finalSellerIds.length > 0) {
          query.$or = [
            { sellerId: { $in: finalSellerIds } },
            { deliveryType: "scheduled" }
          ];
        } else {
          query.deliveryType = "scheduled";
        }
      }
    } else {
      if (enforceRadius) {
        query.deliveryType = "scheduled";
      }
    }

    if (categoryIds && typeof categoryIds === "string") {
      const ids = categoryIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id && id !== "all");
      if (ids.length) query.categoryId = { $in: ids };
    }
    // Multiple sellers: sellerIds=id1,id2 (or single sellerId)
    if (!query.sellerId) {
      if (sellerIds && typeof sellerIds === "string") {
        const ids = sellerIds
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id && id !== "all");
        if (ids.length) query.sellerId = { $in: ids };
      } else if (sellerId) {
        query.sellerId = sellerId;
      }
    }

    if (featured !== undefined) query.isFeatured = featured === "true";

    let finalQuery = { ...query };
    if (enforceRadius) {
      finalQuery.status = "active";
      finalQuery = { $and: [finalQuery, getApprovedOrLegacyFilter()] };
    } else {
      if (status && status !== "all") {
        finalQuery.status = status;
      }
      if (approvalStatus && String(approvalStatus).trim().toLowerCase() !== "all") {
        const moderationFilter = buildApprovalStatusFilter(approvalStatus);
        if (Object.keys(moderationFilter).length > 0) {
          finalQuery = { $and: [finalQuery, moderationFilter] };
        }
      }
    }

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 24,
      maxLimit: 100,
    });

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
      "stock-asc": { stock: 1, createdAt: -1 },
      "stock-desc": { stock: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const fetchFn = async () => {
      const [rawProducts, total] = await Promise.all([
        Product.find(finalQuery)
          .select(
            "name slug description sku price salePrice stock brand weight packageLength packageBreadth packageHeight mainImage galleryImages headerId categoryId subcategoryId sellerId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured variants deliveryType createdAt",
          )
          // No .populate() — names resolved via cache-backed entityNameCache
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(finalQuery),
      ]);

      // Collect unique category IDs (headerId, categoryId, subcategoryId) and seller IDs
      const categoryIdSet = new Set();
      const sellerIdSet = new Set();
      for (const p of rawProducts) {
        if (p.headerId) categoryIdSet.add(String(p.headerId));
        if (p.categoryId) categoryIdSet.add(String(p.categoryId));
        if (p.subcategoryId) categoryIdSet.add(String(p.subcategoryId));
        if (p.sellerId) sellerIdSet.add(String(p.sellerId));
      }

      // Resolve names and active store promotion status in parallel via cache-backed service
      const sellerIdArr = [...sellerIdSet];
      const [categoryEntries, sellerEntries, activePromos] = await Promise.all([
        Promise.all(
          [...categoryIdSet].map(async (id) => [id, await resolveCategoryName(id)]),
        ),
        Promise.all(
          sellerIdArr.map(async (id) => [id, await resolveSellerName(id)]),
        ),
        sellerIdArr.length
          ? SellerStorePromotion.find({
              seller: { $in: sellerIdArr },
              campaignStatus: "Active",
              $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
            }).select("seller planName").lean()
          : Promise.resolve([]),
      ]);

      const nameMap = Object.fromEntries([...categoryEntries, ...sellerEntries]);
      const promoMap = new Map((activePromos || []).map((p) => [String(p.seller), p.planName]));

      // Enrich products to match the shape previously returned by .populate()
      const products = rawProducts.map((p) => {
        const sId = p.sellerId ? String(p.sellerId) : null;
        const activePromoPlanName = sId ? promoMap.get(sId) || null : null;
        const isPromoted = Boolean(activePromoPlanName);

        return {
          ...p,
          headerId: p.headerId
            ? { _id: p.headerId, name: nameMap[String(p.headerId)] ?? null }
            : null,
          categoryId: p.categoryId
            ? { _id: p.categoryId, name: nameMap[String(p.categoryId)] ?? null }
            : null,
          subcategoryId: p.subcategoryId
            ? { _id: p.subcategoryId, name: nameMap[String(p.subcategoryId)] ?? null }
            : null,
          sellerId: p.sellerId
            ? {
                _id: p.sellerId,
                shopName: nameMap[sId] ?? null,
                isPromoted,
                promotedPlanName: activePromoPlanName,
              }
            : null,
        };
      });

      return {
        items: normalizeProductListModeration(products),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      };
    };

    const role = String(req.user?.role || "").toLowerCase();
    const shouldCache = !role || (role !== "admin" && role !== "seller");

    const result = shouldCache
      ? await getOrSet(buildProductListKey(req.query), fetchFn, getTTL("productList"))
      : await fetchFn();

    return handleResponse(res, 200, "Products fetched successfully", result);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER PRODUCTS
================================ */
export const getSellerProducts = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { stockStatus, sort, approvalStatus } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const baseSellerQuery = { sellerId };
    const query = { ...baseSellerQuery };
    if (stockStatus === "in") {
      query.stock = { $gt: 0 };
    } else if (stockStatus === "out") {
      query.stock = 0;
    } else if (stockStatus === "low") {
      query.$expr = {
        $and: [
          { $gt: [{ $convert: { input: "$stock", to: "double", onError: 0, onNull: 0 } }, 0] },
          {
            $lte: [
              { $convert: { input: "$stock", to: "double", onError: 0, onNull: 0 } },
              { $convert: { input: "$lowStockAlert", to: "double", onError: 5, onNull: 5 } },
            ],
          },
        ],
      };
    }

    if (req.query.status && String(req.query.status).trim().toLowerCase() !== "all") {
      query.status = String(req.query.status).trim().toLowerCase();
    }

    if (approvalStatus && String(approvalStatus).trim().toLowerCase() !== "all") {
      const approvalFilter = buildApprovalStatusFilter(approvalStatus);
      if (Object.keys(approvalFilter).length > 0) {
        Object.assign(query, approvalFilter);
      }
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
      "stock-asc": { stock: 1, createdAt: -1 },
      "stock-desc": { stock: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const [
      products,
      total,
      totalAll,
      activeCount,
      lowStockCount,
      outOfStockCount,
      pendingCount,
      approvedCount,
      rejectedCount,
    ] = await Promise.all([
      Product.find(query)
        .select(
          "name slug description sku price salePrice stock lowStockAlert brand weight packageLength packageBreadth packageHeight mainImage galleryImages headerId categoryId subcategoryId sellerId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured variants deliveryType createdAt",
        )
        .populate("headerId", "name")
        .populate("categoryId", "name")
        .populate("subcategoryId", "name")
        .populate("sellerId", "shopName")
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      Product.countDocuments(baseSellerQuery),
      Product.countDocuments({ ...baseSellerQuery, status: "active" }),
      Product.countDocuments({
        ...baseSellerQuery,
        $expr: {
          $and: [
            {
              $gt: [
                {
                  $convert: {
                    input: "$stock",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                0,
              ],
            },
            {
              $lte: [
                {
                  $convert: {
                    input: "$stock",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
                {
                  $let: {
                    vars: {
                      rawThreshold: {
                        $convert: {
                          input: "$lowStockAlert",
                          to: "double",
                          onError: 0,
                          onNull: 0,
                        },
                      },
                    },
                    in: {
                      $cond: [{ $gt: ["$$rawThreshold", 0] }, "$$rawThreshold", 5],
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
      Product.countDocuments({ ...baseSellerQuery, stock: 0 }),
      Product.countDocuments({
        ...baseSellerQuery,
        approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
      }),
      Product.countDocuments({
        ...baseSellerQuery,
        $and: [
          { ...baseSellerQuery },
          buildApprovalStatusFilter(PRODUCT_APPROVAL_STATUS.APPROVED),
        ],
      }),
      Product.countDocuments({
        ...baseSellerQuery,
        approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
      }),
    ]);

    return handleResponse(res, 200, "Seller products fetched", {
      items: normalizeProductListModeration(products),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        total: totalAll,
        active: activeCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CREATE PRODUCT
================================ */
export const createProduct = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const productData = { ...req.body };
    stripRestrictedModerationFields(productData);
    if (productData.subcategoryId === "" || productData.subcategoryId === "undefined" || productData.subcategoryId === "null") {
      productData.subcategoryId = null;
    }

    if (role === "admin") {
      if (!productData.sellerId) {
        return handleResponse(res, 400, "sellerId is required for admin-created products");
      }
    } else {
      productData.sellerId = req.user.id;
    }

    // Handle multipart files (mainImage and galleryImages)
    const files = req.files || [];
    if (files.length > 0) {
      const galleryUrls = [];
      for (const file of files) {
        try {
          if (file.fieldname === "mainImage") {
            const url = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
            });
            productData.mainImage = url;
          } else if (file.fieldname === "galleryImages") {
            const url = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
            });
            galleryUrls.push(url);
          }
        } catch (err) {
          console.error("Cloudinary upload failed:", err);
        }
      }
      if (galleryUrls.length > 0) {
        productData.galleryImages = galleryUrls;
      }
    }

    // Parse JSON fields if they come as strings from FormData
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        console.error("Failed to parse variants JSON:", e);
      }
    }
    if (typeof productData.tags === "string" && productData.tags.startsWith("[")) {
      try {
        productData.tags = JSON.parse(productData.tags);
      } catch (e) {
        // Not JSON, keep as is
      }
    }

    if (!productData.name) {
      return handleResponse(res, 400, "Product name is required");
    }
    
    // Auto-generate slug
    if (!productData.slug || productData.slug.trim() === "") {
      productData.slug = slugify(productData.name);
    } else {
      productData.slug = slugify(productData.slug);
    }

    productData.description =
      typeof productData.description === "string"
        ? productData.description.trim()
        : productData.description || "";

    // Auto-generate product SKU if missing
    if (!productData.sku || String(productData.sku).trim() === "") {
      productData.sku = makeProductSku(productData.name, 1);
    }

    applyMediaFields(productData);

    // Handle tags if string
    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim());
    }

    // Handle variants if string (multipart/form-data sends as string)
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        productData.variants = [];
      }
    }

    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((variant, idx) => ({
        ...variant,
        sku:
          variant?.sku && String(variant.sku).trim()
            ? variant.sku
            : makeProductSku(productData.name, idx + 1),
      }));
      productData.stock = productData.variants.reduce(
        (sum, variant) => sum + (Number(variant?.stock) || 0),
        0,
      );
    }

    const stockError = validateNonNegativeStockFields(productData);
    if (stockError) return handleResponse(res, 400, stockError);

    const packageError = validateAndNormalizeScheduledPackageFields(productData);
    if (packageError) return handleResponse(res, 400, packageError);

    let moderationUpdate = {};
    let successMessage = "Product created successfully";

    if (role === "admin") {
      moderationUpdate = buildAdminApprovedModerationUpdate(req.user?.id || null);
    } else {
      const approvalConfig = await getProductApprovalConfig();
      if (approvalConfig.sellerCreateRequiresApproval) {
        moderationUpdate = buildSellerPendingModerationUpdate();
        successMessage = "Product submitted for admin approval";
      } else {
        moderationUpdate = buildSellerApprovedModerationUpdate();
      }
    }
    Object.assign(productData, moderationUpdate);

    const product = await Product.create(productData);
    
    if (product && product._id) {
      // Enqueue search indexing asynchronously
      await enqueueProductIndex(product._id.toString());
      await invalidate(`cache:catalog:product:${product._id.toString()}`);
    }

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate("cache:offersections:public:*");
    } catch (cacheErr) {
      console.error("Cache invalidation error (createProduct):", cacheErr);
    }

    return handleResponse(
      res,
      201,
      successMessage,
      normalizeProductDocumentModeration(product?.toObject?.() || product),
    );
  } catch (error) {
    console.error("Create Product Error:", error);
    if (error.code === 11000) {
      return handleResponse(res, 400, "Slug or SKU already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE PRODUCT
================================ */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const role = String(req.user.role || "").toLowerCase();
    const productData = { ...req.body };
    stripRestrictedModerationFields(productData);
    if (productData.subcategoryId === "" || productData.subcategoryId === "undefined" || productData.subcategoryId === "null") {
      productData.subcategoryId = null;
    }
    if (Object.prototype.hasOwnProperty.call(productData, "sellerId")) {
      delete productData.sellerId;
    }

    // Admin bypasses sellerId check
    const query = role === "admin" ? { _id: id } : { _id: id, sellerId };
    const product = await Product.findOne(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }

    // Handle multipart files (mainImage and galleryImages)
    const files = req.files || [];
    const galleryUrls = [];
    if (files.length > 0) {
      for (const file of files) {
        try {
          if (file.fieldname === "mainImage") {
            const url = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
            });
            productData.mainImage = url;
          } else if (file.fieldname === "galleryImages") {
            const url = await uploadToCloudinary(file.buffer, "products", {
              mimeType: file.mimetype,
              resourceType: "image",
            });
            galleryUrls.push(url);
          }
        } catch (err) {
          console.error("Cloudinary upload failed during update:", err);
        }
      }
    }

    // Keep existing remote gallery URLs from client + append newly uploaded files.
    // Prevents "add then delete gallery photo" from replacing the cover image.
    const hasExistingGalleryField = Object.prototype.hasOwnProperty.call(
      req.body,
      "existingGalleryImages",
    );
    if (hasExistingGalleryField || galleryUrls.length > 0) {
      let kept = [];
      if (hasExistingGalleryField) {
        const raw = req.body.existingGalleryImages;
        try {
          kept = parseImageList(typeof raw === "string" ? JSON.parse(raw) : raw);
        } catch {
          kept = parseImageList(raw);
        }
        kept = kept.filter((url) => /^https?:\/\//i.test(url));
      } else {
        // Legacy clients: preserve current gallery when only uploading new files
        kept = Array.isArray(product.galleryImages)
          ? product.galleryImages.filter(Boolean)
          : [];
      }
      productData.galleryImages = [...kept, ...galleryUrls];
    }
    delete productData.existingGalleryImages;

    // Parse JSON fields
    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        console.error("Failed to parse variants JSON during update:", e);
      }
    }
    if (typeof productData.tags === "string" && productData.tags.startsWith("[")) {
      try {
        productData.tags = JSON.parse(productData.tags);
      } catch (e) {
        // Not JSON, keep as is
      }
    }

    if (productData.name) {
      if (!productData.slug || productData.slug.trim() === "") {
        productData.slug = slugify(productData.name);
      } else {
        productData.slug = slugify(productData.slug);
      }
    }

    if (productData.description !== undefined) {
      productData.description =
        typeof productData.description === "string"
          ? productData.description.trim()
          : productData.description || "";
    }

    const skuBaseName = productData.name || product.name;
    if (!productData.sku || String(productData.sku).trim() === "") {
      productData.sku = product.sku || makeProductSku(skuBaseName, 1);
    }

    applyMediaFields(productData, { promoteGalleryToMain: false });

    if (typeof productData.tags === "string") {
      productData.tags = productData.tags.split(",").map((tag) => tag.trim());
    }

    if (typeof productData.variants === "string") {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        // keep existing if invalid?
      }
    }

    if (Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((variant, idx) => ({
        ...variant,
        sku:
          variant?.sku && String(variant.sku).trim()
            ? variant.sku
            : makeProductSku(skuBaseName, idx + 1),
      }));
      // Keep top-level stock aligned with variant totals for list/status badges.
      productData.stock = productData.variants.reduce(
        (sum, variant) => sum + (Number(variant?.stock) || 0),
        0,
      );
    }

    const stockError = validateNonNegativeStockFields(productData);
    if (stockError) return handleResponse(res, 400, stockError);

    const packageError = validateAndNormalizeScheduledPackageFields({
      deliveryType:
        productData.deliveryType !== undefined
          ? productData.deliveryType
          : product.deliveryType,
      weight:
        productData.weight !== undefined ? productData.weight : product.weight,
      packageLength:
        productData.packageLength !== undefined
          ? productData.packageLength
          : product.packageLength,
      packageBreadth:
        productData.packageBreadth !== undefined
          ? productData.packageBreadth
          : product.packageBreadth,
      packageHeight:
        productData.packageHeight !== undefined
          ? productData.packageHeight
          : product.packageHeight,
    });
    if (packageError) return handleResponse(res, 400, packageError);

    // Persist coerced numeric dims when scheduled payload included them
    if (productData.packageLength !== undefined) {
      const n = parsePositiveNumber(productData.packageLength);
      if (n) productData.packageLength = n;
    }
    if (productData.packageBreadth !== undefined) {
      const n = parsePositiveNumber(productData.packageBreadth);
      if (n) productData.packageBreadth = n;
    }
    if (productData.packageHeight !== undefined) {
      const n = parsePositiveNumber(productData.packageHeight);
      if (n) productData.packageHeight = n;
    }

    let moderationUpdate = {};
    let successMessage = "Product updated successfully";

    if (role === "admin") {
      moderationUpdate = buildAdminApprovedModerationUpdate(req.user?.id || null);
    } else {
      const approvalConfig = await getProductApprovalConfig();
      if (approvalConfig.sellerEditRequiresApproval) {
        moderationUpdate = buildSellerPendingModerationUpdate();
        successMessage = "Product changes submitted for admin approval";
      } else {
        moderationUpdate = buildSellerApprovedModerationUpdate();
      }
    }
    Object.assign(productData, moderationUpdate);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: productData },
      { new: true, runValidators: true },
    );

    if (role !== "admin" && updatedProduct) {
      try {
        const [adminIds, seller] = await Promise.all([
          getAdminIds(),
          Seller.findById(sellerId).select("shopName name").lean(),
        ]);
        if (adminIds.length > 0) {
          const sellerName =
            String(seller?.shopName || seller?.name || "").trim() || "A seller";
          emitNotificationEvent(
            NOTIFICATION_EVENTS.PRODUCT_UPDATED_BY_SELLER,
            {
              adminIds,
              sellerId,
              sellerName,
              productId: updatedProduct._id?.toString?.() || String(id),
              productName: String(updatedProduct.name || productData.name || "a product"),
              data: {
                approvalStatus: updatedProduct.approvalStatus,
              },
            },
          );
        }
      } catch (notifyErr) {
        console.error("Failed to emit seller product update notification:", notifyErr);
      }
    }
    
    // Enqueue search indexing asynchronously
    await enqueueProductIndex(id);
    await invalidate(`cache:catalog:product:${id}`);

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate("cache:offersections:public:*");
    } catch (cacheErr) {
      console.error("Cache invalidation error (updateProduct):", cacheErr);
    }

    return handleResponse(
      res,
      200,
      successMessage,
      normalizeProductDocumentModeration(updatedProduct?.toObject?.() || updatedProduct),
    );
  } catch (error) {
    console.error("Update Product Error:", error);
    if (error.name === "ValidationError") {
      return handleResponse(
        res,
        400,
        Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      );
    }
    if (error.name === "CastError") {
      return handleResponse(res, 400, `Invalid ${error.path}: ${error.value}`);
    }
    if (error.code === 11000) {
      return handleResponse(res, 400, "Slug or SKU already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   DELETE PRODUCT
================================ */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const role = req.user.role;

    const query = role === "admin" ? { _id: id } : { _id: id, sellerId };
    const product = await Product.findOneAndDelete(query);

    if (!product) {
      return handleResponse(res, 404, "Product not found or unauthorized");
    }
    
    // Enqueue search index removal asynchronously
    await enqueueProductRemoval(id);
    await invalidate(`cache:catalog:product:${id}`);

    try {
      await invalidate(buildKey("catalog", "productList", "*"));
      await invalidate("cache:offersections:public:*");
    } catch (cacheErr) {
      console.error("Cache invalidation error (deleteProduct):", cacheErr);
    }

    return handleResponse(res, 200, "Product deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SINGLE PRODUCT
================================ */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const enforceRadius = isCustomerVisibilityRequest(req);

    let nearbySellerSet = null;
    const coords = parseCustomerCoordinates(req.query || {});
    if (enforceRadius && coords.valid) {
      const nearbySellerIds = await getNearbySellerIdsForCustomer(
        coords.lat,
        coords.lng,
      );
      nearbySellerSet = new Set(nearbySellerIds.map(String));
    }

    const cacheKey = buildKey("catalog", "product", id);
    const product = await getOrSet(
      cacheKey,
      async () =>
        Product.findById(id)
          .select(
            "name slug description sku price salePrice stock lowStockAlert brand weight packageLength packageBreadth packageHeight mainImage galleryImages headerId categoryId subcategoryId sellerId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured variants deliveryType createdAt",
          )
          .populate("headerId", "name")
          .populate("categoryId", "name")
          .populate("subcategoryId", "name")
          .populate("sellerId", "shopName")
          .lean(),
      getTTL("product"),
    );

    if (!product) {
      return handleResponse(res, 404, "Product not found");
    }

    if (enforceRadius) {
      const approvalState = resolveProductApprovalStatus(product);
      if (product.status !== "active" || approvalState !== PRODUCT_APPROVAL_STATUS.APPROVED) {
        return handleResponse(res, 404, "Product not found");
      }
    }

    if (enforceRadius) {
      const sellerIdForProduct = String(product?.sellerId?._id || product?.sellerId);
      const isScheduled = product.deliveryType === "scheduled";
      if (!isScheduled && (!nearbySellerSet || !nearbySellerSet.has(sellerIdForProduct))) {
        return handleResponse(res, 404, "Product not available in your area");
      }
    }

    return handleResponse(
      res,
      200,
      "Product details fetched",
      normalizeProductDocumentModeration(product),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADMIN MODERATION LIST
================================ */
export const getModerationProducts = async (req, res) => {
  try {
    const {
      approvalStatus = "all",
      status = "all",
      search = "",
      sellerId,
      category,
      categoryId,
      subcategory,
      subcategoryId,
      header,
      headerId,
      sort = "newest",
      stockStatus = "all",
    } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const baseQuery = {};
    if (status && status !== "all") {
      baseQuery.status = status;
    }

    if (req.user?.role === "sub-admin") {
      const assignedZones = req.assignedZones || [];
      const sellersInZones = await Seller.find({ zoneId: { $in: assignedZones } }).select("_id").lean();
      const sellerIds = sellersInZones.map(s => s._id);

      if (sellerId && sellerId !== "all") {
        if (sellerIds.map(String).includes(String(sellerId))) {
          baseQuery.sellerId = sellerId;
        } else {
          baseQuery.sellerId = { $in: [] };
        }
      } else {
        baseQuery.sellerId = { $in: sellerIds };
      }
    } else if (sellerId && sellerId !== "all") {
      baseQuery.sellerId = sellerId;
    }

    const finalHeaderId = header || headerId;
    const finalCategoryId = category || categoryId;
    const finalSubcategoryId = subcategory || subcategoryId;
    if (finalHeaderId && finalHeaderId !== "all") {
      baseQuery.headerId = finalHeaderId;
    }
    if (finalCategoryId && finalCategoryId !== "all") {
      baseQuery.categoryId = finalCategoryId;
    }
    if (finalSubcategoryId && finalSubcategoryId !== "all") {
      baseQuery.subcategoryId = finalSubcategoryId;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      baseQuery.$or = [
        { name: { $regex: term, $options: "i" } },
        { slug: { $regex: term, $options: "i" } },
        { sku: { $regex: term, $options: "i" } },
      ];
    }

    let moderatedQuery = { ...baseQuery };
    const approvalFilter = buildApprovalStatusFilter(approvalStatus);
    if (Object.keys(approvalFilter).length > 0) {
      moderatedQuery = { $and: [moderatedQuery, approvalFilter] };
    }
    moderatedQuery = applyStockStatusFilter(moderatedQuery, stockStatus);

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "name-asc": { name: 1, createdAt: -1 },
      "name-desc": { name: -1, createdAt: -1 },
      "price-asc": { price: 1, createdAt: -1 },
      "price-desc": { price: -1, createdAt: -1 },
      "stock-asc": { stock: 1, createdAt: -1 },
      "stock-desc": { stock: -1, createdAt: -1 },
    };
    const sortQuery = sortMap[String(sort || "newest").toLowerCase()] || sortMap.newest;

    const [
      items,
      total,
      allCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      lowStockCount,
      outOfStockCount,
    ] =
      await Promise.all([
        Product.find(moderatedQuery)
          .select(
            "name slug description sku price salePrice stock lowStockAlert brand weight packageLength packageBreadth packageHeight mainImage galleryImages headerId categoryId subcategoryId sellerId status approvalStatus approvalRequestedAt approvalReviewedAt approvalReviewedBy approvalNote lastSubmittedByRole isFeatured variants deliveryType createdAt",
          )
          .populate("headerId", "name")
          .populate("categoryId", "name")
          .populate("subcategoryId", "name")
          .populate("sellerId", "shopName name")
          .populate("approvalReviewedBy", "name email")
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(moderatedQuery),
        Product.countDocuments(baseQuery),
        Product.countDocuments({
          ...baseQuery,
          approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
        }),
        Product.countDocuments({
          $and: [
            { ...baseQuery },
            buildApprovalStatusFilter(PRODUCT_APPROVAL_STATUS.APPROVED),
          ],
        }),
        Product.countDocuments({
          ...baseQuery,
          approvalStatus: PRODUCT_APPROVAL_STATUS.REJECTED,
        }),
        Product.countDocuments({
          $and: [baseQuery, buildLowStockMongoFilter()],
        }),
        Product.countDocuments({ ...baseQuery, stock: 0 }),
      ]);

    return handleResponse(res, 200, "Moderation products fetched", {
      items: normalizeProductListModeration(items),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      counts: {
        all: allCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADMIN MODERATION ACTIONS
================================ */
export const approveProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const note = req.body?.approvalNote ?? req.body?.note ?? "";
    const moderationUpdate = buildAdminApprovedModerationUpdate(
      req.user?.id || null,
      note,
    );

    const updated = await Product.findByIdAndUpdate(
      id,
      { $set: moderationUpdate },
      { new: true, runValidators: true },
    )
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName name")
      .populate("approvalReviewedBy", "name email");

    if (!updated) {
      return handleResponse(res, 404, "Product not found");
    }

    await enqueueProductIndex(id);
    await invalidate(`cache:catalog:product:${id}`);
    await invalidate(buildKey("catalog", "productList", "*"));
    await invalidate("cache:offersections:public:*");

    return handleResponse(
      res,
      200,
      "Product approved successfully",
      normalizeProductDocumentModeration(updated?.toObject?.() || updated),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const note = req.body?.approvalNote ?? req.body?.note ?? "";
    const moderationUpdate = buildAdminRejectedModerationUpdate(
      req.user?.id || null,
      note,
    );

    const updated = await Product.findByIdAndUpdate(
      id,
      { $set: moderationUpdate },
      { new: true, runValidators: true },
    )
      .populate("headerId", "name")
      .populate("categoryId", "name")
      .populate("subcategoryId", "name")
      .populate("sellerId", "shopName name")
      .populate("approvalReviewedBy", "name email");

    if (!updated) {
      return handleResponse(res, 404, "Product not found");
    }

    await enqueueProductIndex(id);
    await invalidate(`cache:catalog:product:${id}`);
    await invalidate(buildKey("catalog", "productList", "*"));
    await invalidate("cache:offersections:public:*");

    return handleResponse(
      res,
      200,
      "Product rejected successfully",
      normalizeProductDocumentModeration(updated?.toObject?.() || updated),
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   BULK UPLOAD (seller)
================================ */
export const downloadBulkProductTemplate = async (_req, res) => {
  try {
    const {
      buildBulkTemplateBuffer,
    } = await import("../services/productBulkUploadService.js");
    const buffer = buildBulkTemplateBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="product-bulk-upload-sample.xlsx"',
    );
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Bulk template download error:", error);
    return handleResponse(res, 500, error.message || "Failed to generate template");
  }
};

export const bulkUploadProducts = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "seller") {
      return handleResponse(res, 403, "Only sellers can bulk upload products");
    }

    const file = req.file;
    if (!file?.buffer) {
      return handleResponse(res, 400, "Please upload an Excel file (.xlsx)");
    }

    const name = String(file.originalname || "").toLowerCase();
    const isExcel =
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      String(file.mimetype || "").includes("spreadsheet") ||
      String(file.mimetype || "").includes("excel");

    if (!isExcel) {
      return handleResponse(res, 400, "Invalid file type. Upload a .xlsx Excel file");
    }

    const {
      parseBulkWorkbook,
      bulkCreateProductsFromRows,
    } = await import("../services/productBulkUploadService.js");

    let rows;
    try {
      rows = parseBulkWorkbook(file.buffer);
    } catch (parseErr) {
      return handleResponse(res, 400, parseErr.message || "Could not read Excel file");
    }

    const result = await bulkCreateProductsFromRows(rows, {
      sellerId: req.user.id,
    });

    const message =
      result.created > 0
        ? result.requiresApproval
          ? `${result.created} product(s) submitted for admin approval${result.failed ? `, ${result.failed} failed` : ""}`
          : `${result.created} product(s) created successfully${result.failed ? `, ${result.failed} failed` : ""}`
        : result.failed
          ? `No products created. ${result.failed} row(s) failed`
          : "No products created";

    const statusCode = result.created > 0 ? 201 : 400;
    return handleResponse(res, statusCode, message, result);
  } catch (error) {
    console.error("Bulk upload products error:", error);
    return handleResponse(res, 500, error.message || "Bulk upload failed");
  }
};
