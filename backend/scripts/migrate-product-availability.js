/**
 * One-time migration: backfill Product.availability from the old, now-removed
 * Product.deliveryType field ("instant" -> "local_only", "scheduled" -> "pan_india").
 * Required before/after deploying the automatic delivery-method feature —
 * without this, all pre-existing products default to "local_only" and any
 * previously "scheduled" (nationwide) products lose Pan India visibility.
 * Run: node scripts/migrate-product-availability.js
 */
import dotenv from "dotenv";
import connectDB from "../app/dbConfig/dbConfig.js";
import Product from "../app/models/product.js";

dotenv.config();

const BATCH_SIZE = 500;

async function run() {
  await connectDB();
  const collection = Product.collection;

  const cursor = collection.find(
    { availability: { $exists: false } },
    { projection: { deliveryType: 1 } },
  );

  let updated = 0;
  let bulk = [];

  for await (const doc of cursor) {
    const availability = doc.deliveryType === "scheduled" ? "pan_india" : "local_only";
    bulk.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { availability }, $unset: { deliveryType: "" } },
      },
    });
    if (bulk.length >= BATCH_SIZE) {
      await collection.bulkWrite(bulk);
      updated += bulk.length;
      bulk = [];
    }
  }
  if (bulk.length) {
    await collection.bulkWrite(bulk);
    updated += bulk.length;
  }

  console.log(`[migrate-product-availability] Updated ${updated} products`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
