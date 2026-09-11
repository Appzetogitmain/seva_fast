import Product from "../models/product.js";
import { getApprovedOrLegacyFilter } from "./productModerationService.js";

/**
 * Matches a single extracted shopping item against the live MongoDB product catalog.
 * 
 * @param {Object} item - { searchTerm, rawText, brand, quantity, unit, variantPreferences }
 * @param {Object} options - { sellerId, nearbySellerIds }
 * @returns {Object} Resolution result: MATCHED | VARIANT_REQUIRED | MULTIPLE_MATCHES | OUT_OF_STOCK | NOT_FOUND
 */
export async function matchShoppingItemWithCatalog(item, options = {}) {
  const { searchTerm = "", variantPreferences = {}, quantity = 1 } = item;
  const { sellerId = null, nearbySellerIds = null } = options;

  if (!searchTerm || !searchTerm.trim()) {
    return {
      status: "NOT_FOUND",
      requestedItem: item,
      message: "No valid product name provided.",
    };
  }

  const cleanTerm = searchTerm.trim();
  const baseFilter = {
    status: "active",
    ...getApprovedOrLegacyFilter(),
  };

  if (sellerId) {
    baseFilter.sellerId = sellerId;
  } else if (nearbySellerIds && Array.isArray(nearbySellerIds) && nearbySellerIds.length > 0) {
    baseFilter.sellerId = { $in: nearbySellerIds };
  }

  // Tokenize keywords for flexible matching
  const words = cleanTerm.split(/\s+/).filter(w => w.length > 1);
  const regexOr = words.map(w => ({
    $or: [
      { name: { $regex: w, $options: "i" } },
      { tags: { $regex: w, $options: "i" } },
      { brand: { $regex: w, $options: "i" } },
      { "variants.name": { $regex: w, $options: "i" } },
      { "variants.sku": { $regex: w, $options: "i" } },
    ]
  }));

  const fullRegex = new RegExp(cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '.*'), 'i');

  // Try exact/phrase match first, then fall back to multi-word $and
  let candidates = await Product.find({
    ...baseFilter,
    $or: [
      { name: fullRegex },
      { tags: fullRegex },
      { brand: fullRegex },
    ]
  })
    .select("name brand price salePrice stock variants mainImage galleryImages thumbnail sellerId deliveryType")
    .limit(6)
    .lean();

  if (!candidates || candidates.length === 0) {
    if (words.length > 1) {
      candidates = await Product.find({
        ...baseFilter,
        $and: regexOr,
      })
        .select("name brand price salePrice stock variants mainImage galleryImages thumbnail sellerId deliveryType")
        .limit(6)
        .lean();
    }
  }

  if (!candidates || candidates.length === 0) {
    return {
      status: "NOT_FOUND",
      requestedItem: item,
      message: `"${item.searchTerm}" is not available in our store.`,
    };
  }

  // Check if one candidate is an exact or near-exact name match
  const exactMatch = candidates.find(c => c.name.toLowerCase().trim() === cleanTerm.toLowerCase());
  if (exactMatch) {
    return resolveProductVariantAndStock(exactMatch, item);
  }

  if (candidates.length === 1) {
    return resolveProductVariantAndStock(candidates[0], item);
  }

  // Multiple possible products found
  return {
    status: "MULTIPLE_MATCHES",
    requestedItem: item,
    candidates: candidates.map((p) => {
      const v = p.variants?.[0];
      const effectivePrice = Number(p.salePrice) > 0 ? Number(p.salePrice) : Number(p.price || v?.price || 0);
      const hasStock = p.stock > 0 || (p.variants && p.variants.some(varItem => varItem.stock > 0));
      return {
        productId: String(p._id),
        name: p.name,
        price: effectivePrice,
        image: p.mainImage || p.thumbnail || p.galleryImages?.[0] || "",
        hasVariants: Array.isArray(p.variants) && p.variants.length > 0,
        variants: p.variants || [],
        inStock: hasStock,
        sellerId: p.sellerId,
      };
    }),
    message: `Found multiple products matching "${item.searchTerm}". Please select which one you'd like.`,
  };
}

/**
 * Resolves whether a product has variants, matches requested size/color, and checks live stock.
 */
function resolveProductVariantAndStock(product, requestedItem) {
  const { variantPreferences = {}, quantity = 1 } = requestedItem;
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const img = product.mainImage || product.thumbnail || product.galleryImages?.[0] || "";

  // Product has NO variants
  if (!hasVariants) {
    const effectivePrice = Number(product.salePrice) > 0 ? Number(product.salePrice) : Number(product.price || 0);
    const availableStock = product.stock || 0;

    if (availableStock <= 0) {
      return {
        status: "OUT_OF_STOCK",
        requestedItem,
        product: { id: String(product._id), name: product.name, image: img },
        message: `"${product.name}" is currently out of stock.`,
      };
    }

    const safeQty = Math.min(Math.max(Number(quantity) || 1, 1), availableStock);
    return {
      status: "MATCHED",
      productId: String(product._id),
      name: product.name,
      price: effectivePrice,
      image: img,
      variantSku: "",
      quantity: safeQty,
      availableStock,
      sellerId: product.sellerId,
    };
  }

  // Product HAS variants: check if customer specified size/color
  const prefSize = (variantPreferences.size || "").toLowerCase().trim();
  const prefColor = (variantPreferences.color || "").toLowerCase().trim();

  let matchedVariant = null;

  if (prefSize || prefColor) {
    matchedVariant = product.variants.find((v) => {
      const vName = (v.name || "").toLowerCase();
      const vSku = (v.sku || "").toLowerCase();
      const sizeMatch = prefSize ? (vName.includes(prefSize) || vSku.includes(prefSize)) : true;
      const colorMatch = prefColor ? (vName.includes(prefColor) || vSku.includes(prefColor)) : true;
      return sizeMatch && colorMatch;
    });
  }

  // If a specific variant was matched
  if (matchedVariant) {
    const varStock = typeof matchedVariant.stock === "number" ? matchedVariant.stock : (product.stock || 0);
    const varPrice = Number(matchedVariant.salePrice) > 0
      ? Number(matchedVariant.salePrice)
      : Number(matchedVariant.price || product.salePrice || product.price || 0);

    if (varStock <= 0) {
      return {
        status: "OUT_OF_STOCK",
        requestedItem,
        product: { id: String(product._id), name: `${product.name} (${matchedVariant.name})`, image: img },
        message: `"${product.name} (${matchedVariant.name})" is currently out of stock.`,
      };
    }

    const safeQty = Math.min(Math.max(Number(quantity) || 1, 1), varStock);
    return {
      status: "MATCHED",
      productId: String(product._id),
      name: `${product.name} (${matchedVariant.name})`,
      price: varPrice,
      image: img,
      variantSku: matchedVariant.sku || matchedVariant.name || "",
      quantity: safeQty,
      availableStock: varStock,
      sellerId: product.sellerId,
    };
  }

  // Variant not specified or not matched: Request clarification from customer
  const inStockVariants = product.variants.filter((v) => (typeof v.stock === "number" ? v.stock > 0 : true));
  
  if (inStockVariants.length === 0) {
    return {
      status: "OUT_OF_STOCK",
      requestedItem,
      product: { id: String(product._id), name: product.name, image: img },
      message: `All variants of "${product.name}" are currently out of stock.`,
    };
  }

  return {
    status: "VARIANT_REQUIRED",
    productId: String(product._id),
    name: product.name,
    image: img,
    requestedQuantity: Math.max(Number(quantity) || 1, 1),
    availableVariants: inStockVariants.map((v) => ({
      name: v.name,
      sku: v.sku || v.name,
      price: Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price || product.salePrice || product.price || 0),
      stock: v.stock,
    })),
    sellerId: product.sellerId,
    message: `Please choose a variant/size for "${product.name}".`,
  };
}
