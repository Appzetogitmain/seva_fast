/**
 * Shiprocket -> internal order status mapping.
 *
 * Shiprocket sends `current_status` (string, human readable) and
 * `current_status_id` (number) in both API responses and webhooks.
 * We map on the numeric id since Shiprocket has changed status strings
 * in the past but ids have stayed stable. Ref: Shiprocket API docs
 * (Track Order / Webhooks section).
 *
 * Adjust WORKFLOW_STATUS keys below to match your own
 * ../constants/orderWorkflow.js enum values.
 */

export const SHIPROCKET_STATUS_ID = {
  NEW: 1,
  INVOICED: 2,
  READY_TO_SHIP: 4,
  PICKUP_SCHEDULED: 5,
  PICKED_UP: 6,
  IN_TRANSIT: 18,
  OUT_FOR_DELIVERY: 19,
  DELIVERED: 7,
  CANCELED: 8,
  RTO_INITIATED: 9,
  RTO_DELIVERED: 10,
  LOST: 15,
  PICKUP_EXCEPTION: 16,
  UNDELIVERED: 17,
  DELIVERY_DELAYED: 42,
};

/**
 * Maps a Shiprocket status id to:
 *  - orderStatus: legacy string status field on your Order model
 *  - workflowStatus: value that should exist in your WORKFLOW_STATUS enum
 *  - timestampField: field on Order to stamp with `new Date()` (optional)
 *
 * IMPORTANT: workflowStatus strings here are placeholders — replace them
 * with the actual values exported from ../constants/orderWorkflow.js
 * (e.g. WORKFLOW_STATUS.OUT_FOR_DELIVERY) inside the webhook controller,
 * don't rely on raw strings in production.
 */
export const SHIPROCKET_STATUS_MAP = {
  [SHIPROCKET_STATUS_ID.PICKUP_SCHEDULED]: {
    orderStatus: "packed",
    workflowStatusKey: "PICKUP_SCHEDULED",
  },
  [SHIPROCKET_STATUS_ID.PICKED_UP]: {
    orderStatus: "out_for_delivery",
    workflowStatusKey: "PICKED_UP",
    timestampField: "pickupConfirmedAt",
  },
  [SHIPROCKET_STATUS_ID.IN_TRANSIT]: {
    orderStatus: "out_for_delivery",
    workflowStatusKey: "IN_TRANSIT",
  },
  [SHIPROCKET_STATUS_ID.OUT_FOR_DELIVERY]: {
    orderStatus: "out_for_delivery",
    workflowStatusKey: "OUT_FOR_DELIVERY",
    timestampField: "outForDeliveryAt",
  },
  [SHIPROCKET_STATUS_ID.DELIVERED]: {
    orderStatus: "delivered",
    workflowStatusKey: "DELIVERED",
    timestampField: "deliveredAt",
  },
  [SHIPROCKET_STATUS_ID.CANCELED]: {
    orderStatus: "cancelled",
    workflowStatusKey: "CANCELLED",
  },
  [SHIPROCKET_STATUS_ID.RTO_INITIATED]: {
    orderStatus: "out_for_delivery",
    workflowStatusKey: "RTO_INITIATED",
  },
  [SHIPROCKET_STATUS_ID.RTO_DELIVERED]: {
    orderStatus: "cancelled",
    workflowStatusKey: "RTO_DELIVERED",
  },
  [SHIPROCKET_STATUS_ID.UNDELIVERED]: {
    orderStatus: "out_for_delivery",
    workflowStatusKey: "DELIVERY_EXCEPTION",
  },
  [SHIPROCKET_STATUS_ID.PICKUP_EXCEPTION]: {
    orderStatus: "packed",
    workflowStatusKey: "PICKUP_EXCEPTION",
  },
};