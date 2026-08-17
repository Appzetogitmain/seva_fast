import Order from "../../models/order.js";
import Customer from "../../models/customer.js";
import WhatsAppMessage from "../../models/whatsappMessage.js";
import { isValidE164Phone, normalizePhoneNumber, maskPhone } from "../../utils/phone.js";
import { sendWhatsAppTextMessage } from "./whatsapp.service.js";
import { getTemplateForType, renderTemplate } from "./whatsapp.templates.js";
import { WHATSAPP_MESSAGE_TYPES, ORDER_EVENT_TO_WHATSAPP_MESSAGE_TYPE } from "./whatsapp.constants.js";
import { NOTIFICATION_EVENTS } from "../notifications/notification.constants.js";
import { getWhatsAppConfig } from "../../config/whatsapp.js";
import { issueBirthdayCoupon, formatCouponDiscountLabel } from "../../services/birthdayCouponService.js";
import logger from "../../services/logger.js";

function formatAmount(value) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-IN")}`;
}

function formatShortDate(date) {
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Creates the tracking record first (claiming the dedupe key atomically via
 * the unique index on dedupeKey), then attempts the send. Every branch below
 * only ever updates the WhatsAppMessage row and logs — it never throws back
 * to the caller, so a WhatsApp outage can't affect order/birthday flows.
 */
async function recordAndSend({ customerId, phone: rawPhone, messageType, dedupeKey, relatedOrder, message }) {
  // Some existing customer records predate phone normalization and are
  // still stored as bare 10-digit numbers — normalize here so those
  // customers aren't silently skipped for every WhatsApp notification.
  const phone = normalizePhoneNumber(rawPhone);

  let record;
  try {
    record = await WhatsAppMessage.create({
      customer: customerId || null,
      phone,
      messageType,
      relatedOrder: relatedOrder || null,
      dedupeKey,
      status: "queued",
    });
  } catch (error) {
    if (error?.code === 11000) {
      // Same event already recorded — never send the same notification twice.
      return;
    }
    logger.error("Failed to create WhatsApp message tracking record", {
      messageType,
      dedupeKey,
      message: error.message,
    });
    return;
  }

  if (!isValidE164Phone(phone)) {
    await WhatsAppMessage.updateOne(
      { _id: record._id },
      { $set: { status: "failed", failureReason: "Invalid or missing WhatsApp-compatible phone number" } },
    );
    return;
  }

  if (!getWhatsAppConfig()) {
    await WhatsAppMessage.updateOne(
      { _id: record._id },
      { $set: { status: "failed", failureReason: "WhatsApp is not configured" } },
    );
    return;
  }

  try {
    const result = await sendWhatsAppTextMessage({ to: phone, message });
    await WhatsAppMessage.updateOne(
      { _id: record._id },
      { $set: { status: "sent", waMessageId: result.waMessageId, sentAt: new Date() } },
    );
  } catch (error) {
    await WhatsAppMessage.updateOne(
      { _id: record._id },
      { $set: { status: "failed", failureReason: error.message } },
    );
    logger.error("WhatsApp automated message send failed", {
      messageType,
      phone: maskPhone(phone),
      message: error.message,
    });
  }
}

async function handleOrderEvent(eventType, payload) {
  const messageType = ORDER_EVENT_TO_WHATSAPP_MESSAGE_TYPE[eventType];
  if (!messageType) return;

  const orderId = String(payload.orderId || "").trim();
  if (!orderId) return;

  const template = await getTemplateForType(messageType);
  if (!template) return;

  const order = await Order.findOne({ orderId })
    .select("orderId customer address pricing paymentBreakdown status orderStatus")
    .populate("customer", "name phone")
    .lean();

  if (!order || !order.customer) return;

  const customerName = order.customer.name || "Customer";
  const phone = order.customer.phone || order.address?.phone || "";
  const amount = formatAmount(order.paymentBreakdown?.grandTotal || order.pricing?.total || 0);
  const status = order.orderStatus || order.status || "";

  const message = renderTemplate(template, {
    name: customerName,
    orderNumber: order.orderId,
    amount,
    status,
  });

  await recordAndSend({
    customerId: order.customer._id,
    phone,
    messageType,
    dedupeKey: `order:${order.orderId}:${messageType}`,
    relatedOrder: order._id,
    message,
  });
}

async function handleBirthdayEvent(payload) {
  const customerId = payload.userId || payload.customerId;
  if (!customerId) return;

  const template = await getTemplateForType(WHATSAPP_MESSAGE_TYPES.BIRTHDAY_WISH);
  if (!template) return;

  const customer = await Customer.findById(customerId).select("name phone").lean();
  if (!customer) return;

  const year = payload.birthdayYear || new Date().getFullYear();
  let message = renderTemplate(template, { name: customer.name || "there" });

  // Coupon issuance is a best-effort add-on — never let it block the wish
  // itself (no birthday template configured, a transient DB error, etc.
  // should all still result in a plain "Happy Birthday" message going out).
  try {
    const coupon = await issueBirthdayCoupon(customer, year);
    if (coupon) {
      message += ` \u{1F381} Here's a birthday gift: use code ${coupon.code} for ${formatCouponDiscountLabel(coupon)} on your next order, valid till ${formatShortDate(coupon.validTill)}.`;
    }
  } catch (error) {
    logger.error("Failed to issue birthday coupon", {
      customerId: String(customer._id),
      year,
      message: error.message,
    });
  }

  await recordAndSend({
    customerId: customer._id,
    phone: customer.phone,
    messageType: WHATSAPP_MESSAGE_TYPES.BIRTHDAY_WISH,
    dedupeKey: `birthday:${customer._id}:${year}`,
    relatedOrder: null,
    message,
  });
}

export async function dispatchWhatsAppForEvent(eventType, payload = {}) {
  if (eventType === NOTIFICATION_EVENTS.BIRTHDAY_WISH) {
    await handleBirthdayEvent(payload);
    return;
  }
  if (ORDER_EVENT_TO_WHATSAPP_MESSAGE_TYPE[eventType]) {
    await handleOrderEvent(eventType, payload);
  }
}

export default { dispatchWhatsAppForEvent };
