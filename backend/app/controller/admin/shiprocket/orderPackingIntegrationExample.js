/**
 * ==========================================================
 *  INTEGRATION EXAMPLE — not a new route, just a reference
 * ==========================================================
 * Drop this logic into your EXISTING "seller marks order as packed"
 * controller (wherever you currently set order.status = "packed" /
 * order.pickupReadyAt). Do not create a duplicate endpoint for this.
 */

import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import { createShiprocketShipmentForOrder } from "../services/shiprocketOrderService.js";

export const markOrderPackedAndShip = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return handleResponse(res, 404, "Order not found");

    // ... your existing seller/ownership checks stay here ...

    order.status = "packed";
    order.orderStatus = "packed";
    order.pickupReadyAt = new Date();
    await order.save();

    // Fire-and-track: create the Shiprocket shipment. We deliberately
    // don't let a Shiprocket failure block the "packed" state change —
    // packing already happened physically. Instead we surface the error
    // on the response so the seller/ops dashboard can retry.
    let shipment = null;
    let shipmentError = null;
    try {
      shipment = await createShiprocketShipmentForOrder(order._id);
    } catch (err) {
      shipmentError = err.message;
      console.error(`[Shiprocket] shipment creation failed for order ${order._id}:`, err);
    }

    return handleResponse(res, 200, "Order marked as packed", {
      order,
      shipment,
      shipmentError,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Retry endpoint for ops/admin dashboard — use when the initial
 * shipment creation above failed (e.g. Shiprocket was down).
 */
export const retryShiprocketShipment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const shipment = await createShiprocketShipmentForOrder(orderId);
    return handleResponse(res, 200, "Shipment created/synced", shipment);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};