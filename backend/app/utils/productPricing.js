export function effectiveUnitPrice(mrp, salePrice) {
  const price = Number(mrp || 0);
  const sale = Number(salePrice || 0);
  if (Number.isFinite(sale) && sale > 0 && sale < price) {
    return sale;
  }
  return Number.isFinite(price) ? price : 0;
}

export function productHasVariants(product) {
  return Array.isArray(product?.variants) && product.variants.length > 0;
}

export function resolveVariantByKey(variants = [], variantKey = "") {
  const normalizedKey = String(variantKey || "").trim();
  if (!normalizedKey) return null;

  return (
    variants.find((variant) => String(variant?.sku || "").trim() === normalizedKey) ||
    variants.find((variant) => String(variant?.name || "").trim() === normalizedKey) ||
    null
  );
}

export function resolveVariantUnitPrice(variant, productFallback = {}) {
  if (!variant) {
    return effectiveUnitPrice(productFallback.price, productFallback.salePrice);
  }

  const variantPrice = effectiveUnitPrice(variant.price, variant.salePrice);
  if (variantPrice > 0) {
    return variantPrice;
  }

  return effectiveUnitPrice(productFallback.price, productFallback.salePrice);
}
