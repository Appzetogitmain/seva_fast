import axios from "axios";

/**
 * ==========================================================
 *  Shiprocket low-level API client (platform account)
 * ==========================================================
 * Env vars (shared across all sellers — multi-vendor marketplace):
 *   SHIPROCKET_EMAIL
 *   SHIPROCKET_PASSWORD
 *   SHIPROCKET_BASE_URL  -> host or full API root
 *                          e.g. https://apiv2.shiprocket.in
 *                          or   https://apiv2.shiprocket.in/v1/external
 *
 * Per-seller pickup addresses are registered separately via
 * addPickupLocation() — not via env.
 */

function resolveShiprocketBaseUrl() {
  const raw = String(
    process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external",
  )
    .trim()
    .replace(/\/+$/, "");

  if (raw.endsWith("/v1/external")) return raw;
  return `${raw}/v1/external`;
}

const SHIPROCKET_BASE_URL = resolveShiprocketBaseUrl();

const tokenCache = {
  token: null,
  expiresAt: 0,
};

const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;

class ShiprocketError extends Error {
  constructor(message, { statusCode = 500, details = null } = {}) {
    super(message);
    this.name = "ShiprocketError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function authenticate(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && tokenCache.token && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new ShiprocketError(
      "Shiprocket credentials are not configured (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD)",
      { statusCode: 500 },
    );
  }

  try {
    const { data } = await axios.post(
      `${SHIPROCKET_BASE_URL}/auth/login`,
      { email, password },
      { timeout: 15000 },
    );

    if (!data?.token) {
      throw new ShiprocketError("Shiprocket auth did not return a token", {
        statusCode: 502,
        details: data,
      });
    }

    tokenCache.token = data.token;
    tokenCache.expiresAt = now + TOKEN_TTL_MS;
    return tokenCache.token;
  } catch (err) {
    if (err instanceof ShiprocketError) throw err;
    const apiMessage = err.response?.data?.message;
    throw new ShiprocketError(
      apiMessage
        ? `Shiprocket authentication failed: ${apiMessage}`
        : "Shiprocket authentication failed",
      {
        statusCode: err.response?.status || 502,
        details: err.response?.data,
      },
    );
  }
}

async function request({ method, path, data, params, _retried = false }) {
  const token = await authenticate();

  try {
    const response = await axios({
      method,
      url: `${SHIPROCKET_BASE_URL}${path}`,
      data,
      params,
      timeout: 20000,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (err) {
    const status = err.response?.status;

    if (status === 401 && !_retried) {
      await authenticate(true);
      return request({ method, path, data, params, _retried: true });
    }

    throw new ShiprocketError(
      err.response?.data?.message || "Shiprocket API request failed",
      {
        statusCode: status || 502,
        details: err.response?.data,
      },
    );
  }
}

export async function checkServiceability({
  pickupPostcode,
  deliveryPostcode,
  weightKg = 0.5,
  codAmount = 0,
}) {
  return request({
    method: "get",
    path: "/courier/serviceability/",
    params: {
      pickup_postcode: pickupPostcode,
      delivery_postcode: deliveryPostcode,
      weight: weightKg,
      cod: codAmount > 0 ? 1 : 0,
    },
  });
}

export async function createAdhocOrder(payload) {
  return request({
    method: "post",
    path: "/orders/create/adhoc",
    data: payload,
  });
}

export async function assignAWB({ shipmentId, courierId }) {
  return request({
    method: "post",
    path: "/courier/assign/awb",
    data: {
      shipment_id: shipmentId,
      ...(courierId ? { courier_id: courierId } : {}),
    },
  });
}

export async function generatePickup({ shipmentIds }) {
  return request({
    method: "post",
    path: "/courier/generate/pickup",
    data: { shipment_id: shipmentIds },
  });
}

export async function generateLabel({ shipmentIds }) {
  return request({
    method: "post",
    path: "/courier/generate/label",
    data: { shipment_id: shipmentIds },
  });
}

export async function generateInvoice({ orderIds }) {
  return request({
    method: "post",
    path: "/orders/print/invoice",
    data: { ids: orderIds },
  });
}

export async function trackByAWB(awbCode) {
  return request({
    method: "get",
    path: `/courier/track/awb/${awbCode}`,
  });
}

export async function trackByShipmentId(shipmentId) {
  return request({
    method: "get",
    path: `/courier/track/shipment/${shipmentId}`,
  });
}

export async function cancelOrders(shiprocketOrderIds) {
  return request({
    method: "post",
    path: "/orders/cancel",
    data: { ids: shiprocketOrderIds },
  });
}

export async function createReturnOrder(payload) {
  return request({
    method: "post",
    path: "/orders/create/return",
    data: payload,
  });
}

export async function addPickupLocation(payload) {
  return request({
    method: "post",
    path: "/settings/company/addpickup",
    data: payload,
  });
}

export { ShiprocketError, resolveShiprocketBaseUrl };
