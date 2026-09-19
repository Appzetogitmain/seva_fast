/**
 * Opt-in end-to-end test: admin reply -> replyToTicket controller -> notify() ->
 * real Notification/PushToken models -> real notification worker -> (stubbed) FCM.
 *
 * Runs against a throwaway database (dropped afterwards), never the app's real one.
 * Only sendFCM (real pushes), the socket emitter and WhatsApp are stubbed.
 *
 *   E2E_NOTIF_MONGO_URI=<cluster uri> npm test -- support-ticket-push-e2e
 */
import { jest } from "@jest/globals";
import mongoose from "mongoose";

const MONGO_URI = process.env.E2E_NOTIF_MONGO_URI;
const run = MONGO_URI ? describe : describe.skip;
jest.setTimeout(60000);

const mockSendFCM = jest.fn();

jest.unstable_mockModule("../app/modules/notifications/firebase.service.js", () => ({
  sendFCM: mockSendFCM,
}));
jest.unstable_mockModule("../app/services/ticketSocketEmitter.js", () => ({
  emitTicketCreated: jest.fn(),
  emitTicketMessage: jest.fn(),
}));
jest.unstable_mockModule("../app/modules/whatsapp/whatsapp.dispatcher.js", () => ({
  dispatchWhatsAppForEvent: jest.fn(),
}));

process.env.REDIS_DISABLED = "true";

const { replyToTicket } = await import("../app/controller/ticketController.js");
const { default: Ticket } = await import("../app/models/ticket.js");
const { default: Notification } = await import("../app/modules/notifications/notification.model.js");
const { default: PushToken } = await import("../app/modules/notifications/token.model.js");

const oid = () => new mongoose.Types.ObjectId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake FCM: tokens named "dead-*" are rejected as unregistered, everything else succeeds.
function fakeFcm(tokens) {
  const responses = tokens.map((t) =>
    String(t).startsWith("dead-")
      ? { success: false, error: { code: "messaging/registration-token-not-registered" } }
      : { success: true },
  );
  const successCount = responses.filter((r) => r.success).length;
  return Promise.resolve({ successCount, failureCount: responses.length - successCount, responses });
}

async function adminReply(customerId, text) {
  const ticket = await Ticket.create({
    userId: customerId,
    userType: "Customer",
    subject: "Support Chat",
    description: "help",
    messages: [{ sender: "User", senderId: customerId, senderType: "User", text: "help" }],
  });
  const res = { statusCode: 0, status(c) { this.statusCode = c; return this; }, json() { return this; } };
  await replyToTicket(
    { body: { text, isAdmin: true }, params: { id: String(ticket._id) }, user: { id: String(oid()), name: "Admin" } },
    res,
  );
  expect(res.statusCode).toBe(200);
  return ticket;
}

async function waitForNotifications(customerId, expectedCount = 1) {
  for (let i = 0; i < 50; i += 1) {
    const docs = await Notification.find({ userId: customerId, type: "SUPPORT_TICKET_MESSAGE" }).lean();
    if (docs.length >= expectedCount && docs.every((d) => d.status !== "pending")) return docs;
    await sleep(100);
  }
  return Notification.find({ userId: customerId, type: "SUPPORT_TICKET_MESSAGE" }).lean();
}

const addToken = (userId, token, platform) =>
  PushToken.create({ userId, role: "customer", userModel: "User", token, platform, isActive: true });

run("support ticket reply push - end to end", () => {
  const dbName = `e2e_support_push_${Date.now()}`;

  beforeAll(async () => {
    process.env.NODE_ENV = "development"; // notification.emitter no-ops under NODE_ENV=test
    await mongoose.connect(MONGO_URI, { dbName, serverSelectionTimeoutMS: 20000 });
    expect(mongoose.connection.db.databaseName).toBe(dbName); // never touch a real database
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db.databaseName === dbName) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
    process.env.NODE_ENV = "test";
  });

  beforeEach(() => {
    mockSendFCM.mockReset();
    mockSendFCM.mockImplementation((tokens) => fakeFcm(tokens));
  });

  test("customer with app + web token gets ONE push, on the app token only", async () => {
    const customerId = oid();
    await addToken(customerId, "web-good-1", "web");
    await addToken(customerId, "app-good-1", "app");

    await adminReply(customerId, "how can i help you?");
    const docs = await waitForNotifications(customerId);

    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe("sent");
    expect(mockSendFCM).toHaveBeenCalledTimes(1);
    expect(mockSendFCM.mock.calls[0][0]).toEqual(["app-good-1"]);
    expect(docs[0].deliveryStats).toEqual(expect.objectContaining({ attempted: 1, sent: 1 }));
  });

  test("customer with only a web token still gets the push", async () => {
    const customerId = oid();
    await addToken(customerId, "web-good-2", "web");

    await adminReply(customerId, "web only reply");
    const docs = await waitForNotifications(customerId);

    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe("sent");
    expect(mockSendFCM).toHaveBeenCalledTimes(1);
    expect(mockSendFCM.mock.calls[0][0]).toEqual(["web-good-2"]);
  });

  test("dead app token is deactivated and delivery falls back to web", async () => {
    const customerId = oid();
    await addToken(customerId, "dead-app-1", "app");
    await addToken(customerId, "web-good-3", "web");

    await adminReply(customerId, "fallback reply");
    const docs = await waitForNotifications(customerId);

    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe("sent");
    expect(mockSendFCM.mock.calls.map((c) => c[0])).toEqual([["dead-app-1"], ["web-good-3"]]);

    const dead = await PushToken.findOne({ token: "dead-app-1" }).lean();
    const web = await PushToken.findOne({ token: "web-good-3" }).lean();
    expect(dead.isActive).toBe(false);
    expect(dead.invalidReason).toBe("FCM_TOKEN_INVALID");
    expect(web.isActive).toBe(true);
  });

  test("two separate replies produce two notifications, each delivered once", async () => {
    const customerId = oid();
    await addToken(customerId, "app-good-4", "app");
    await addToken(customerId, "web-good-4", "web");

    await adminReply(customerId, "first reply");
    await waitForNotifications(customerId, 1);
    await adminReply(customerId, "second reply");
    const docs = await waitForNotifications(customerId, 2);

    expect(docs).toHaveLength(2);
    expect(mockSendFCM).toHaveBeenCalledTimes(2);
    expect(mockSendFCM.mock.calls.every((c) => c[0].length === 1 && c[0][0] === "app-good-4")).toBe(true);
  });
});
