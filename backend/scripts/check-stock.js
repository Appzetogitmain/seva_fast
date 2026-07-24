import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: '../.env' });

import Product from "../app/models/product.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const p = await Product.findOne({ "variants.sku": "rice-002" });
  if (p) {
    console.log(JSON.stringify({
      id: p._id,
      name: p.name,
      stock: p.stock,
      variants: p.variants.map(v => ({ sku: v.sku, stock: v.stock }))
    }, null, 2));
  } else {
    console.log("Not found");
  }
  process.exit(0);
}

run();
