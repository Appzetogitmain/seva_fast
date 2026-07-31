import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: '../.env' });

import Product from "../app/models/product.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({ "variants.0": { $exists: true } });
  for (const p of products) {
    if (p.variants && p.variants.length > 0) {
      const sum = p.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
      if (p.stock !== sum) {
        console.log(`Fixing product ${p.name} (${p._id}): stock ${p.stock} -> ${sum}`);
        p.stock = sum;
        await p.save();
      }
    }
  }
  console.log("Done");
  process.exit(0);
}

run();
