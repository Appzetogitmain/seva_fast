/**
 * Product availability (seller-facing) vs. delivery method (system-decided).
 * These are deliberately separate concepts — see deliveryDecisionService.js.
 */
export const PRODUCT_AVAILABILITY = {
  LOCAL_ONLY: "local_only",
  PAN_INDIA: "pan_india",
};
export const ALL_PRODUCT_AVAILABILITY = Object.values(PRODUCT_AVAILABILITY);

/**
 * Order.deliveryType keeps its original "instant"/"scheduled" values for
 * backward compatibility with the large amount of existing workflow/finance
 * code that branches on it — it now represents the *computed* delivery
 * method (local rider vs Shiprocket) instead of a seller's manual choice.
 */
export const DELIVERY_METHOD = {
  LOCAL: "instant",
  SHIPROCKET: "scheduled",
};
export const ALL_DELIVERY_METHODS = Object.values(DELIVERY_METHOD);

/**
 * Conservative Shiprocket surface-ETA estimate (days) used ONLY for cheap,
 * listing-time visibility filtering of perishable pan-India products — it
 * avoids a live Shiprocket API call on every product listing request.
 * The authoritative check (live courier ETA vs. shelfLifeDays) happens at
 * checkout time in deliveryDecisionService.js.
 */
export const LISTING_HEURISTIC_SHIPROCKET_ETA_DAYS = 5;
