import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { seedMasterCategories } from "../app/services/masterCategorySeedService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

async function runSeed() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGO_URI not defined in environment");
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for seeding...");

    const result = await seedMasterCategories();
    console.log("Master categories seeded successfully!", result);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding master categories:", error);
    process.exit(1);
  }
}

runSeed();
