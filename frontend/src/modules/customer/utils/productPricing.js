const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400";

export function effectiveUnitPrice(mrp, salePrice) {
  const price = Number(mrp || 0);
  const sale = Number(salePrice || 0);
  if (Number.isFinite(sale) && sale > 0 && sale < price) {
    return sale;
  }
  return Number.isFinite(price) ? price : 0;
}

export function variantEffectiveUnitPrice(variant) {
  return effectiveUnitPrice(variant?.price, variant?.salePrice);
}

export function hasProductVariants(product) {
  return Array.isArray(product?.variants) && product.variants.length > 0;
}

export function variantIdentityKey(variant) {
  return String(variant?.sku || variant?.name || "").trim();
}

export function variantsMatch(selectedVariant, candidateVariant) {
  const selectedKey = variantIdentityKey(selectedVariant);
  const candidateKey = variantIdentityKey(candidateVariant);
  return Boolean(selectedKey) && selectedKey === candidateKey;
}

export function resolveVariantPricing(product, variantSku = "") {
  const normalizedKey = String(variantSku || "").trim();
  if (!normalizedKey) {
    return {
      price: Number(product?.price || 0),
      salePrice: Number(product?.salePrice || 0),
      variantName: "",
    };
  }

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const hit = variants.find((variant) => {
    const sku = String(variant?.sku || "").trim();
    const name = String(variant?.name || "").trim();
    return (
      (sku && sku === normalizedKey) ||
      (!sku && name === normalizedKey) ||
      name === normalizedKey
    );
  });

  return {
    price: Number(hit?.price || product?.price || 0),
    salePrice: Number(hit?.salePrice || 0),
    variantName: String(hit?.name || "").trim(),
  };
}

export function formatProductForListing(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const hasVariants = variants.length > 0;

  if (hasVariants) {
    const effectivePrices = variants
      .map((variant) => variantEffectiveUnitPrice(variant))
      .filter((value) => value > 0);
    const mrpValues = variants
      .map((variant) => Number(variant?.price || 0))
      .filter((value) => value > 0);

    const minEffective = effectivePrices.length
      ? Math.min(...effectivePrices)
      : effectiveUnitPrice(product?.price, product?.salePrice);
    const minMrp = mrpValues.length ? Math.min(...mrpValues) : Number(product?.price || 0);
    const maxMrp = mrpValues.length ? Math.max(...mrpValues) : minMrp;

    return {
      price: minEffective,
      originalPrice: maxMrp > minEffective ? maxMrp : minMrp,
      pricePrefix: null,
      hasVariants: true,
    };
  }

  const mrp = Number(product?.price || 0);
  const sale = Number(product?.salePrice || 0);

  return {
    price: effectiveUnitPrice(mrp, sale),
    originalPrice: mrp,
    pricePrefix: null,
    hasVariants: false,
  };
}

export function mapProductForCustomerListing(product, defaults = {}) {
  const listing = formatProductForListing(product);

  return {
    ...product,
    ...listing,
    id: product?.id || product?._id,
    image: product?.mainImage || product?.image || defaults.image || DEFAULT_PRODUCT_IMAGE,
    weight: product?.weight || defaults.weight || "1 unit",
    deliveryTime: product?.deliveryTime || defaults.deliveryTime || "8-15 mins",
  };
}

export function resolveDisplayedProductPrice(product, selectedVariant = null) {
  if (selectedVariant) {
    const mrp = Number(selectedVariant.price || 0);
    const sale = Number(selectedVariant.salePrice || 0);
    return {
      unitPrice: effectiveUnitPrice(mrp, sale),
      originalPrice: mrp,
      hasDiscount: sale > 0 && sale < mrp,
    };
  }

  const mrp = Number(product?.originalPrice || product?.price || 0);
  const sale = Number(product?.salePrice || 0);
  const unitPrice = effectiveUnitPrice(mrp, sale);

  return {
    unitPrice,
    originalPrice: mrp,
    hasDiscount: sale > 0 && sale < mrp,
  };
}
