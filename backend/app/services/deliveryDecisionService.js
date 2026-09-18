import Seller from "../models/seller.js";
import { distanceMeters } from "../utils/geoUtils.js";
import { extractIndianPincode, resolveDeliveryPincodeCityState } from "../utils/pincode.js";
import { checkServiceability } from "./shiprocket/shiprocketService.js";
import { estimateLocalDeliveryEtaMinutes } from "./localEtaService.js";
import { DELIVERY_METHOD, PRODUCT_AVAILABILITY } from "../constants/delivery.js";

/**
 * ==========================================================
 *  Automatic delivery-method decision (checkout time)
 * ==========================================================
 * Replaces the old seller-chosen "instant vs scheduled" Product field.
 * The method is now decided per (seller, customer) pair from real
 * distance + live Shiprocket serviceability + per-product shelf life:
 *
 *   1. Customer within the seller's configured service radius -> local rider.
 *   2. Otherwise -> Shiprocket, only if every item is "pan_india"-eligible,
 *      the destination pincode is serviceable, and (for perishable items)
 *      the courier's quoted ETA fits within the product's shelf life.
 *   3. Otherwise -> rejected with a clear reason (caller surfaces to user).
 *
 * This is the *authoritative* check — it always calls Shiprocket live, unlike
 * the cheap heuristic used for product-listing visibility.
 */

export class DeliveryDecisionError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "DeliveryDecisionError";
    this.statusCode = statusCode;
  }
}

// Matches shiprocketOrderService.js's DEFAULT_WEIGHT_KG / resolvePackageFromOrderItems
// exactly — the checkout-time serviceability check must use the same weight
// convention as the eventual shipment creation, or the courier/ETA quoted
// here could differ from what's actually booked later.
const DEFAULT_WEIGHT_KG = 0.5;

function parseWeightKgOrNull(weightStr) {
  const raw = String(weightStr || "").trim();
  if (!raw) return null;
  let val = parseFloat(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(val) || val <= 0) return null;
  if (raw.toLowerCase().includes("gm") || raw.toLowerCase().includes("gram")) {
    val = val / 1000;
  }
  return val;
}

function computeTotalWeightKgForItems(items = []) {
  let total = 0;
  let hasAny = false;
  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const weightKg = parseWeightKgOrNull(item.weight);
    if (weightKg != null) {
      total += weightKg * qty;
      hasAny = true;
    }
  }
  return hasAny && total > 0 ? Number(total.toFixed(3)) : DEFAULT_WEIGHT_KG;
}

function normalizeCourierOptions(serviceabilityResponse) {
  const roots = [
    serviceabilityResponse?.data?.available_courier_companies,
    serviceabilityResponse?.available_courier_companies,
    serviceabilityResponse?.data?.data?.available_courier_companies,
  ];
  for (const list of roots) {
    if (Array.isArray(list)) return list;
  }
  return [];
}

/** Shiprocket returns ETA either as a number of days or an "etd" date string. */
function parseEtaDays(courier) {
  const rawDays = courier?.estimated_delivery_days;
  if (rawDays != null && String(rawDays).trim() !== "") {
    const n = Number(String(rawDays).match(/\d+(\.\d+)?/)?.[0]);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  }
  const etd = courier?.etd;
  if (etd) {
    const asDate = new Date(etd);
    if (!Number.isNaN(asDate.getTime())) {
      const diffDays = (asDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (diffDays > 0) return Math.ceil(diffDays);
    }
  }
  return null;
}

function pickFastestServiceableCourier(courierOptions = []) {
  const withEta = courierOptions
    .map((c) => ({
      etaDays: parseEtaDays(c),
      courierName: String(c?.courier_name || c?.courier_company_name || "").trim(),
    }))
    .filter((c) => Number.isFinite(c.etaDays) && c.etaDays > 0);

  if (!withEta.length) return null;
  withEta.sort((a, b) => a.etaDays - b.etaDays);
  return withEta[0];
}

function hasUsableCoordinates(coords) {
  return (
    Array.isArray(coords) &&
    coords.length >= 2 &&
    Number.isFinite(Number(coords[0])) &&
    Number.isFinite(Number(coords[1])) &&
    !(Math.abs(Number(coords[0])) < 1e-5 && Math.abs(Number(coords[1])) < 1e-5)
  );
}

/**
 * Resolves the delivery method for one seller's items in a checkout.
 * `items` should carry `{ productName, availability, shelfLifeDays, weight, quantity }`.
 */
export async function resolveSellerDeliveryDecision({
  sellerId,
  customerLocation,
  address,
  items = [],
  session = null,
}) {
  const sellerQuery = Seller.findById(sellerId).select(
    "location serviceRadius shopName pincode address locality",
  );
  if (session) sellerQuery.session(session);
  const seller = await sellerQuery.lean();
  if (!seller) {
    throw new DeliveryDecisionError("Seller not found", 404);
  }

  const custLat = Number(customerLocation?.lat);
  const custLng = Number(customerLocation?.lng);
  const hasCustomerCoords = Number.isFinite(custLat) && Number.isFinite(custLng);
  const sellerCoords = seller?.location?.coordinates;
  const hasSellerCoords = hasUsableCoordinates(sellerCoords);

  // No geodata to compare against — don't block checkout, default to local
  // (matches legacy behavior of the old radius check).
  if (!hasCustomerCoords || !hasSellerCoords) {
    const eta = await estimateLocalDeliveryEtaMinutes({
      sellerLat: hasSellerCoords ? Number(sellerCoords[1]) : null,
      sellerLng: hasSellerCoords ? Number(sellerCoords[0]) : null,
      distanceKmToCustomer: 0,
    });
    return {
      method: DELIVERY_METHOD.LOCAL,
      distanceKm: 0,
      localEtaMinMinutes: eta.minMinutes,
      localEtaMaxMinutes: eta.maxMinutes,
      shiprocketEtaDays: null,
      estimatedDeliveryDate: null,
      courierName: null,
    };
  }

  const [sellerLng, sellerLat] = sellerCoords;
  const distanceKm = Number(
    (distanceMeters(custLat, custLng, Number(sellerLat), Number(sellerLng)) / 1000).toFixed(3),
  );
  const radiusKm = Number(seller.serviceRadius || 5);
  const withinRadius = distanceKm <= radiusKm;

  if (withinRadius) {
    const eta = await estimateLocalDeliveryEtaMinutes({
      sellerLat: Number(sellerLat),
      sellerLng: Number(sellerLng),
      distanceKmToCustomer: distanceKm,
    });
    return {
      method: DELIVERY_METHOD.LOCAL,
      distanceKm,
      localEtaMinMinutes: eta.minMinutes,
      localEtaMaxMinutes: eta.maxMinutes,
      shiprocketEtaDays: null,
      estimatedDeliveryDate: null,
      courierName: null,
    };
  }

  // Outside the local radius — every item must be pan-India eligible.
  const localOnlyItem = items.find(
    (item) => item.availability !== PRODUCT_AVAILABILITY.PAN_INDIA,
  );
  if (localOnlyItem) {
    throw new DeliveryDecisionError(
      `"${localOnlyItem.productName || "This item"}" is only available for local delivery and can't be shipped to your address (${distanceKm}km away, ${seller.shopName || "store"}'s local delivery radius is ${radiusKm}km).`,
    );
  }

  const sellerPincode =
    String(seller.pincode || "").trim() || extractIndianPincode(seller.address, seller.locality);
  const deliveryPincode = resolveDeliveryPincodeCityState(address || {}).pincode;

  if (!sellerPincode || sellerPincode.length < 6) {
    throw new DeliveryDecisionError(
      `${seller.shopName || "This store"} has not set up nationwide shipping yet (missing pickup pincode).`,
    );
  }
  if (!deliveryPincode || deliveryPincode.length < 6) {
    throw new DeliveryDecisionError(
      "A valid 6-digit delivery pincode is required to check nationwide shipping.",
    );
  }

  let serviceability;
  try {
    // codAmount omitted here (0): this is a method-eligibility + ETA check,
    // not the final shipment — real COD/courier selection happens again in
    // shiprocketOrderService.createShiprocketShipmentForOrder.
    serviceability = await checkServiceability({
      pickupPostcode: sellerPincode,
      deliveryPostcode: deliveryPincode,
      weightKg: computeTotalWeightKgForItems(items),
      codAmount: 0,
    });
  } catch (err) {
    throw new DeliveryDecisionError(
      `Could not verify nationwide shipping to your pincode right now (${err.message || "Shiprocket error"}). Please try again shortly.`,
      502,
    );
  }

  const courierOptions = normalizeCourierOptions(serviceability);
  if (!courierOptions.length) {
    throw new DeliveryDecisionError(
      `${seller.shopName || "This store"} does not deliver to your address — you're outside its local delivery radius (${distanceKm}km > ${radiusKm}km) and your pincode isn't serviceable by our shipping partner.`,
    );
  }

  const best = pickFastestServiceableCourier(courierOptions);
  const etaDays = best?.etaDays ?? null;

  if (etaDays != null) {
    const tooPerishable = items.find(
      (item) => Number.isFinite(item.shelfLifeDays) && item.shelfLifeDays < etaDays,
    );
    if (tooPerishable) {
      throw new DeliveryDecisionError(
        `"${tooPerishable.productName || "This item"}" has a usable shelf life of ${tooPerishable.shelfLifeDays} day(s), which is shorter than the ${etaDays}-day shipping estimate to your address — it can only be delivered to nearby customers.`,
      );
    }
  }

  const estimatedDeliveryDate =
    etaDays != null ? new Date(Date.now() + etaDays * 24 * 60 * 60 * 1000) : null;

  return {
    method: DELIVERY_METHOD.SHIPROCKET,
    distanceKm,
    localEtaMinMinutes: null,
    localEtaMaxMinutes: null,
    shiprocketEtaDays: etaDays,
    estimatedDeliveryDate,
    courierName: best?.courierName || null,
  };
}
