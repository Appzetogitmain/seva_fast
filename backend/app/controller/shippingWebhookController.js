import crypto from "crypto";
import Order from "../models/order.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { applyDeliveredSettlement } from "../services/orderSettlement.js";
import { emitOrderStatusUpdate } from "../services/orderSocketEmitter.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import * as logger from "../services/logger.js";

function verifyWebhookSecret(req) {
  const expected = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (!expected) {
    logger.warn(
      "[Shiprocket Webhook] SHIPROCKET_WEBHOOK_SECRET is not set — skipping signature check",
    );
    return true;
  }

  const got = String(req.headers["x-api-key"] || "").trim();
  if (!got) return false;

  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(got);
  if (expectedBuf.length !== gotBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, gotBuf);
}

/**
 * Handles incoming status update webhooks from Shiprocket.
 * Mounted at: POST /api/orders/shipping/shiprocket/webhook
 */
export async function handleShiprocketWebhook(req, res) {
  try {
    if (!verifyWebhookSecret(req)) {
      return res.status(401).json({ success: false, message: "Invalid webhook secret" });
    }

    const payload = req.body || {};
    const awbCode = payload.awb || payload.awb_code;
    const shiprocketOrderId = payload.order_id;
    const shipmentId = payload.shipment_id;
    const channelOrderId = payload.channel_order_id || payload.order_id;
    const rawStatus = String(payload.current_status || "").trim().toUpperCase();

    logger.info(
      `[Shiprocket Webhook] AWB=${awbCode}, SR_OrderID=${shiprocketOrderId}, shipment=${shipmentId}, Status=${rawStatus}`,
    );

    if (!awbCode && !shiprocketOrderId && !shipmentId && !channelOrderId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing AWB / order / shipment id in payload" });
    }

    const orClauses = [];
    if (channelOrderId != null) {
      orClauses.push({ orderId: String(channelOrderId) });
    }
    if (shiprocketOrderId != null) {
      orClauses.push({ "shipmentDetails.shiprocketOrderId": shiprocketOrderId });
      orClauses.push({ "shipmentDetails.shiprocketOrderId": String(shiprocketOrderId) });
    }
    if (shipmentId != null) {
      orClauses.push({ "shipmentDetails.shiprocketShipmentId": shipmentId });
      orClauses.push({ "shipmentDetails.shiprocketShipmentId": String(shipmentId) });
    }
    if (awbCode) {
      orClauses.push({ "shipmentDetails.awbCode": awbCode });
    }

    let order = orClauses.length
      ? await Order.findOne({ $or: orClauses })
      : null;

    if (!order) {
      logger.warn(
        `[Shiprocket Webhook] Order not found for AWB=${awbCode} order_id=${shiprocketOrderId} shipment_id=${shipmentId}`,
      );
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.shipmentDetails = {
      ...(order.shipmentDetails || {}),
      status: rawStatus,
      lastSyncedStatus: rawStatus,
      updatedAt: new Date(),
    };

    const oldStatus = order.status;
    let newStatus = null;
    let newWorkflowStatus = null;

    if (["PICKED UP", "IN TRANSIT", "SHIPPED"].includes(rawStatus)) {
      newStatus = "out_for_delivery";
      newWorkflowStatus = WORKFLOW_STATUS.OUT_FOR_DELIVERY;
    } else if (rawStatus === "OUT FOR DELIVERY") {
      newStatus = "out_for_delivery";
      newWorkflowStatus = WORKFLOW_STATUS.OUT_FOR_DELIVERY;
    } else if (rawStatus === "DELIVERED") {
      newStatus = "delivered";
      newWorkflowStatus = WORKFLOW_STATUS.DELIVERED;
    } else if (["CANCELLED", "CANCELED", "RTO INITIATED", "RTO DELIVERED"].includes(rawStatus)) {
      newStatus = "cancelled";
      newWorkflowStatus = WORKFLOW_STATUS.CANCELLED;
    }

    if (newStatus && oldStatus !== newStatus) {
      order.status = newStatus;
      order.orderStatus = newStatus;
      order.workflowStatus = newWorkflowStatus;

      if (newStatus === "delivered") {
        order.deliveredAt = new Date();
        await order.save();

        try {
          await applyDeliveredSettlement(order, order.orderId);
        } catch (settlementErr) {
          logger.error(
            `[Shiprocket Webhook] Settlement failed for ${order.orderId}:`,
            settlementErr.message,
          );
        }

        emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_DELIVERED, {
          orderId: order.orderId,
          customerId: order.customer,
          userId: order.customer,
          sellerId: order.seller,
        });
      } else {
        await order.save();
      }

      emitOrderStatusUpdate(
        order.orderId,
        {
          workflowStatus: order.workflowStatus,
          status: order.status,
        },
        order.customer,
        order.seller,
        order._id,
      );

      if (newStatus === "out_for_delivery") {
        emitNotificationEvent(NOTIFICATION_EVENTS.OUT_FOR_DELIVERY, {
          orderId: order.orderId,
          customerId: order.customer,
          userId: order.customer,
          sellerId: order.seller,
        });
      } else if (newStatus === "cancelled") {
        emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
          orderId: order.orderId,
          customerId: order.customer,
          userId: order.customer,
          sellerId: order.seller,
        });
      }
    } else {
      await order.save();
    }

    return res.status(200).json({ success: true, message: "Webhook processed successfully" });
  } catch (error) {
    logger.error("[Shiprocket Webhook Error] Failed to process webhook:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
