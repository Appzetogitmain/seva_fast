import { PRODUCT_AVAILABILITY, LISTING_HEURISTIC_SHIPROCKET_ETA_DAYS } from "../constants/delivery.js";

/**
 * Cheap, listing-time-only visibility check for whether a "pan_india"
 * product should bypass the local-radius filter and be shown to a distant
 * customer. Perishable pan-India products (shelfLifeDays set) are hidden
 * from far-away customers if their shelf life looks too short to survive a
 * typical Shiprocket surface transit — this is a conservative heuristic,
 * not a live courier lookup (that would be too slow/expensive per listing
 * request). The authoritative, live-ETA check happens again at checkout in
 * deliveryDecisionService.js, which can still reject the item at that point.
 */
export function isPanIndiaEligibleForListing(product) {
  if (!product || product.availability !== PRODUCT_AVAILABILITY.PAN_INDIA) return false;
  const shelfLifeDays = product.shelfLifeDays;
  if (shelfLifeDays == null) return true;
  return Number(shelfLifeDays) >= LISTING_HEURISTIC_SHIPROCKET_ETA_DAYS;
}

/**
 * Mongo filter fragment: matches products that should show to a customer
 * regardless of their distance from the seller (used alongside a
 * `sellerId in nearbySellerIds` local-radius condition).
 */
export function buildPanIndiaListingFilter() {
  return {
    availability: PRODUCT_AVAILABILITY.PAN_INDIA,
    $or: [
      { shelfLifeDays: null },
      { shelfLifeDays: { $gte: LISTING_HEURISTIC_SHIPROCKET_ETA_DAYS } },
    ],
  };
}

/**
 * True when a product (already fetched, e.g. for a detail page or AI
 * add-to-cart tool) is deliverable to a customer given whether they're
 * within the seller's local radius.
 */
export function isProductDeliverableToCustomer(product, { withinLocalRadius }) {
  if (withinLocalRadius) return true;
  return isPanIndiaEligibleForListing(product);
}
