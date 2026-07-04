import { jest } from "@jest/globals";

const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockCompensate = jest.fn();
const mockEmitOrderStatusUpdate = jest.fn();
const mockEmitNotificationEvent = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}));

jest.unstable_mockModule("../app/services/orderCompensation.js", () => ({
  compensateOrderCancellation: mockCompensate,
}));

jest.unstable_mockModule("../app/services/orderSocketEmitter.js", () => ({
  emitOrderStatusUpdate: mockEmitOrderStatusUpdate,
  emitToSeller: jest.fn(),
  emitDeliveryBroadcastForSeller: jest.fn(),
  emitToCustomer: jest.fn(),
  retractDeliveryBroadcastForOrder: jest.fn(),
}));

jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: mockEmitNotificationEvent,
}));

jest.unstable_mockModule("../app/queues/orderQueues.js", () => ({
  sellerTimeoutQueue: { add: jest.fn() },
  deliveryTimeoutQueue: { add: jest.fn() },
  JOB_NAMES: {},
}));

jest.unstable_mockModule("../app/config/redis.js", () => ({
  getRedisClient: jest.fn(() => null),
}));

const { processSellerTimeoutJob } = await import("../app/services/orderWorkflowService.js");
const { WORKFLOW_STATUS } = await import("../app/constants/orderWorkflow.js");

describe("processSellerTimeoutJob expiresAt handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("unsets expiresAt when cancelling after seller timeout", async () => {
    const past = new Date(Date.now() - 5000);
    const cancelledOrder = {
      orderId: "ORD-TIMEOUT-1",
      customer: "cust1",
      seller: "seller1",
      _id: "mongo1",
      workflowStatus: WORKFLOW_STATUS.CANCELLED,
    };

    mockFindOne.mockResolvedValue({
      orderId: "ORD-TIMEOUT-1",
      workflowVersion: 2,
      workflowStatus: WORKFLOW_STATUS.SELLER_PENDING,
      sellerPendingExpiresAt: past,
    });

    mockFindOneAndUpdate.mockResolvedValue(cancelledOrder);
    mockCompensate.mockResolvedValue(undefined);

    await processSellerTimeoutJob({ orderId: "ORD-TIMEOUT-1" });

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ORD-TIMEOUT-1" }),
      expect.objectContaining({
        $set: expect.objectContaining({
          workflowStatus: WORKFLOW_STATUS.CANCELLED,
          cancelReason: "Seller timeout (60s)",
        }),
        $unset: { expiresAt: 1 },
      }),
      { new: true },
    );
    expect(mockCompensate).toHaveBeenCalledWith(cancelledOrder, "ORD-TIMEOUT-1");
  });
});
