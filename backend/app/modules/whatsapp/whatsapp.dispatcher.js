import Order from "../../models/order.js";
import Customer from "../../models/customer.js";
import WhatsAppMessage from "../../models/whatsappMessage.js";
import { isValidE164Phone, maskPhone } from "../../utils/phone.js";
import { sendWhatsAppTemplateMessage } from "./whatsapp.service.js";
import { getTemplateForType, buildOrderEventBodyParams, buildBirthdayBodyParams } from "./whatsapp.templates.js";
import { WHATSAPP_MESSAGE_TYPES, ORDER_EVENT_TO_WHATSAPP_MESSAGE_TYPE } from "./whatsapp.constants.js";
import { NOTIFICATION_EVENTS } from "../notifications/notification.constants.js";
import { getWhatsAppConfig } from "../../config/whatsapp.js";
import logger from "../../services/logger.js";

function formatAmount(value) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-IN")}`;
}

/**
 * Creates the tracking record first (claiming the dedupe key atomically via
 * the unique index on dedupeKey), then attempts the send. Every branch below
 * only ever updates the WhatsAppMessage row and logs — it never throws back
 * to the caller, so a WhatsApp outage can't affect order/birthday flows.
 */
async function recordAndSend({ customerId, phone, messageType, dedupeKey, relatedOrder, templateName, languageCode, bodyParams }) {
  let record;
  try {
    record = await WhatsAppMessage.create({
      customer: customerId || null,
      phone,
      messageType,
      templateName,
      languageCode,
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
    const result = await sendWhatsAppTemplateMessage({ to: phone, templateName, languageCode, bodyParams });
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

  const template = getTemplateForType(messageType);
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

  const bodyParams = buildOrderEventBodyParams(messageType, {
    customerName,
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
    templateName: template.name,
    languageCode: template.languageCode,
    bodyParams,
  });
}

async function handleBirthdayEvent(payload) {
  const customerId = payload.userId || payload.customerId;
  if (!customerId) return;

  const template = getTemplateForType(WHATSAPP_MESSAGE_TYPES.BIRTHDAY_WISH);
  if (!template) return;

  const customer = await Customer.findById(customerId).select("name phone").lean();
  if (!customer) return;

  const year = payload.birthdayYear || new Date().getFullYear();
  const bodyParams = buildBirthdayBodyParams({ customerName: customer.name || "there" });

  await recordAndSend({
    customerId: customer._id,
    phone: customer.phone,
    messageType: WHATSAPP_MESSAGE_TYPES.BIRTHDAY_WISH,
    dedupeKey: `birthday:${customer._id}:${year}`,
    relatedOrder: null,
    templateName: template.name,
    languageCode: template.languageCode,
    bodyParams,
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
