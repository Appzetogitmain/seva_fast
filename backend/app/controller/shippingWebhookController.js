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

  const got = String(
    req.headers["x-api-key"] ||
    req.headers["x-shiprocket-token"] ||
    req.headers["authorization"] ||
    "",
  ).replace(/^Bearer\s+/i, "").trim();
  if (!got) return false;

  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(got);
  if (expectedBuf.length !== gotBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, gotBuf);
}

/** Return-status rank so a webhook replay/out-of-order delivery can never move it backwards. */
function returnStatusRank(status) {
  switch (status) {
    case "return_approved":
      return 1;
    case "return_pickup_assigned":
      return 2;
    case "return_in_transit":
      return 3;
    case "returned":
      return 4;
    default:
      return 0;
  }
}

/**
 * Handles a webhook update for a Shiprocket REVERSE PICKUP (return) shipment.
 * Only ever updates tracking/status fields — never triggers refund, restock,
 * or QC here. Those stay behind the existing manual QC step
 * (updateReturnQcStatus -> completeReturnAndRefund) exactly like local
 * rider-fulfilled returns.
 *
 * Idempotent: re-delivered webhooks for a status we've already recorded are
 * no-ops, and returnStatus can only move forward (never backwards or repeat
 * the same "restock/notify" side effect twice).
 */
async function handleReturnShipmentWebhook({ order, rawStatus, awbCode }) {
  if (order.returnShipmentDetails?.lastSyncedStatus === rawStatus) {
    // Exact same status already recorded for this return shipment — no-op.
    return;
  }

  const update = {
    "returnShipmentDetails.lastSyncedStatus": rawStatus,
    "returnShipmentDetails.lastSyncedAt": new Date(),
  };
  if (awbCode && !order.returnShipmentDetails?.awbCode) {
    update["returnShipmentDetails.awbCode"] = awbCode;
  }

  // Only "in transit" is auto-applied to returnStatus. "DELIVERED" is
  // deliberately NOT auto-advanced to "returned" here — the seller must
  // explicitly confirm receipt and upload Return Received Photos
  // (confirmShiprocketReturnReceipt) before QC/refund can proceed, exactly
  // like the self-collect flow requires proof photos. The DELIVERED status
  // is still recorded above so the seller's UI can prompt them to confirm.
  let nextReturnStatus = null;
  if (["PICKED UP", "IN TRANSIT", "SHIPPED", "OUT FOR PICKUP"].includes(rawStatus)) {
    nextReturnStatus = "return_in_transit";
  }

  const isForwardMove =
    nextReturnStatus && returnStatusRank(nextReturnStatus) > returnStatusRank(order.returnStatus);

  if (isForwardMove) {
    update.returnStatus = nextReturnStatus;
    if (!order.returnPickedAt) {
      update.returnPickedAt = new Date();
    }
  } else if (nextReturnStatus) {
    logger.info(
      `[Shiprocket Return Webhook] Ignoring out-of-order/duplicate status "${rawStatus}" for order ${order.orderId} (current returnStatus=${order.returnStatus})`,
    );
  } else if (rawStatus !== "DELIVERED") {
    logger.warn(`[Shiprocket Return Webhook] Unmapped return status "${rawStatus}" for order ${order.orderId}`);
  }

  await Order.findByIdAndUpdate(order._id, { $set: update });

  if (isForwardMove) {
    emitOrderStatusUpdate(
      order.orderId,
      { returnStatus: nextReturnStatus },
      order.customer,
      order.seller,
      order._id,
    );
  }

  if (rawStatus === "DELIVERED") {
    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_COMPLETED, {
      orderId: order.orderId,
      sellerId: order.seller,
      customerId: order.customer,
      data: {
        message: "Shiprocket has delivered the returned item to your store. Please confirm receipt and upload photos to proceed with QC.",
      },
    });
  }
}

/**
 * Handles incoming status update webhooks from Shiprocket, for both forward
 * (delivery) and reverse (return) shipments.
 * Mounted at: POST /api/orders/shipping/shiprocket/webhook
 */
export async function handleShiprocketWebhook(req, res) {
  try {
    const payload = req.body || {};
    const awbCode = payload.awb || payload.awb_code;
    const shiprocketOrderId = payload.order_id;
    const shipmentId = payload.shipment_id;
    const channelOrderId = payload.channel_order_id || payload.order_id;
    const rawStatus = String(
      payload.current_status || payload.status || payload.shipment_status || "",
    ).trim().toUpperCase();

    logger.info("[Shiprocket Webhook] Received webhook call:", {
      headers: {
        "x-api-key": req.headers["x-api-key"] ? "[PRESENT]" : "[MISSING]",
        "content-type": req.headers["content-type"],
      },
      body: req.body,
    });

    if (!verifyWebhookSecret(req)) {
      logger.warn("[Shiprocket Webhook] Invalid secret header:", {
        headers: req.headers,
      });
      return res.status(401).json({ success: false, message: "Invalid webhook secret" });
    }

    // Shiprocket initial verification / test ping handler (empty body or test event)
    if (!awbCode && !shiprocketOrderId && !shipmentId && !channelOrderId) {
      return res.status(200).json({
        success: true,
        message: "Shiprocket webhook endpoint verified successfully",
      });
    }

    const forwardOrClauses = [];
    if (channelOrderId != null) {
      forwardOrClauses.push({ orderId: String(channelOrderId) });
    }
    if (shiprocketOrderId != null) {
      forwardOrClauses.push({ "shipmentDetails.shiprocketOrderId": shiprocketOrderId });
      forwardOrClauses.push({ "shipmentDetails.shiprocketOrderId": String(shiprocketOrderId) });
    }
    if (shipmentId != null) {
      forwardOrClauses.push({ "shipmentDetails.shiprocketShipmentId": shipmentId });
      forwardOrClauses.push({ "shipmentDetails.shiprocketShipmentId": String(shipmentId) });
    }
    if (awbCode) {
      forwardOrClauses.push({ "shipmentDetails.awbCode": awbCode });
    }

    let order = forwardOrClauses.length
      ? await Order.findOne({ $or: forwardOrClauses })
      : null;
    let isReturnShipment = false;

    if (!order) {
      // Not a forward shipment we recognize — check if it's a return (reverse
      // pickup) shipment instead before giving up.
      const returnOrClauses = [];
      if (shiprocketOrderId != null) {
        returnOrClauses.push({ "returnShipmentDetails.shiprocketReturnOrderId": shiprocketOrderId });
        returnOrClauses.push({ "returnShipmentDetails.shiprocketReturnOrderId": String(shiprocketOrderId) });
      }
      if (shipmentId != null) {
        returnOrClauses.push({ "returnShipmentDetails.shiprocketReturnShipmentId": shipmentId });
        returnOrClauses.push({ "returnShipmentDetails.shiprocketReturnShipmentId": String(shipmentId) });
      }
      if (awbCode) {
        returnOrClauses.push({ "returnShipmentDetails.awbCode": awbCode });
      }
      if (returnOrClauses.length) {
        order = await Order.findOne({ $or: returnOrClauses });
        if (order) isReturnShipment = true;
      }
    }

    if (!order) {
      logger.warn(
        `[Shiprocket Webhook] Order not found for AWB=${awbCode} order_id=${shiprocketOrderId} shipment_id=${shipmentId}. Acknowledging 200 for Shiprocket test / unknown order.`,
      );
      // Return 200 OK so Shiprocket "Test Webhook" verification passes and does not disable the webhook
      return res.status(200).json({
        success: true,
        message: "Webhook acknowledged (order not found in local system or test event)",
      });
    }

    if (isReturnShipment) {
      await handleReturnShipmentWebhook({ order, rawStatus, awbCode });
      return res.status(200).json({ success: true, message: "Return webhook processed successfully" });
    }

    // Idempotency guard — skip if we've already applied this exact status to
    // this forward shipment (webhook re-delivery is expected/common).
    if (order.shipmentDetails?.lastSyncedStatus === rawStatus) {
      return res.status(200).json({ success: true, message: "Webhook already processed (no change)" });
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
