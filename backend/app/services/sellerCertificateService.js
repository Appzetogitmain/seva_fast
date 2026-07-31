import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.resolve(
  __dirname,
  "../../assets/certificates/authorized-seller-certificate-template.jpg",
);

const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const IMG_WIDTH = 724;
const SCALE = PAGE_WIDTH / IMG_WIDTH;

function px(x) {
  return x * SCALE;
}

function formatIssueDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function buildSellerCertificateNumber(seller) {
  const code = String(seller?.sellerCode || seller?._id || "SELLER")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toUpperCase();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SF-CERT-${code}-${stamp}`;
}

/**
 * Generate a filled Authorized Seller Certificate PDF buffer.
 * Text is overlaid on the official SEVAFAST certificate artwork.
 */
export async function generateSellerCertificatePdf(seller) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    const error = new Error("Seller certificate template is missing");
    error.statusCode = 500;
    throw error;
  }

  const certificateNo = buildSellerCertificateNumber(seller);
  const issueDate = formatIssueDate(seller?.reviewedAt || new Date());
  const sellerName = String(seller?.name || "-").trim();
  const shopName = String(seller?.shopName || "-").trim();
  const sellerId = String(seller?.sellerCode || seller?._id || "-").trim();
  const mobile = String(seller?.phone || "-").trim();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: "Authorized Seller Certificate",
        Author: "SEVAFAST",
        Subject: `Certificate for ${sellerName}`,
      },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () =>
      resolve({
        buffer: Buffer.concat(chunks),
        certificateNo,
        issueDate,
        filename: `SEVAFAST-Authorized-Seller-Certificate-${certificateNo}.pdf`,
      }),
    );
    doc.on("error", reject);

    doc.image(TEMPLATE_PATH, 0, 0, {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });

    // Coordinates mapped from template underlines (724x1024 artwork).
    const textAboveLine = 13;
    doc.fillColor("#111827");
    doc.font("Helvetica-Bold").fontSize(10);

    // Certificate No. + Issue Date (same row)
    doc.text(certificateNo, px(186), px(500) - textAboveLine, {
      width: px(180),
      lineBreak: false,
    });
    doc.text(issueDate, px(500), px(500) - textAboveLine, {
      width: px(160),
      lineBreak: false,
    });

    doc.fontSize(11);
    doc.text(sellerName, px(336), px(620) - textAboveLine, {
      width: px(300),
      lineBreak: false,
    });
    doc.text(shopName, px(336), px(676) - textAboveLine, {
      width: px(300),
      lineBreak: false,
    });
    doc.text(sellerId, px(336), px(732) - textAboveLine, {
      width: px(300),
      lineBreak: false,
    });
    doc.text(mobile, px(336), px(788) - textAboveLine, {
      width: px(300),
      lineBreak: false,
    });

    doc.end();
  });
}
