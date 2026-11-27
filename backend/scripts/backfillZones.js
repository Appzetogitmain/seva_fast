/**
 * One-time backfill: give existing sellers, orders and riders a zone.
 *
 *   node scripts/backfillZones.js          # dry run: prints what would change
 *   node scripts/backfillZones.js --apply  # writes the changes
 *
 * Rules (only records with NO zone are touched; nothing is overwritten):
 *   1. Seller → zone whose name matches the seller's city (case-insensitive).
 *   2. Order  → its seller's zone.
 *   3. Rider  → the zone most of their delivered/assigned orders are in.
 */
import "dotenv/config";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const sellers = db.collection("sellers");
const orders = db.collection("orders");
const riders = db.collection("deliveries");

const norm = (v) => String(v || "").trim().toLowerCase();
const zones = await db.collection("zones").find({ status: { $ne: "inactive" } }).toArray();
const zoneByName = new Map(zones.map((z) => [norm(z.name), z]));
const zoneName = new Map(zones.map((z) => [String(z._id), z.name]));
console.log(`Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no changes)"}`);
console.log(`Zones: ${zones.map((z) => z.name).join(", ")}\n`);

// 1. Sellers
const sellerZone = new Map();
const unmatchedSellers = [];
let sellerUpdates = 0;
for (const s of await sellers.find({}, { projection: { shopName: 1, city: 1, zoneId: 1 } }).toArray()) {
  if (s.zoneId) {
    sellerZone.set(String(s._id), s.zoneId);
    continue;
  }
  const z = zoneByName.get(norm(s.city));
  if (!z) {
    unmatchedSellers.push(`${s.shopName || s._id} (city: ${s.city || "—"})`);
    continue;
  }
  sellerZone.set(String(s._id), z._id);
  sellerUpdates += 1;
  if (APPLY) await sellers.updateOne({ _id: s._id, zoneId: { $in: [null] } }, { $set: { zoneId: z._id } });
}
console.log(`Sellers: ${sellerUpdates} get a zone; ${unmatchedSellers.length} have no matching zone:`);
unmatchedSellers.forEach((x) => console.log(`   - ${x}`));

// 2. Orders
const perZone = {};
let orderUpdates = 0;
let orderNoZone = 0;
for (const o of await orders.find({ $or: [{ zoneId: null }, { zoneId: { $exists: false } }] }, { projection: { seller: 1 } }).toArray()) {
  const z = sellerZone.get(String(o.seller));
  if (!z) {
    orderNoZone += 1;
    continue;
  }
  orderUpdates += 1;
  perZone[zoneName.get(String(z))] = (perZone[zoneName.get(String(z))] || 0) + 1;
  if (APPLY) await orders.updateOne({ _id: o._id }, { $set: { zoneId: z } });
}
console.log(`\nOrders: ${orderUpdates} get their seller's zone ${JSON.stringify(perZone)}; ${orderNoZone} stay without a zone (seller has none).`);

// 3. Riders (by the zone most of their orders are in)
let riderUpdates = 0;
const ridersNoZone = [];
for (const r of await riders.find({ $or: [{ zoneId: null }, { zoneId: { $exists: false } }] }, { projection: { name: 1 } }).toArray()) {
  const counts = {};
  for (const o of await orders.find({ deliveryBoy: r._id }, { projection: { seller: 1, zoneId: 1 } }).toArray()) {
    const z = o.zoneId || sellerZone.get(String(o.seller));
    if (z) counts[String(z)] = (counts[String(z)] || 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!best) {
    ridersNoZone.push(r.name || String(r._id));
    continue;
  }
  riderUpdates += 1;
  if (APPLY) await riders.updateOne({ _id: r._id }, { $set: { zoneId: new mongoose.Types.ObjectId(best[0]) } });
}
console.log(`\nRiders: ${riderUpdates} get a zone from their orders; ${ridersNoZone.length} have no zoned orders (set them in Admin → Delivery Drivers → Edit):`);
ridersNoZone.forEach((x) => console.log(`   - ${x}`));

await mongoose.disconnect();
