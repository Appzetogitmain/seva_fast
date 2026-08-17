import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// The unique partial index on dedupeKey (whatsappMessage.js) was declared
// with `$ne: ""` in its partialFilterExpression, which MongoDB partial
// indexes don't support — the index silently failed to build on every
// autoIndex run since this model was created, so duplicate sends for the
// same order event / birthday / campaign recipient were never actually
// blocked at the DB layer. This drops any stale index, removes the
// duplicate rows that accumulated as a result, and builds the corrected
// index (which uses `$gt: ""` instead).
async function migrate() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI or MONGODB_URI is not defined in the environment.");
    }
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB:", mongoose.connection.name);

    const collection = mongoose.connection.collection("whatsappmessages");

    const existing = await collection.indexes();
    const staleIndex = existing.find((idx) => idx.key?.dedupeKey === 1);
    if (staleIndex) {
      await collection.dropIndex(staleIndex.name);
      console.log(`Dropped stale index: ${staleIndex.name}`);
    } else {
      console.log("No existing dedupeKey index found.");
    }

    const duplicateGroups = await collection
      .aggregate([
        { $match: { dedupeKey: { $exists: true, $type: "string", $gt: "" } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$dedupeKey",
            ids: { $push: "$_id" },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    let removed = 0;
    for (const group of duplicateGroups) {
      // Keep the oldest record (the one that reflects the first real send
      // attempt), remove the rest.
      const idsToRemove = group.ids.slice(1);
      const result = await collection.deleteMany({ _id: { $in: idsToRemove } });
      removed += result.deletedCount;
      console.log(`  dedupeKey="${group._id}": kept 1, removed ${result.deletedCount} duplicate(s)`);
    }
    console.log(`Removed ${removed} duplicate WhatsAppMessage row(s) across ${duplicateGroups.length} group(s).`);

    await collection.createIndex(
      { dedupeKey: 1 },
      { unique: true, partialFilterExpression: { dedupeKey: { $type: "string", $gt: "" } }, name: "dedupeKey_1" },
    );
    console.log("Created corrected unique index: dedupeKey_1");

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Error migrating WhatsApp dedupe index:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

migrate();
