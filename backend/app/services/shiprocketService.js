/**
 * @deprecated Use `./shiprocket/shiprocketService.js` +
 * `./shiprocket/shiprocketOrderService.js` instead.
 *
 * This legacy client used a shared env pickup location and a different
 * shipmentDetails shape. Kept only to avoid broken imports; do not call
 * from new code. orderController / orderWorkflow now use the new stack.
 */

import * as logger from "./logger.js";

export async function getShiprocketToken() {
  logger.warn("[DEPRECATED] getShiprocketToken called — use services/shiprocket/shiprocketService.js");
  throw new Error("Deprecated Shiprocket client. Use services/shiprocket/*");
}

export async function createShiprocketOrder() {
  logger.warn("[DEPRECATED] createShiprocketOrder called — use createShiprocketShipmentForOrder");
  throw new Error("Deprecated Shiprocket client. Use createShiprocketShipmentForOrder");
}

export async function cancelShiprocketOrder() {
  logger.warn("[DEPRECATED] cancelShiprocketOrder called — use cancelShiprocketShipmentForOrder");
  throw new Error("Deprecated Shiprocket client. Use cancelShiprocketShipmentForOrder");
}

export default {
  getShiprocketToken,
  createShiprocketOrder,
  cancelShiprocketOrder,
};
