import Delivery from "../models/delivery.js";
import { distanceMeters } from "../utils/geoUtils.js";

/**
 * ==========================================================
 *  Local (instant/rider) delivery ETA estimation
 * ==========================================================
 * Produces a dynamic minutes range instead of a fixed "15-20 min" string.
 * Inputs: distance from seller's nearest online rider to the store, plus
 * store-to-customer distance, plus a fixed store processing/packing time.
 * All tunable via env vars — no code change needed to retune.
 */

const STORE_PROCESSING_MINUTES = () =>
  Number(process.env.LOCAL_ETA_STORE_PROCESSING_MINUTES || 8);
const AVG_RIDER_SPEED_KMPH = () =>
  Number(process.env.LOCAL_ETA_AVG_SPEED_KMPH || 20);
const RIDER_SEARCH_RADIUS_KM = () =>
  Number(process.env.LOCAL_ETA_RIDER_SEARCH_RADIUS_KM || 8);
// Used only when no online rider is found nearby (e.g. off-peak hours) —
// a conservative assumption for how long it'll take a rider to become
// available and reach the store once broadcast goes out.
const NO_RIDER_FALLBACK_PICKUP_MINUTES = () =>
  Number(process.env.LOCAL_ETA_FALLBACK_PICKUP_MINUTES || 12);

function minutesForDistanceKm(distanceKm, speedKmph) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  return (distanceKm / speedKmph) * 60;
}

/** Nearest online rider's straight-line distance to the store, in km (or null). */
async function findNearestOnlineRiderDistanceKm(sellerLat, sellerLng, radiusKm) {
  try {
    const riders = await Delivery.find({
      isOnline: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [sellerLng, sellerLat] },
          $maxDistance: radiusKm * 1000,
        },
      },
    })
      .select("location")
      .limit(5)
      .lean();

    let nearestKm = null;
    for (const rider of riders) {
      const coords = rider?.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const [lng, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) continue;
      const km = distanceMeters(sellerLat, sellerLng, lat, lng) / 1000;
      if (nearestKm === null || km < nearestKm) nearestKm = km;
    }
    return nearestKm;
  } catch (e) {
    console.warn("[localEtaService] nearest rider lookup failed:", e.message);
    return null;
  }
}

/**
 * Returns a { minMinutes, maxMinutes } ETA window for a local/instant order.
 * `sellerLat`/`sellerLng` may be null when the seller hasn't set a store
 * location yet — in that case we skip the rider lookup and fall back to the
 * generic pickup estimate.
 */
export async function estimateLocalDeliveryEtaMinutes({
  sellerLat,
  sellerLng,
  distanceKmToCustomer = 0,
}) {
  const speed = AVG_RIDER_SPEED_KMPH();
  const processingMinutes = STORE_PROCESSING_MINUTES();

  const hasSellerCoords = Number.isFinite(sellerLat) && Number.isFinite(sellerLng);
  const nearestRiderKm = hasSellerCoords
    ? await findNearestOnlineRiderDistanceKm(sellerLat, sellerLng, RIDER_SEARCH_RADIUS_KM())
    : null;

  const riderToStoreMinutes =
    nearestRiderKm !== null
      ? minutesForDistanceKm(nearestRiderKm, speed)
      : NO_RIDER_FALLBACK_PICKUP_MINUTES();

  const storeToCustomerMinutes = minutesForDistanceKm(distanceKmToCustomer, speed);

  const bestCase = processingMinutes + riderToStoreMinutes * 0.7 + storeToCustomerMinutes * 0.85;
  const worstCase = processingMinutes + riderToStoreMinutes * 1.4 + storeToCustomerMinutes * 1.4 + 5;

  const minMinutes = Math.max(5, Math.round(bestCase));
  const maxMinutes = Math.max(minMinutes + 5, Math.round(worstCase));

  return { minMinutes, maxMinutes, hasNearbyRiderData: nearestRiderKm !== null };
}
