import mongoose from "mongoose";
import Zone from "../models/zone.js";

/**
 * Zones are named after cities (e.g. "Indore", "Parbhani") and have no map
 * boundaries, so a seller's zone is found by matching their city to a zone
 * name. Orders inherit the seller's zone. Cached for a minute.
 */
const TTL_MS = 60 * 1000;
let cache = { byName: null, at: 0 };

const normalize = (value) => String(value || "").trim().toLowerCase();

async function zoneMap() {
  if (cache.byName && Date.now() - cache.at < TTL_MS) return cache.byName;

  const zones = await Zone.find({ status: { $ne: "inactive" } }).select("_id name").lean();
  const byName = new Map(zones.map((z) => [normalize(z.name), z._id]));
  cache = { byName, at: Date.now() };
  return byName;
}

export function clearZoneResolverCache() {
  cache = { byName: null, at: 0 };
}

/** Zone _id whose name matches the given city (case-insensitive), or null. */
export async function resolveZoneIdByCity(city) {
  const key = normalize(city);
  if (!key) return null;
  try {
    const byName = await zoneMap();
    return byName.get(key) || null;
  } catch {
    return null;
  }
}

/** Zone _id for a seller: their stored zone, else matched from their city. */
export async function resolveSellerZoneId(sellerId) {
  if (!sellerId) return null;
  try {
    const Seller = mongoose.model("Seller");
    const seller = await Seller.findById(sellerId).select("zoneId city").lean();
    if (!seller) return null;
    return seller.zoneId || (await resolveZoneIdByCity(seller.city));
  } catch {
    return null;
  }
}
