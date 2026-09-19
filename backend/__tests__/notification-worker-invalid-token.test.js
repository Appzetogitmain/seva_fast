import { jest } from "@jest/globals";

const mockNotificationFindById = jest.fn();
const mockNotificationUpdateOne = jest.fn();
const mockPushTokenFind = jest.fn();
const mockPushTokenUpdateMany = jest.fn();
const mockPreferenceFindOne = jest.fn();
const mockSendFCM = jest.fn();

jest.unstable_mockModule("../app/modules/notifications/preference.model.js", () => ({
  default: {
    findOne: mockPreferenceFindOne,
  },
}));

jest.unstable_mockModule("../app/modules/notifications/notification.model.js", () => ({
  default: {
    findById: mockNotificationFindById,
    updateOne: mockNotificationUpdateOne,
  },
}));

jest.unstable_mockModule("../app/modules/notifications/token.model.js", () => ({
  default: {
    find: mockPushTokenFind,
    updateMany: mockPushTokenUpdateMany,
  },
}));

jest.unstable_mockModule("../app/modules/notifications/firebase.service.js", () => ({
  sendFCM: mockSendFCM,
}));

jest.unstable_mockModule("../app/modules/notifications/notification.queue.js", () => ({
  notificationQueue: {
    process: jest.fn(),
    on: jest.fn(),
  },
  notificationDeadQueue: {
    add: jest.fn(),
  },
  NOTIFICATION_JOB_NAMES: {
    SEND: "send-notification",
    DEAD_LETTER: "dead-notification",
  },
  getNotificationQueueStats: jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    size: 0,
  }),
}));

jest.unstable_mockModule("../app/config/redis.js", () => ({
  isRedisEnabled: () => true,
}));

jest.unstable_mockModule("../app/services/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule("../app/services/metrics.js", () => ({
  incrementCounter: jest.fn(),
  recordHistogram: jest.fn(),
  setGauge: jest.fn(),
}));

const { processNotificationJob } = await import(
  "../app/modules/notifications/notification.worker.js"
);

describe("notification worker invalid token cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockNotificationFindById.mockResolvedValue({
      _id: "notif-1",
      userId: "67f000000000000000000001",
      role: "customer",
      type: "ORDER_PLACED",
      title: "Order Placed",
      body: "Your order has been placed successfully.",
      message: "Your order has been placed successfully.",
      data: { orderId: "ORD-1", link: "/orders/ORD-1" },
    });

    mockPushTokenFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: "token-1", token: "token-good" },
          { _id: "token-2", token: "token-bad" },
        ]),
      }),
    });

    mockSendFCM.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: "messaging/registration-token-not-registered" },
        },
      ],
    });

    mockPreferenceFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        pushNotifications: true,
        sound: true,
        vibration: true,
      }),
    });

    mockNotificationUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockPushTokenUpdateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  test("deactivates invalid tokens and marks notification as sent when partial success exists", async () => {
    await processNotificationJob({
      data: {
        notificationId: "notif-1",
      },
    });

    expect(mockSendFCM).toHaveBeenCalledTimes(1);
    expect(mockPushTokenUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ["token-2"] } },
      expect.objectContaining({
        $set: expect.objectContaining({
          isActive: false,
          invalidReason: "FCM_TOKEN_INVALID",
        }),
      }),
    );
    expect(mockNotificationUpdateOne).toHaveBeenCalledWith(
      { _id: "notif-1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "sent",
        }),
      }),
    );
  });

  test("skips FCM delivery when user has pushNotifications turned off in preferences", async () => {
    mockPreferenceFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        pushNotifications: false,
        sound: false,
        vibration: false,
      }),
    });

    await processNotificationJob({
      data: {
        notificationId: "notif-1",
      },
    });

    expect(mockSendFCM).not.toHaveBeenCalled();
    expect(mockNotificationUpdateOne).toHaveBeenCalledWith(
      { _id: "notif-1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "sent",
          failureReason: "Push notifications disabled by user preference",
        }),
      }),
    );
  });
});

describe("notification worker platform routing", () => {
  const setTokens = (docs) =>
    mockPushTokenFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(docs) }),
    });
  const ok = (n) => ({
    successCount: n,
    failureCount: 0,
    responses: Array.from({ length: n }, () => ({ success: true })),
  });
  const dead = (n) => ({
    successCount: 0,
    failureCount: n,
    responses: Array.from({ length: n }, () => ({
      success: false,
      error: { code: "messaging/registration-token-not-registered" },
    })),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationFindById.mockResolvedValue({
      _id: "notif-2",
      userId: "67f000000000000000000002",
      role: "customer",
      type: "SUPPORT_TICKET_MESSAGE",
      title: "Support reply",
      body: "hello",
      message: "hello",
      data: { ticketId: "t1" },
    });
    mockPreferenceFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ pushNotifications: true }),
    });
    mockNotificationUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockPushTokenUpdateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  test("app token + web token -> sends only to the app token", async () => {
    setTokens([
      { _id: "w1", token: "web-1", platform: "web" },
      { _id: "a1", token: "app-1", platform: "app" },
    ]);
    mockSendFCM.mockResolvedValue(ok(1));

    await processNotificationJob({ data: { notificationId: "notif-2" } });

    expect(mockSendFCM).toHaveBeenCalledTimes(1);
    expect(mockSendFCM.mock.calls[0][0]).toEqual(["app-1"]);
    expect(mockSendFCM.mock.calls[0][2]).toEqual(expect.objectContaining({ platform: "app" }));
  });

  test("web token only -> still delivered to web", async () => {
    setTokens([{ _id: "w1", token: "web-1", platform: "web" }]);
    mockSendFCM.mockResolvedValue(ok(1));

    await processNotificationJob({ data: { notificationId: "notif-2" } });

    expect(mockSendFCM).toHaveBeenCalledTimes(1);
    expect(mockSendFCM.mock.calls[0][0]).toEqual(["web-1"]);
    expect(mockSendFCM.mock.calls[0][2]).toEqual(expect.objectContaining({ platform: "web" }));
  });

  test("identical app token strings are sent once", async () => {
    setTokens([
      { _id: "a1", token: "app-1", platform: "app" },
      { _id: "a2", token: "app-1", platform: "app" },
    ]);
    mockSendFCM.mockResolvedValue(ok(1));

    await processNotificationJob({ data: { notificationId: "notif-2" } });

    expect(mockSendFCM.mock.calls[0][0]).toEqual(["app-1"]);
  });

  test("all app tokens dead -> deactivates them and falls back to web", async () => {
    setTokens([
      { _id: "a1", token: "app-1", platform: "app" },
      { _id: "w1", token: "web-1", platform: "web" },
    ]);
    mockSendFCM.mockResolvedValueOnce(dead(1)).mockResolvedValueOnce(ok(1));

    await processNotificationJob({ data: { notificationId: "notif-2" } });

    expect(mockSendFCM).toHaveBeenCalledTimes(2);
    expect(mockSendFCM.mock.calls[1][0]).toEqual(["web-1"]);
    expect(mockPushTokenUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ["a1"] } },
      expect.objectContaining({
        $set: expect.objectContaining({ isActive: false, invalidReason: "FCM_TOKEN_INVALID" }),
      }),
    );
  });
});
