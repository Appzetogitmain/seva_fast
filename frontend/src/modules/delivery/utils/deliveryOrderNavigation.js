export function buildDeliveryOrderDetailsPath(orderId) {
  const id = String(orderId || "").trim();
  if (!id) return "/delivery/dashboard";
  return `/delivery/order-details/${encodeURIComponent(id)}`;
}

export function isDeliveryOrderNotification(notification) {
  if (!notification) return false;
  const orderId = notification.data?.orderId;
  if (!orderId) return false;

  const type = String(notification.type || notification.data?.eventType || "").toUpperCase();
  const deliveryEvents = new Set([
    "ORDER",
    "DELIVERY_ASSIGNED",
    "NEW_DELIVERY_BROADCAST",
    "ORDER_READY",
    "RETURN_PICKUP_ASSIGNED",
    "NEW_RETURN_BROADCAST",
  ]);

  return deliveryEvents.has(type);
}
