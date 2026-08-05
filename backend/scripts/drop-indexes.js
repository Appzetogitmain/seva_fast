import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../app/models/product.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function dropIndexes() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI or MONGODB_URI is not defined in the environment.");
    }
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const collection = mongoose.connection.collection("products");

    // Get current indexes
    const indexes = await collection.indexes();
    console.log("Current indexes on products:");
    indexes.forEach((idx) => console.log(` - ${idx.name}`));

    // Drop slug_1 if it exists
    const hasSlugIndex = indexes.find((idx) => idx.name === "slug_1");
    if (hasSlugIndex) {
      await collection.dropIndex("slug_1");
      console.log("Dropped index: slug_1");
    } else {
      console.log("Index slug_1 not found.");
    }

    // Drop sku_1 if it exists
    const hasSkuIndex = indexes.find((idx) => idx.name === "sku_1");
    if (hasSkuIndex) {
      await collection.dropIndex("sku_1");
      console.log("Dropped index: sku_1");
    } else {
      console.log("Index sku_1 not found.");
    }

    // Also check for variant sku index, though it's typically named variants.sku_1
    const hasVariantSkuIndex = indexes.find((idx) => idx.name === "variants.sku_1");
    if (hasVariantSkuIndex) {
      await collection.dropIndex("variants.sku_1");
      console.log("Dropped index: variants.sku_1");
    }

    console.log("Completed index dropping successfully.");
  } catch (error) {
    console.error("Error dropping indexes:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

dropIndexes();
