import crypto from "crypto";
import Order from "../../../models/order.js";
import handleResponse from "../../../utils/helper.js";
import { SHIPROCKET_STATUS_MAP } from "../constants/shiprocketStatus.js";
import { WORKFLOW_STATUS } from "../../../constants/orderWorkflow.js";
import { emitNotificationEvent } from "../../../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../../../modules/notifications/notification.constants.js";

/**
 * ==========================================================
 *  Shiprocket Webhook Handler
 * ==========================================================
 * Configure this URL in Shiprocket panel:
 *   Settings -> API -> Webhooks -> https://yourdomain.com/api/webhooks/shiprocket
 * and set a static "Webhook Secret" there — Shiprocket sends it back on
 * every request as header `x-api-key`. We verify it with a timing-safe
 * compare before trusting the payload.
 *
 * Production notes:
 *  - Always return 200 quickly even if internal processing fails after
 *    validation, otherwise Shiprocket will retry-storm the endpoint.
 *    We log failures instead of bubbling 500s once the signature check
 *    has passed.
 *  - Webhook payloads don't always include every field consistently —
 *    guard every access.
 *  - Make this route idempotent: same status pushed twice should not
 *    double-fire notifications. We check `lastSyncedStatus` before acting.
 */

function isValidWebhookSecret(req) {
  const expected = process.env.SHIPROCKET_WEBHOOK_SECRET;
  const received = req.headers["x-api-key"];

  if (!expected) {
    // Fail closed: if you haven't configured a secret, reject rather
    // than silently accepting unauthenticated webhook calls.
    console.error("[Shiprocket Webhook] SHIPROCKET_WEBHOOK_SECRET is not set");
    return false;
  }
  if (!received) return false;

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(String(received));
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export const handleShiprocketWebhook = async (req, res) => {
  // Always ack fast; validate first.
  if (!isValidWebhookSecret(req)) {
    return handleResponse(res, 401, "Invalid webhook signature");
  }

  // Ack immediately so Shiprocket doesn't retry-storm us while we process.
  res.status(200).json({ received: true });

  try {
    const payload = req.body || {};

    const shiprocketOrderId = payload.order_id;
    const shipmentId = payload.shipment_id;
    const awbCode = payload.awb;
    const statusId = Number(payload.current_status_id ?? payload.status_id);
    const statusText = payload.current_status || payload.status;

    if (!shiprocketOrderId && !shipmentId && !awbCode) {
      console.warn("[Shiprocket Webhook] payload missing identifiers", payload);
      return;
    }

    const order = await Order.findOne({
      $or: [
        { "shipmentDetails.shiprocketOrderId": shiprocketOrderId },
        { "shipmentDetails.shiprocketShipmentId": shipmentId },
        { "shipmentDetails.awbCode": awbCode },
      ],
    });

    if (!order) {
      console.warn(
        `[Shiprocket Webhook] no matching order for shipment_id=${shipmentId} order_id=${shiprocketOrderId}`,
      );
      return;
    }

    // Idempotency guard — skip if we've already applied this exact status.
    if (order.shipmentDetails?.lastSyncedStatus === statusText) {
      return;
    }

    const mapping = SHIPROCKET_STATUS_MAP[statusId];

    const update = {
      "shipmentDetails.lastSyncedStatus": statusText,
      "shipmentDetails.lastSyncedAt": new Date(),
    };

    if (awbCode && !order.shipmentDetails?.awbCode) {
      update["shipmentDetails.awbCode"] = awbCode;
    }

    if (mapping) {
      if (mapping.orderStatus) {
        update.orderStatus = mapping.orderStatus;
        update.status = mapping.orderStatus;
      }
      if (mapping.workflowStatusKey && WORKFLOW_STATUS[mapping.workflowStatusKey]) {
        update.workflowStatus = WORKFLOW_STATUS[mapping.workflowStatusKey];
      }
      if (mapping.timestampField) {
        update[mapping.timestampField] = new Date();
      }
    } else {
      console.warn(`[Shiprocket Webhook] unmapped status_id=${statusId} (${statusText})`);
    }

    await Order.findByIdAndUpdate(order._id, { $set: update });

    // Notify customer on key transitions
    if (mapping?.workflowStatusKey === "OUT_FOR_DELIVERY" || mapping?.workflowStatusKey === "DELIVERED") {
      try {
        emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_STATUS_UPDATED, {
          userIds: [order.customer],
          orderId: order._id?.toString?.(),
          data: { status: update.orderStatus, awbCode: awbCode || order.shipmentDetails?.awbCode },
        });
      } catch (notifyErr) {
        console.error("[Shiprocket Webhook] notification emit failed:", notifyErr);
      }
    }
  } catch (err) {
    // Never throw past this point — response already sent.
    console.error("[Shiprocket Webhook] processing error:", err);
  }
};