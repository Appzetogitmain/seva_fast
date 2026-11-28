import { jest } from "@jest/globals";

const store = new Map();
const mockMarkCod = jest.fn();
const mockRto = jest.fn();
const mockSettle = jest.fn();

function hydrate(raw) {
  const doc = JSON.parse(JSON.stringify(raw));
  doc.save = async () => { store.set(doc._id, JSON.parse(JSON.stringify(doc))); };
  doc.markModified = () => {};
  return doc;
}

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: async (q) => {
      const ors = q.$or || [];
      for (const raw of store.values()) {
        if (ors.some((c) => (c.orderId && c.orderId === raw.orderId) ||
          (c["shipmentDetails.awbCode"] && c["shipmentDetails.awbCode"] === raw.shipmentDetails?.awbCode))) {
          return hydrate(raw);
        }
      }
      return null;
    },
    findByIdAndUpdate: jest.fn(),
  },
}));
jest.unstable_mockModule("../app/services/orderSettlement.js", () => ({ applyDeliveredSettlement: mockSettle }));
jest.unstable_mockModule("../app/services/finance/orderFinanceService.js", () => ({
  markCodCollectedByCourier: mockMarkCod,
  recoverShippingChargeOnRto: mockRto,
}));
jest.unstable_mockModule("../app/services/orderSocketEmitter.js", () => ({ emitOrderStatusUpdate: jest.fn() }));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({ emitNotificationEvent: jest.fn() }));
jest.unstable_mockModule("../app/modules/notifications/notification.constants.js", () => ({ NOTIFICATION_EVENTS: {} }));
jest.unstable_mockModule("../app/services/logger.js", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { handleShiprocketWebhook } = await import("../app/controller/shippingWebhookController.js");

function res() {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const hook = (body) => {
  const r = res();
  return handleShiprocketWebhook({ body, headers: {} }, r).then(() => r);
};

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
  delete process.env.SHIPROCKET_WEBHOOK_SECRET;
  store.set("o1", {
    _id: "o1", orderId: "ORD1", status: "confirmed", orderStatus: "confirmed",
    deliveryType: "scheduled", paymentMode: "COD", shipmentDetails: { awbCode: "AWB1" },
  });
});

test("DELIVERED: COD courier collection then settlement, once even if webhook repeats", async () => {
  await hook({ awb: "AWB1", current_status: "DELIVERED" });
  await hook({ awb: "AWB1", current_status: "DELIVERED" });
  await hook({ awb: "AWB1", current_status: "delivered" });
  expect(mockMarkCod).toHaveBeenCalledTimes(1);
  expect(mockSettle).toHaveBeenCalledTimes(1);
  expect(mockMarkCod.mock.invocationCallOrder[0]).toBeLessThan(mockSettle.mock.invocationCallOrder[0]);
});

test("RTO statuses always invoke the (idempotent) RTO recovery, even after cancellation", async () => {
  await hook({ awb: "AWB1", current_status: "RTO INITIATED" });
  await hook({ awb: "AWB1", current_status: "RTO DELIVERED" });
  expect(mockRto).toHaveBeenCalledTimes(2);
  expect(mockRto).toHaveBeenLastCalledWith("o1", { rtoStatus: "RTO DELIVERED" });
  expect(store.get("o1").status).toBe("cancelled");
});

test("plain CANCELLED does not charge RTO", async () => {
  await hook({ awb: "AWB1", current_status: "CANCELLED" });
  expect(mockRto).not.toHaveBeenCalled();
});

test("finance errors are logged and do not fail the webhook", async () => {
  mockMarkCod.mockRejectedValueOnce(new Error("db down"));
  const r = await hook({ awb: "AWB1", current_status: "DELIVERED" });
  expect(r.code).toBe(200);
  expect(mockSettle).toHaveBeenCalledTimes(1);
});
