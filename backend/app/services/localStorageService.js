// Local disk storage for uploaded images, documents and videos.
// Images are re-encoded (compressed WebP, resized, metadata stripped);
// PDFs and videos are stored as-is after their content type is verified.
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import logger from "./logger.js";

let sharpModule;
async function loadSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    sharpModule = (await import("sharp")).default;
  } catch (err) {
    logger.warn("sharp not available, images will be stored uncompressed", { error: err.message });
    sharpModule = null;
  }
  return sharpModule;
}

export function getUploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
}

function getPublicBaseUrl() {
  return String(process.env.PUBLIC_UPLOAD_BASE_URL || "").trim().replace(/\/+$/, "");
}

const intEnv = (name, fallback) => {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export function isLocalStorageReady() {
  return Boolean(getPublicBaseUrl());
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

// Identify the file from its bytes, never from the client-supplied name/mime.
export function detectFileType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  const ascii = (s, e) => buf.toString("latin1", s, e);
  if (ascii(0, 5) === "%PDF-") return { kind: "pdf", ext: "pdf", mime: "application/pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: "image", ext: "jpg", mime: "image/jpeg" };
  if (buf.readUInt32BE(0) === 0x89504e47) return { kind: "image", ext: "png", mime: "image/png" };
  if (ascii(0, 4) === "GIF8") return { kind: "image", ext: "gif", mime: "image/gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", ext: "webp", mime: "image/webp" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "AVI ") return { kind: "video", ext: "avi", mime: "video/x-msvideo" };
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return { kind: "video", ext: "webm", mime: "video/webm" };
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase();
    if (["heic", "heix", "heim", "heis", "mif1", "msf1"].includes(brand)) return { kind: "image", ext: "heic", mime: "image/heic" };
    if (brand === "avif" || brand === "avis") return { kind: "image", ext: "avif", mime: "image/avif" };
    if (brand === "qt  ") return { kind: "video", ext: "mov", mime: "video/quicktime" };
    return { kind: "video", ext: "mp4", mime: "video/mp4" };
  }
  const head = ascii(0, Math.min(buf.length, 1024)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return { kind: "svg", ext: "svg", mime: "image/svg+xml" };
  }
  return null;
}

function sanitizeFolder(folder) {
  const clean = String(folder || "misc")
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => p.replace(/[^a-z0-9_-]/g, ""))
    .filter((p) => p && p !== "." && p !== "..")
    .join("/");
  return clean || "misc";
}

async function compressImage(buffer, type) {
  const sharp = await loadSharp();
  if (!sharp) return null;
  const maxDim = intEnv("UPLOAD_IMAGE_MAX_DIMENSION", 1600);
  const quality = intEnv("UPLOAD_IMAGE_QUALITY", 80);
  const animated = type.ext === "gif" || type.ext === "webp";
  const input = type.kind === "svg"
    ? sharp(buffer, { density: 300, failOn: "none" })
    : sharp(buffer, { animated, failOn: "none" });
  return input
    .rotate() // respect EXIF orientation before metadata is stripped
    .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

async function writeAtomic(dir, name, data) {
  await fs.mkdir(dir, { recursive: true });
  const finalPath = path.join(dir, name);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, data, { flag: "wx" });
  await fs.rename(tmpPath, finalPath);
  return finalPath;
}

/**
 * Save an uploaded file to local disk and return its public URL.
 * Throws a 400 error for files that are not a supported image/PDF/video.
 */
export async function saveToLocalStorage(fileBuffer, folder = "misc", options = {}) {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) throw new Error("PUBLIC_UPLOAD_BASE_URL is not configured");
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) throw badRequest("Uploaded file is empty");

  const type = detectFileType(fileBuffer);
  if (!type) throw badRequest("Unsupported file type. Upload an image (JPG, PNG, WEBP, GIF, HEIC, SVG), a PDF or a video.");

  let data = fileBuffer;
  let ext = type.ext;
  const isImage = type.kind === "image" || type.kind === "svg";

  if (isImage && options.optimize !== false) {
    try {
      const out = await compressImage(fileBuffer, type);
      // Keep the original when re-encoding would not make it smaller (SVG must always be rasterised).
      if (out && (type.kind === "svg" || out.length < fileBuffer.length)) {
        data = out;
        ext = "webp";
      }
    } catch (err) {
      logger.warn("Image compression failed, storing original", { error: err.message, ext: type.ext });
    }
  }
  // Never serve raw SVG from our domain (it can carry scripts).
  if (ext === "svg") throw badRequest("This SVG file could not be processed. Please upload a PNG or JPG instead.");

  const safeFolder = sanitizeFolder(folder);
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const name = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}.${ext}`;
  const relDir = `${safeFolder}/${yyyy}/${mm}`;

  await writeAtomic(path.join(getUploadDir(), ...relDir.split("/")), name, data);

  logger.info("File stored locally", {
    folder: relDir, name, kind: type.kind, originalBytes: fileBuffer.length, storedBytes: data.length,
  });
  return `${baseUrl}/${relDir}/${name}`;
}
