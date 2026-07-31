import Order from "../../models/order.js";
import Seller from "../../models/seller.js";
import Customer from "../../models/customer.js";
import Product from "../../models/product.js";
import { extractIndianPincode, parseCityStatePincode } from "../../utils/pincode.js";
import {
  checkServiceability,
  createAdhocOrder,
  assignAWB,
  generatePickup,
  cancelOrders,
  trackByShipmentId,
  addPickupLocation,
  ShiprocketError,
} from "./shiprocketService.js";

/**
 * ==========================================================
 *  Order <-> Shiprocket orchestration (multi-vendor)
 * ==========================================================
 * Platform credentials live in env. Each seller has their own
 * Shiprocket pickup location nickname (seller shop address).
 * Customer address is delivery/billing only.
 */

const DEFAULT_WEIGHT_KG = 0.5;
const DEFAULT_DIMENSIONS_CM = { length: 15, breadth: 15, height: 10 };

function toShiprocketDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function splitName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || ".",
  };
}

function parseWeightKg(weightStr, fallback = DEFAULT_WEIGHT_KG) {
  const raw = String(weightStr || "").trim();
  if (!raw) return fallback;
  let val = parseFloat(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(val) || val <= 0) return fallback;
  if (raw.toLowerCase().includes("gm") || raw.toLowerCase().includes("gram")) {
    val = val / 1000;
  }
  return val;
}

/**
 * Aggregate package weight/dims from order line items for Shiprocket.
 * Weight is summed; L/B take max across items; height stacks by quantity.
 */
function resolvePackageFromOrderItems(items = []) {
  let totalWeightKg = 0;
  let maxLength = 0;
  let maxBreadth = 0;
  let totalHeight = 0;
  let hasAnyDim = false;

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    totalWeightKg += parseWeightKg(item.weight, 0) * qty;

    const length = Number(item.packageLength);
    const breadth = Number(item.packageBreadth);
    const height = Number(item.packageHeight);

    if (Number.isFinite(length) && length > 0) {
      maxLength = Math.max(maxLength, length);
      hasAnyDim = true;
    }
    if (Number.isFinite(breadth) && breadth > 0) {
      maxBreadth = Math.max(maxBreadth, breadth);
      hasAnyDim = true;
    }
    if (Number.isFinite(height) && height > 0) {
      totalHeight += height * qty;
      hasAnyDim = true;
    }
  }

  return {
    length: hasAnyDim && maxLength > 0 ? maxLength : DEFAULT_DIMENSIONS_CM.length,
    breadth: hasAnyDim && maxBreadth > 0 ? maxBreadth : DEFAULT_DIMENSIONS_CM.breadth,
    height: hasAnyDim && totalHeight > 0 ? totalHeight : DEFAULT_DIMENSIONS_CM.height,
    weight: totalWeightKg > 0 ? Number(totalWeightKg.toFixed(3)) : DEFAULT_WEIGHT_KG,
  };
}

/**
 * Fill missing weight/dims on order items from live Product docs (legacy orders).
 */
async function enrichOrderItemsWithProductPackage(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const needsLookup = items.some(
    (item) =>
      !item.weight ||
      !Number(item.packageLength) ||
      !Number(item.packageBreadth) ||
      !Number(item.packageHeight),
  );
  if (!needsLookup || items.length === 0) return items;

  const productIds = [
    ...new Set(items.map((item) => String(item.product || "")).filter(Boolean)),
  ];
  if (productIds.length === 0) return items;

  const products = await Product.find({ _id: { $in: productIds } })
    .select("weight packageLength packageBreadth packageHeight")
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return items.map((item) => {
    const product = byId.get(String(item.product));
    if (!product) return item;
    return {
      ...(typeof item.toObject === "function" ? item.toObject() : item),
      weight: item.weight || product.weight || "",
      packageLength: Number(item.packageLength) || product.packageLength || null,
      packageBreadth: Number(item.packageBreadth) || product.packageBreadth || null,
      packageHeight: Number(item.packageHeight) || product.packageHeight || null,
    };
  });
}

function isLegacyInviteCodeLike(value = "") {
  return /^SV-[A-Z0-9]{6}$/i.test(String(value || "").trim());
}

function sanitizePickupNickname(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildSellerPickupNickname(sellerDoc) {
  const existing = String(sellerDoc?.shiprocketPickupLocation || "").trim();
  // Reuse custom existing nickname, but ignore legacy invite-code-like values.
  if (existing && !isLegacyInviteCodeLike(existing)) {
    return sanitizePickupNickname(existing).substring(0, 36);
  }

  const displayBase =
    String(sellerDoc?.shopName || "").trim() ||
    String(sellerDoc?.name || "").trim() ||
    "SELLER";
  const base = sanitizePickupNickname(displayBase) || "SELLER";
  const sellerIdSuffix = String(sellerDoc?._id || "").slice(-6).toUpperCase();
  const suffix = sellerIdSuffix ? `_${sellerIdSuffix}` : "";

  const maxBaseLen = Math.max(1, 36 - suffix.length);
  return `${base.substring(0, maxBaseLen)}${suffix}`;
}

/**
 * Registers or updates a seller's pickup address on Shiprocket panel.
 * Nickname is per-seller; physical address comes from seller store fields.
 */
export async function registerOrUpdateSellerPickupLocation(sellerDoc) {
  if (!sellerDoc) return null;

  const pickupNickname = buildSellerPickupNickname(sellerDoc);
  const addressText = sellerDoc.address || sellerDoc.locality || "Store Address";
  const pincodeText =
    String(sellerDoc.pincode || "").trim() ||
    extractIndianPincode(sellerDoc.address, sellerDoc.locality);

  if (!pincodeText || pincodeText.length < 6) {
    console.warn(
      `[Shiprocket] Skipping pickup location registration for seller ${sellerDoc._id}: invalid pincode (${pincodeText})`,
    );
    return null;
  }

  const payload = {
    pickup_location: pickupNickname,
    name: sellerDoc.shopName || sellerDoc.name || "Seller Store",
    email: sellerDoc.email || "seller@example.com",
    phone: sellerDoc.phone || "9999999999",
    address: addressText.substring(0, 80),
    address_2: (sellerDoc.locality || "").substring(0, 80),
    city: sellerDoc.city || parseCityStatePincode(sellerDoc.address).city || "City",
    state: sellerDoc.state || parseCityStatePincode(sellerDoc.address).state || "State",
    country: "India",
    pin_code: pincodeText,
  };

  try {
    await addPickupLocation(payload);
    console.log(
      `[Shiprocket] Pickup location registered/updated for seller ${sellerDoc._id}: ${pickupNickname}`,
    );

    if (sellerDoc.shiprocketPickupLocation !== pickupNickname) {
      await Seller.findByIdAndUpdate(sellerDoc._id, {
        $set: { shiprocketPickupLocation: pickupNickname },
      }).catch(() => {});
      sellerDoc.shiprocketPickupLocation = pickupNickname;
    }
    return pickupNickname;
  } catch (err) {
    // Shiprocket often returns an error if nickname already exists — still persist nickname.
    const alreadyExists =
      /already|exist|duplicate/i.test(err.message || "") ||
      /already|exist|duplicate/i.test(JSON.stringify(err.details || {}));

    if (alreadyExists) {
      console.warn(
        `[Shiprocket] Pickup nickname already exists for seller ${sellerDoc._id}; reusing ${pickupNickname}`,
      );
      if (sellerDoc.shiprocketPickupLocation !== pickupNickname) {
        await Seller.findByIdAndUpdate(sellerDoc._id, {
          $set: { shiprocketPickupLocation: pickupNickname },
        }).catch(() => {});
        sellerDoc.shiprocketPickupLocation = pickupNickname;
      }
      return pickupNickname;
    }

    console.error(
      `[Shiprocket] Failed to sync pickup location for seller ${sellerDoc._id}:`,
      err.message,
    );
    return null;
  }
}

/**
 * Ensures the seller has a Shiprocket pickup nickname registered from their store address.
 */
export async function ensureSellerPickupLocation(seller) {
  if (!seller) return null;
  if (seller.shiprocketPickupLocation) {
    const existing = String(seller.shiprocketPickupLocation).trim();
    if (!isLegacyInviteCodeLike(existing)) {
      return existing;
    }
  }
  return registerOrUpdateSellerPickupLocation(seller);
}

function resolveOrderDeliveryAddress(order = {}) {
  const addr = order.address || {};
  const parsedCity = parseCityStatePincode(addr.city);

  const pincode =
    String(addr.pincode || "").trim() ||
    parsedCity.pincode ||
    extractIndianPincode(addr.address, addr.landmark);

  const city = (parsedCity.city && String(addr.city || "").includes(","))
    ? parsedCity.city
    : String(addr.city || "").trim() || parsedCity.city;
  const state = String(addr.state || "").trim() || parsedCity.state;

  return { pincode, city, state, raw: addr };
}

function normalizeCourierOptions(serviceabilityResponse) {
  const roots = [
    serviceabilityResponse?.data?.available_courier_companies,
    serviceabilityResponse?.available_courier_companies,
    serviceabilityResponse?.data?.data?.available_courier_companies,
  ];
  for (const list of roots) {
    if (Array.isArray(list)) return list;
  }
  return [];
}

function pickSurfaceCourier(courierOptions = []) {
  const enriched = courierOptions
    .map((item) => ({
      courierId:
        item?.courier_company_id ??
        item?.courier_id ??
        item?.id ??
        null,
      courierName: String(
        item?.courier_name || item?.courier_company_name || item?.name || "",
      ).trim(),
      charge:
        Number(item?.total_charge) ||
        Number(item?.freight_charge) ||
        Number(item?.rate) ||
        Number.POSITIVE_INFINITY,
    }))
    .filter((item) => Number.isFinite(item.courierId));

  const surfaceOnly = enriched.filter((item) =>
    item.courierName.toLowerCase().includes("surface"),
  );
  if (!surfaceOnly.length) return null;
  surfaceOnly.sort((a, b) => a.charge - b.charge);
  return surfaceOnly[0];
}

async function getPreferredSurfaceCourierId({
  pickupPincode,
  deliveryPincode,
  weightKg,
  codAmount,
}) {
  try {
    const serviceability = await checkServiceability({
      pickupPostcode: pickupPincode,
      deliveryPostcode: deliveryPincode,
      weightKg,
      codAmount,
    });
    const courierOptions = normalizeCourierOptions(serviceability);
    return pickSurfaceCourier(courierOptions);
  } catch (err) {
    console.warn(
      "[Shiprocket] Serviceability lookup failed for courier preference:",
      err.message,
    );
    return null;
  }
}

function buildAdhocOrderPayload({ order, seller, customerEmail, pickupLocation, packageItems, delivery }) {
  const { firstName, lastName } = splitName(order.address?.name);
  const isCOD = order.paymentMode === "COD" || order.payment?.method === "cash";

  const orderItems = (order.items || []).map((item) => ({
    name: item.name || "Item",
    sku: String(item.product),
    units: item.quantity,
    selling_price: item.price,
  }));

  const pkg = resolvePackageFromOrderItems(packageItems || order.items || []);

  return {
    order_id: order.orderId,
    order_date: toShiprocketDate(order.createdAt || new Date()),
    pickup_location: pickupLocation,
    channel_id: process.env.SHIPROCKET_CHANNEL_ID || undefined,

    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: order.address?.address || "",
    billing_city: delivery.city || "",
    billing_pincode: delivery.pincode,
    billing_state: delivery.state || "",
    billing_country: "India",
    billing_email: customerEmail || "noreply@example.com",
    billing_phone: order.address?.phone,

    shipping_is_billing: true,

    order_items: orderItems,

    payment_method: isCOD ? "COD" : "Prepaid",
    sub_total: order.pricing?.subtotal ?? order.paymentBreakdown?.productSubtotal ?? 0,

    length: pkg.length,
    breadth: pkg.breadth,
    height: pkg.height,
    weight: pkg.weight,
  };
}

/**
 * Creates the Shiprocket shipment for a scheduled order using the seller's pickup location.
 * Instant (local rider) orders are skipped.
 */
export async function createShiprocketShipmentForOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ShiprocketError("Order not found", { statusCode: 404 });
  }

  if (order.deliveryType !== "scheduled") {
    console.log(
      `[Shiprocket] Skipping shipment for non-scheduled order ${order.orderId} (deliveryType=${order.deliveryType})`,
    );
    return null;
  }

  if (order.shipmentDetails?.shiprocketShipmentId) {
    return order.shipmentDetails;
  }

  const seller = order.seller ? await Seller.findById(order.seller) : null;
  if (!seller) {
    throw new ShiprocketError("Seller not found for Shiprocket shipment", {
      statusCode: 400,
    });
  }

  const pickupLocation = await ensureSellerPickupLocation(seller);
  if (!pickupLocation) {
    throw new ShiprocketError(
      "Seller pickup location is not registered on Shiprocket (missing seller pincode/address)",
      { statusCode: 400 },
    );
  }

  const delivery = resolveOrderDeliveryAddress(order);
  if (!delivery.pincode || delivery.pincode.length < 6) {
    throw new ShiprocketError(
      "Customer delivery pincode is required for scheduled Shiprocket orders",
      { statusCode: 400 },
    );
  }

  let customerEmail = order.customerEmail || null;
  if (!customerEmail && order.customer) {
    const customer = await Customer.findById(order.customer).select("email").lean();
    customerEmail = customer?.email || null;
  }

  const packageItems = await enrichOrderItemsWithProductPackage(order);
  const pkg = resolvePackageFromOrderItems(packageItems || order.items || []);

  const payload = buildAdhocOrderPayload({
    order,
    seller,
    customerEmail,
    pickupLocation,
    packageItems,
    delivery,
  });

  let createResponse;
  try {
    createResponse = await createAdhocOrder(payload);
  } catch (err) {
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        "shipmentDetails.provider": "shiprocket",
        "shipmentDetails.lastError": err.message,
        "shipmentDetails.lastErrorAt": new Date(),
      },
    });
    throw err;
  }

  const shipmentId = createResponse?.shipment_id;
  const shiprocketOrderId = createResponse?.order_id;

  if (!shipmentId) {
    throw new ShiprocketError("Shiprocket did not return a shipment_id", {
      statusCode: 502,
      details: createResponse,
    });
  }

  let awbResponse = null;
  try {
    let preferredCourierId = null;
    const shouldPreferSurface =
      String(process.env.SHIPROCKET_PREFER_SURFACE || "true").toLowerCase() !== "false";

    if (shouldPreferSurface) {
      const pickupPincodeForRate =
        String(seller.pincode || "").trim() || extractIndianPincode(seller.address, seller.locality);
      const picked = await getPreferredSurfaceCourierId({
        pickupPincode: pickupPincodeForRate,
        deliveryPincode: delivery.pincode,
        weightKg: pkg.weight,
        codAmount: payload.payment_method === "COD" ? payload.sub_total : 0,
      });
      if (picked?.courierId) {
        preferredCourierId = picked.courierId;
        console.log(
          `[Shiprocket] Surface courier preferred for ${order.orderId}: ${picked.courierName} (${preferredCourierId})`,
        );
      }
    }

    awbResponse = await assignAWB({
      shipmentId,
      ...(preferredCourierId ? { courierId: preferredCourierId } : {}),
    });
  } catch (err) {
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        "shipmentDetails.provider": "shiprocket",
        "shipmentDetails.shiprocketOrderId": shiprocketOrderId,
        "shipmentDetails.shiprocketShipmentId": shipmentId,
        "shipmentDetails.pickupLocation": pickupLocation,
        "shipmentDetails.awbAssigned": false,
        "shipmentDetails.lastError": err.message,
        "shipmentDetails.lastErrorAt": new Date(),
      },
    });
    throw err;
  }

  const awbCode = awbResponse?.response?.data?.awb_code;
  const courierName = awbResponse?.response?.data?.courier_name;

  let pickupResponse = null;
  try {
    pickupResponse = await generatePickup({ shipmentIds: [shipmentId] });
  } catch (err) {
    console.error("[Shiprocket] pickup generation failed:", err.message);
  }

  const shipmentDetails = {
    provider: "shiprocket",
    shiprocketOrderId,
    shiprocketShipmentId: shipmentId,
    pickupLocation,
    awbCode: awbCode || null,
    courierName: courierName || null,
    awbAssigned: Boolean(awbCode),
    pickupScheduled: Boolean(pickupResponse),
    pickupTokenNumber: pickupResponse?.response?.pickup_scheduled_date || null,
    lastSyncedStatus: null,
    lastError: null,
    lastErrorAt: null,
    createdAt: new Date(),
  };

  order.shipmentDetails = shipmentDetails;
  await order.save();

  return shipmentDetails;
}

/**
 * Cancels the Shiprocket shipment tied to an order.
 */
export async function cancelShiprocketShipmentForOrder(orderId) {
  const order = await Order.findById(orderId);
  const srOrderId = order?.shipmentDetails?.shiprocketOrderId;
  if (!srOrderId) {
    return null;
  }

  const result = await cancelOrders([srOrderId]);

  await Order.findByIdAndUpdate(order._id, {
    $set: { "shipmentDetails.cancelledOnShiprocket": true },
  });

  return result;
}

export async function syncShiprocketTracking(orderId) {
  const order = await Order.findById(orderId);
  if (!order?.shipmentDetails?.shiprocketShipmentId) return null;

  return trackByShipmentId(order.shipmentDetails.shiprocketShipmentId);
}

export { buildAdhocOrderPayload };
