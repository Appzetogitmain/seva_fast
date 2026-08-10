import logger from "../../services/logger.js";

export function emitNotificationEvent(eventType, payload = {}) {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  setImmediate(async () => {
    try {
      const { notify } = await import("./notification.service.js");
      await notify(eventType, payload);
    } catch (error) {
      logger.error("Failed to emit notification event", {
        eventType,
        message: error.message,
      });
    }
  });

  // Isolated branch: WhatsApp dispatch runs independently of push notification
  // delivery above, in its own fire-and-forget tick, so a WhatsApp failure
  // (or the integration being unconfigured) can never affect push notifications
  // or the order/birthday flow that triggered this event.
  setImmediate(async () => {
    try {
      const { dispatchWhatsAppForEvent } = await import("../whatsapp/whatsapp.dispatcher.js");
      await dispatchWhatsAppForEvent(eventType, payload);
    } catch (error) {
      logger.error("Failed to dispatch WhatsApp notification", {
        eventType,
        message: error.message,
      });
    }
  });
}

export default {
  emitNotificationEvent,
};
