import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// The reviews collection used to enforce one review per (userId, productId) ever.
// That's now replaced with one review per (userId, productId, orderId), so a
// customer can review a product again each time they re-purchase it. The old
// unique index has to be dropped explicitly — Mongoose won't drop indexes that
// no longer match the schema, it only creates new ones.
async function migrateReviewIndex() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI or MONGODB_URI is not defined in the environment.");
    }
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const collection = mongoose.connection.collection("reviews");

    const indexes = await collection.indexes();
    console.log("Current indexes on reviews:");
    indexes.forEach((idx) => console.log(` - ${idx.name}`, idx.key));

    const oldIndex = indexes.find(
      (idx) => idx.key && idx.key.userId === 1 && idx.key.productId === 1 && !("orderId" in idx.key)
    );
    if (oldIndex) {
      await collection.dropIndex(oldIndex.name);
      console.log(`Dropped stale index: ${oldIndex.name}`);
    } else {
      console.log("Stale userId+productId index not found (already migrated).");
    }

    // Any reviews saved before orderId was required won't have one — they'd
    // violate the new required field on next save, but existing docs are left
    // as-is here since this migration only touches indexes.
    const missingOrderCount = await collection.countDocuments({ orderId: { $in: [null, undefined] } });
    if (missingOrderCount > 0) {
      console.warn(
        `Warning: ${missingOrderCount} existing review(s) have no orderId. They will keep working for reads, ` +
          `but won't be re-saveable until given an orderId (they predate order-scoped reviews).`
      );
    }

    await collection.createIndex({ userId: 1, productId: 1, orderId: 1 }, { unique: true });
    console.log("Ensured new unique index: userId_1_productId_1_orderId_1");

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Error migrating review index:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

migrateReviewIndex();
