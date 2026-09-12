import admin from "firebase-admin";
import { getFirebaseAdminApp, getFirebaseAppMessagingApp } from "../../config/firebaseAdmin.js";

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

function getMessagingClient(platform = "web") {
  const app = platform === "app" ? getFirebaseAppMessagingApp() : getFirebaseAdminApp();
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

export async function sendFCM(tokens = [], payload = {}, options = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      responses: [],
    };
  }

  const soundEnabled = options.sound !== false;
  const vibrationEnabled = options.vibration !== false;
  const platform = options.platform || "web";

  const messaging = getMessagingClient(platform);
  const data = toStringMap(payload.data || {});
  const link = String(data.link || payload?.data?.link || "").trim();
  const absoluteLink = resolveAbsoluteLink(link);
  // Keep path-only in data when possible so clients navigate on current host.
  if (link && !data.link) data.link = link;
  const title = payload.title || "";
  const body = payload.body || payload.message || "";
  const tag = data.orderId || data.eventType || "quick-commerce";
  const image = resolveImageUrl(payload, data);
  if (!data.title && title) data.title = title;
  if (!data.body && body) data.body = body;
  if (!data.tag && tag) data.tag = tag;

  const chunks = chunkArray(tokens, MAX_FCM_MULTICAST_TOKENS);

  const merged = {
    successCount: 0,
    failureCount: 0,
    responses: [],
  };

  const orderAlert = options.orderAlert === true;
  // Use high_importance_channel as the standard channel to avoid Android silently dropping
  // background notifications when order_alert_channel is not created in the native client APK.
  const configuredChannel = process.env.ANDROID_NOTIFICATION_CHANNEL_ID;
  const androidChannelId = configuredChannel || (orderAlert ? "high_importance_channel" : "high_importance_channel");
  // Always allow defaultSound fallback so that devices without a bundled custom sound file still play sound.
  const androidSound = soundEnabled ? (orderAlert ? "order_alert" : "default") : undefined;
  const apnsSound = soundEnabled ? (orderAlert ? "order_alert.wav" : "default") : undefined;
  const webVibrate = vibrationEnabled
    ? (orderAlert ? [300, 200, 300, 200, 300, 200, 300] : [200, 100, 200])
    : [0];

  // Enrich data payload so Flutter/Android background message handlers have full access
  data.channelId = androidChannelId;
  data.orderAlert = orderAlert ? "true" : "false";
  data.sound = soundEnabled ? "default" : "none";

  for (const chunk of chunks) {
    const result = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title,
        body,
        ...(image ? { image } : {}),
      },
      data,
      android: {
        priority: "high",
        notification: {
          channelId: androidChannelId,
          sound: androidSound,
          defaultSound: soundEnabled,
          defaultVibrateTimings: vibrationEnabled,
          priority: "high",
          visibility: "public",
          ...(image ? { imageUrl: image } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            "content-available": 1,
            sound: apnsSound,
            ...(orderAlert ? { "interruption-level": "time-sensitive" } : {}),
          },
        },
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: String(60 * 60),
        },
        notification: {
          title,
          body,
          tag,
          icon: "/favicon.png",
          badge: "/favicon.png",
          requireInteraction: true,
          renotify: true,
          silent: !soundEnabled,
          vibrate: webVibrate,
          ...(image ? { image } : {}),
          data: {
            link: link || absoluteLink || "/",
            orderId: data.orderId || "",
            eventType: data.eventType || "",
            orderAlert: orderAlert ? "true" : "false",
          },
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
