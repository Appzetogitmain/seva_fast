import { NOTIFICATION_EVENTS } from "../notifications/notification.constants.js";

export const WHATSAPP_MESSAGE_TYPES = Object.freeze({
  ORDER_PLACED: "order_placed",
  OUT_FOR_DELIVERY: "out_for_delivery",
  ORDER_DELIVERED: "order_delivered",
  ORDER_CANCELLED: "order_cancelled",
  BIRTHDAY_WISH: "birthday_wish",
  CAMPAIGN: "campaign",
  OTHER: "other",
});

// Only these order-lifecycle notification events trigger a WhatsApp send.
// Any other NOTIFICATION_EVENTS value is a silent no-op for WhatsApp.
export const ORDER_EVENT_TO_WHATSAPP_MESSAGE_TYPE = Object.freeze({
  [NOTIFICATION_EVENTS.ORDER_PLACED]: WHATSAPP_MESSAGE_TYPES.ORDER_PLACED,
  [NOTIFICATION_EVENTS.OUT_FOR_DELIVERY]: WHATSAPP_MESSAGE_TYPES.OUT_FOR_DELIVERY,
  [NOTIFICATION_EVENTS.ORDER_DELIVERED]: WHATSAPP_MESSAGE_TYPES.ORDER_DELIVERED,
  [NOTIFICATION_EVENTS.ORDER_CANCELLED]: WHATSAPP_MESSAGE_TYPES.ORDER_CANCELLED,
});

export default {
  WHATSAPP_MESSAGE_TYPES,
  ORDER_EVENT_TO_WHATSAPP_MESSAGE_TYPE,
};
