/**
 * Copy every Cloudinary file referenced in MongoDB to local storage and
 * rewrite the links. Cloudinary files are NOT deleted.
 *
 *   node scripts/migrateCloudinaryToLocal.js            # dry run: report only
 *   node scripts/migrateCloudinaryToLocal.js --apply    # download + update DB
 *
 * Requires in .env: MONGO_URI, PUBLIC_UPLOAD_BASE_URL, UPLOAD_DIR (optional).
 * Writes scripts/cloudinary-migration-<timestamp>.json with old -> new URLs
 * so the change can be reversed. Safe to re-run: already-migrated links are skipped.
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { saveToLocalStorage } = await import("../app/services/localStorageService.js");

const APPLY = process.argv.includes("--apply");
const URL_RE = /https?:\/\/res\.cloudinary\.com\/[^\s"'<>)]+/g;

if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing");
if (APPLY && !process.env.PUBLIC_UPLOAD_BASE_URL) throw new Error("PUBLIC_UPLOAD_BASE_URL missing");

// products/abc.jpg -> "products"; keeps the original folder layout, minus Cloudinary's version/transform parts.
function folderFromUrl(url) {
  const afterUpload = url.split(/\/upload\//)[1] || "";
  const parts = afterUpload.split("/").filter((p) => !/^v\d+$/.test(p) && !p.includes(","));
  parts.pop(); // file name
  return parts.length ? parts.join("/") : "migrated";
}

function collectUrls(value, found) {
  if (typeof value === "string") {
    for (const m of value.matchAll(URL_RE)) found.add(m[0]);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectUrls(v, found));
  } else if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value) && value._bsontype === undefined) {
    Object.values(value).forEach((v) => collectUrls(v, found));
  }
}

function rewrite(value, map) {
  if (typeof value === "string") return value.replace(URL_RE, (u) => map.get(u) || u);
  if (Array.isArray(value)) return value.map((v) => rewrite(v, map));
  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value) && value._bsontype === undefined) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewrite(v, map);
    return out;
  }
  return value;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const collections = (await db.listCollections().toArray())
  .map((c) => c.name)
  .filter((n) => !n.startsWith("system."));

// 1. Find every referenced Cloudinary URL.
const perCollection = {};
const allUrls = new Set();
for (const name of collections) {
  const found = new Set();
  for await (const doc of db.collection(name).find({})) collectUrls(doc, found);
  if (found.size) {
    perCollection[name] = found.size;
    found.forEach((u) => allUrls.add(u));
  }
}
console.log("Cloudinary links per collection:", perCollection);
console.log(`Unique files to copy: ${allUrls.size}`);
if (!APPLY) {
  console.log("\nDry run only. Re-run with --apply to copy files and update the database.");
  await mongoose.disconnect();
  process.exit(0);
}

// 2. Copy each file to local storage.
const map = new Map();
const failed = [];
let i = 0;
for (const url of allUrls) {
  i += 1;
  try {
    const buf = await download(url);
    const newUrl = await saveToLocalStorage(buf, folderFromUrl(url));
    map.set(url, newUrl);
    console.log(`[${i}/${allUrls.size}] ok   ${url}`);
  } catch (err) {
    failed.push({ url, error: err.message });
    console.log(`[${i}/${allUrls.size}] FAIL ${url} (${err.message}) - link left unchanged`);
  }
}

const logFile = path.join(__dirname, `cloudinary-migration-${Date.now()}.json`);
fs.writeFileSync(logFile, JSON.stringify({ migrated: Object.fromEntries(map), failed }, null, 2));
console.log(`\nMapping saved to ${logFile}`);

// 3. Rewrite links in the database (only fields that actually change).
let updatedDocs = 0;
for (const name of Object.keys(perCollection)) {
  const coll = db.collection(name);
  for await (const doc of coll.find({})) {
    const set = {};
    for (const [key, value] of Object.entries(doc)) {
      if (key === "_id") continue;
      const found = new Set();
      collectUrls(value, found);
      if (![...found].some((u) => map.has(u))) continue;
      set[key] = rewrite(value, map);
    }
    if (Object.keys(set).length) {
      await coll.updateOne({ _id: doc._id }, { $set: set });
      updatedDocs += 1;
    }
  }
}

console.log(`\nDone. Files copied: ${map.size}, failed: ${failed.length}, documents updated: ${updatedDocs}`);
await mongoose.disconnect();
