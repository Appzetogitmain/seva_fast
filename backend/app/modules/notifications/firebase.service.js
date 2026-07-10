import admin from "firebase-admin";
import { getFirebaseAdminApp } from "../../config/firebaseAdmin.js";

const MAX_FCM_MULTICAST_TOKENS = 500;

function toStringMap(data = {}) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value == null) continue;
    if (typeof value === "string") {
      out[key] = value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
      continue;
    }
    out[key] = JSON.stringify(value);
  }
  return out;
}

function chunkArray(input = [], size = MAX_FCM_MULTICAST_TOKENS) {
  const chunks = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
}

function getMessagingClient() {
  const app = getFirebaseAdminApp();
  if (!app) {
    const err = new Error("Firebase Admin is not configured for push notifications");
    err.code = "fcm/not-configured";
    throw err;
  }
  return admin.messaging(app);
}

function isWebLink(value = "") {
  const link = String(value || "").trim();
  return /^https?:\/\//i.test(link);
}

function resolveAbsoluteLink(link = "") {
  const raw = String(link || "").trim();
  if (!raw) return "";
  if (isWebLink(raw)) return raw;
  const base = String(
    process.env.FRONTEND_URL || process.env.WEB_APP_URL || "",
  )
    .trim()
    .replace(/\/+$/, "");
  // Never invent localhost — relative path stays in data for SW/same-origin navigation.
  if (!base) return "";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

function resolveImageUrl(payload = {}, data = {}) {
  const fromData = String(
    data.imageUrl ||
      data.image ||
      payload?.imageUrl ||
      payload?.image ||
      "",
  ).trim();
  return isWebLink(fromData) ? fromData : "";
}

export async function sendFCM(tokens = [], payload = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      responses: [],
    };
  }

  const messaging = getMessagingClient();
  const data = toStringMap(payload.data || {});
  const link = String(data.link || payload?.data?.link || "").trim();
  const absoluteLink = resolveAbsoluteLink(link);
  // Keep path-only in data when possible so clients navigate on current host.
  if (link && !data.link) data.link = link;
  const title = payload.title || "";
  const body = payload.body || payload.message || "";
  const tag = data.orderId || data.eventType || "quick-commerce";
  const image = resolveImageUrl(payload, data);
  const chunks = chunkArray(tokens, MAX_FCM_MULTICAST_TOKENS);

  const merged = {
    successCount: 0,
    failureCount: 0,
    responses: [],
  };

  for (const chunk of chunks) {
    const result = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title,
        body,
        ...(image ? { image } : {}),
      },
      data,
      webpush: {
        headers: {
          Urgency: "high",
          TTL: String(60 * 60),
        },
        notification: {
          title,
          body,
          tag,
          requireInteraction: true,
          ...(image ? { image } : {}),
          data: { link: link || absoluteLink || "/" },
        },
        // Only set absolute fcmOptions when FRONTEND_URL is configured (avoid localhost).
        fcmOptions: absoluteLink ? { link: absoluteLink } : undefined,
      },
    });

    merged.successCount += Number(result.successCount || 0);
    merged.failureCount += Number(result.failureCount || 0);
    merged.responses.push(...(result.responses || []));
  }

  return merged;
}

export default {
  sendFCM,
};
