import { NOTIFICATION_EVENTS } from "../notifications/notification.constants.js";

export const WHATSAPP_MESSAGE_TYPES = Object.freeze({
  ORDER_PLACED: "order_placed",
  OUT_FOR_DELIVERY: "out_for_delivery",
  ORDER_DELIVERED: "order_delivered",
  ORDER_CANCELLED: "order_cancelled",
  WALLET_UPDATE: "wallet_update",
  PLAN_PURCHASED: "plan_purchased",
  BIRTHDAY_WISH: "birthday_wish",
  CAMPAIGN: "campaign",
  OTHER: "other",
});

// Only these order-lifecycle notification events trigger a WhatsApp send via
// the generic order-derived handler. WALLET_UPDATED is dispatched separately
// (see whatsapp.dispatcher.js) since it isn't always tied to a single order's
// pricing snapshot (e.g. an admin wallet adjustment). Any other
// NOTIFICATION_EVENTS value is a silent no-op for WhatsApp.
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
