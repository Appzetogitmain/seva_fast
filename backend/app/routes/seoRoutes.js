import express from "express";
import fs from "fs/promises";
import Setting from "../models/setting.js";

/**
 * Server-side SEO for the single-page app.
 *
 * Crawlers and link-preview bots (WhatsApp, Facebook, Google) read the raw
 * index.html and don't run our React code, so the title/description set by
 * <SeoHead /> in the browser is invisible to them. This route returns the
 * built index.html with the block between <!-- SEO:START --> and
 * <!-- SEO:END --> replaced by the values from Admin → Settings → SEO.
 *
 * nginx must route HTML page requests here (see README / deploy notes).
 * Template source (first one that works):
 *   - SEO_INDEX_HTML_PATH: absolute path to the built frontend dist/index.html
 *   - SEO_TEMPLATE_URL:    URL nginx serves the raw file at (e.g. https://sevafast.in/index.html)
 */

const router = express.Router();

const TEMPLATE_TTL_MS = 5 * 60 * 1000;
const SETTINGS_TTL_MS = 60 * 1000;
let templateCache = { html: null, at: 0 };
let settingsCache = { data: null, at: 0 };

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function loadTemplate() {
  if (templateCache.html && Date.now() - templateCache.at < TEMPLATE_TTL_MS) {
    return templateCache.html;
  }
  let html = null;
  if (process.env.SEO_INDEX_HTML_PATH) {
    html = await fs.readFile(process.env.SEO_INDEX_HTML_PATH, "utf8");
  } else if (process.env.SEO_TEMPLATE_URL) {
    const res = await fetch(process.env.SEO_TEMPLATE_URL);
    if (!res.ok) throw new Error(`Template fetch failed: ${res.status}`);
    html = await res.text();
  } else {
    throw new Error("SEO_INDEX_HTML_PATH or SEO_TEMPLATE_URL is not configured");
  }
  templateCache = { html, at: Date.now() };
  return html;
}

async function loadSettings() {
  if (settingsCache.data && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.data;
  }
  const data =
    (await Setting.findOne({ $or: [{ tenantId: null }, { tenantId: { $exists: false } }] })
      .select("appName companyName metaTitle metaDescription metaKeywords keywords logoUrl")
      .lean()) || {};
  settingsCache = { data, at: Date.now() };
  return data;
}

function buildSeoBlock(settings, pageUrl) {
  const siteName = settings.appName || "Seva Fast";
  const title = settings.metaTitle || siteName;
  const description = settings.metaDescription || "";
  const keywords =
    Array.isArray(settings.keywords) && settings.keywords.length
      ? settings.keywords.join(", ")
      : settings.metaKeywords || "";
  const image = settings.logoUrl || "";

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    description && `<meta name="description" content="${escapeHtml(description)}" />`,
    keywords && `<meta name="keywords" content="${escapeHtml(keywords)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    description && `<meta property="og:description" content="${escapeHtml(description)}" />`,
    image && `<meta property="og:image" content="${escapeHtml(image)}" />`,
    pageUrl && `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    description && `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    image && `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].filter(Boolean);

  return `<!-- SEO:START -->\n  ${tags.join("\n  ")}\n  <!-- SEO:END -->`;
}

router.get("/html", async (req, res) => {
  let template;
  try {
    template = await loadTemplate();
  } catch (error) {
    console.error("[seo] template unavailable:", error.message);
    return res.status(503).type("text/plain").send("Service unavailable");
  }

  try {
    const settings = await loadSettings();
    if (!settings.metaTitle && !settings.metaDescription) {
      // Admin hasn't filled the SEO page yet — keep the defaults baked into index.html.
      res.set("Cache-Control", "no-cache");
      return res.type("html").send(template);
    }
    // nginx passes the original path; only used for og:url.
    const originalPath = String(req.get("X-Original-URI") || "/").split("?")[0];
    const host = req.get("X-Forwarded-Host") || req.get("host");
    const pageUrl = host ? `https://${host}${originalPath.startsWith("/") ? originalPath : "/"}` : "";
    const html = template.replace(
      /<!-- SEO:START[\s\S]*?<!-- SEO:END -->/,
      buildSeoBlock(settings, pageUrl),
    );
    res.set("Cache-Control", "no-cache");
    return res.type("html").send(html);
  } catch (error) {
    // Never break the site over SEO: fall back to the untouched template.
    console.error("[seo] render failed:", error.message);
    res.set("Cache-Control", "no-cache");
    return res.type("html").send(template);
  }
});

export function clearSeoCache() {
  settingsCache = { data: null, at: 0 };
}

export default router;
