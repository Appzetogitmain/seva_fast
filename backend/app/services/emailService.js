import nodemailer from "nodemailer";
import logger from "./logger.js";

let cachedTransporter = null;

export function useRealEmailOTP() {
  return (
    process.env.USE_REAL_EMAIL_OTP === "true" ||
    process.env.USE_REAL_EMAIL_OTP === "1"
  );
}

function parseSmtpPort() {
  return parseInt(process.env.SMTP_PORT || "587", 10);
}

function parseSmtpSecure(port) {
  if (process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1") {
    return true;
  }

  if (process.env.SMTP_SECURE === "false" || process.env.SMTP_SECURE === "0") {
    return false;
  }

  return port === 465;
}

function getMailFrom() {
  const fromAddress = String(process.env.MAIL_FROM || "").trim();
  const fromName = String(process.env.MAIL_FROM_NAME || "").trim();

  if (!fromAddress) {
    const error = new Error("MAIL_FROM is required for email OTP delivery");
    error.statusCode = 500;
    throw error;
  }

  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

function getTransportConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = parseSmtpPort();
  const secure = parseSmtpSecure(port);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!host) {
    const error = new Error("SMTP_HOST is required for email OTP delivery");
    error.statusCode = 500;
    throw error;
  }

  if (!Number.isFinite(port) || port <= 0) {
    const error = new Error("SMTP_PORT must be a valid number");
    error.statusCode = 500;
    throw error;
  }

  if ((user && !pass) || (!user && pass)) {
    const error = new Error("SMTP_USER and SMTP_PASS must be provided together");
    error.statusCode = 500;
    throw error;
  }

  return {
    host,
    port,
    secure,
    ...(user && pass
      ? {
          auth: {
            user,
            pass,
          },
        }
      : {}),
  };
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(getTransportConfig());
  }

  return cachedTransporter;
}

function isSmtpConfigured() {
  return Boolean(
    String(process.env.SMTP_HOST || "").trim() &&
      String(process.env.MAIL_FROM || "").trim(),
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendSellerVerificationOtpEmail({
  email,
  otp,
  expiresInMinutes,
}) {
  if (!useRealEmailOTP()) {
    logger.info("Seller email OTP generated in mock mode", {
      email,
      otp,
      mode: "mock",
    });
    return {
      delivered: false,
      mode: "mock",
    };
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: getMailFrom(),
    to: email,
    subject: "Verify your seller signup email",
    text: `Your seller signup verification code is ${otp}. This code expires in ${expiresInMinutes} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <p>Your seller signup verification code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
        <p>This code expires in ${expiresInMinutes} minutes.</p>
      </div>
    `,
  });

  return {
    delivered: true,
    mode: "real",
  };
}

export async function sendSellerPasswordResetOtpEmail({
  email,
  otp,
  expiresInMinutes,
}) {
  if (!useRealEmailOTP()) {
    logger.info("Seller password reset OTP generated in mock mode", {
      email,
      otp,
      mode: "mock",
    });
    return {
      delivered: false,
      mode: "mock",
    };
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: getMailFrom(),
    to: email,
    subject: "Reset your seller account password",
    text: `Your seller password reset code is ${otp}. This code expires in ${expiresInMinutes} minutes. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <p>Your seller password reset code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
        <p>This code expires in ${expiresInMinutes} minutes.</p>
        <p>If you did not request this password reset, you can safely ignore this email.</p>
      </div>
    `,
  });

  return {
    delivered: true,
    mode: "real",
  };
}

/**
 * Send seller approval email with Authorized Seller Certificate PDF attached.
 */
export async function sendSellerApprovalEmail({
  email,
  sellerName,
  shopName,
  sellerId,
  mobile,
  certificateNo,
  issueDate,
  certificatePdf,
  certificateFilename,
}) {
  const safeName = escapeHtml(sellerName || "Seller");
  const safeShop = escapeHtml(shopName || "-");
  const safeSellerId = escapeHtml(sellerId || "-");
  const safeMobile = escapeHtml(mobile || "-");
  const safeCertNo = escapeHtml(certificateNo || "-");
  const safeIssueDate = escapeHtml(issueDate || "-");

  const subject = "Your SEVAFAST seller account has been approved";
  const text = [
    `Congratulations ${sellerName || "Seller"}!`,
    "",
    "Your seller application has been approved. You are now an Authorized Seller and Verified Business Partner of SEVAFAST.",
    "",
    `Shop / Business: ${shopName || "-"}`,
    `Seller ID: ${sellerId || "-"}`,
    `Mobile: ${mobile || "-"}`,
    `Certificate No: ${certificateNo || "-"}`,
    `Issue Date: ${issueDate || "-"}`,
    "",
    "Your Authorized Seller Certificate is attached to this email.",
    "You can now log in to the seller panel and start selling.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin: 0 0 12px; color: #ea580c;">Congratulations, ${safeName}!</h2>
      <p style="margin: 0 0 12px;">
        Your seller application has been <strong>approved</strong>. You are now an
        <strong>Authorized Seller</strong> and <strong>Verified Business Partner</strong> of SEVAFAST.
      </p>
      <table style="border-collapse: collapse; margin: 16px 0; width: 100%; max-width: 520px;">
        <tr><td style="padding: 6px 0; color: #64748b;">Shop / Business</td><td style="padding: 6px 0; font-weight: 700;">${safeShop}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Seller ID</td><td style="padding: 6px 0; font-weight: 700;">${safeSellerId}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Mobile</td><td style="padding: 6px 0; font-weight: 700;">${safeMobile}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Certificate No.</td><td style="padding: 6px 0; font-weight: 700;">${safeCertNo}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Issue Date</td><td style="padding: 6px 0; font-weight: 700;">${safeIssueDate}</td></tr>
      </table>
      <p style="margin: 0 0 8px;">Your <strong>Authorized Seller Certificate</strong> is attached as a PDF.</p>
      <p style="margin: 0;">You can now log in to the seller panel and start selling.</p>
    </div>
  `;

  if (!isSmtpConfigured()) {
    logger.info("Seller approval email skipped (SMTP not configured)", {
      email,
      certificateNo,
      mode: "mock",
    });
    return {
      delivered: false,
      mode: "mock",
    };
  }

  const transporter = getTransporter();
  const mailOptions = {
    from: getMailFrom(),
    to: email,
    subject,
    text,
    html,
  };

  if (certificatePdf?.length) {
    mailOptions.attachments = [
      {
        filename:
          certificateFilename ||
          `SEVAFAST-Authorized-Seller-Certificate-${certificateNo || "approved"}.pdf`,
        content: certificatePdf,
        contentType: "application/pdf",
      },
    ];
  }

  await transporter.sendMail(mailOptions);

  return {
    delivered: true,
    mode: "real",
  };
}

export function __resetEmailTransportForTests() {
  cachedTransporter = null;
}
