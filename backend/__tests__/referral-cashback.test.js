import { jest } from "@jest/globals";
import mongoose from "mongoose";

// Chainable query stub: supports .select().lean().populate().session() and await.
const q = (value) => {
  const chain = {
    select: () => chain,
    lean: () => chain,
    populate: () => chain,
    session: () => chain,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return chain;
};

const mockCustomerFindById = jest.fn();
const mockCustomerFindByIdAndUpdate = jest.fn();
const mockOrderExists = jest.fn();
const mockOrderUpdateOne = jest.fn();
const mockRewardExists = jest.fn();
const mockRewardCreate = jest.fn();
const mockRewardCount = jest.fn();
const mockRewardFindById = jest.fn();
const mockRewardUpdateOne = jest.fn();
const mockTxFindOne = jest.fn();
const mockTxCreate = jest.fn();
const mockEmit = jest.fn();

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: { findById: mockCustomerFindById, findByIdAndUpdate: mockCustomerFindByIdAndUpdate },
}));
jest.unstable_mockModule("../app/models/order.js", () => ({
  default: { exists: mockOrderExists, updateOne: mockOrderUpdateOne, find: jest.fn() },
}));
jest.unstable_mockModule("../app/models/setting.js", () => ({ default: { findOne: jest.fn() } }));
jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: { findOne: mockTxFindOne, create: mockTxCreate },
}));
jest.unstable_mockModule("../app/models/referralReward.js", () => ({
  default: {
    exists: mockRewardExists,
    create: mockRewardCreate,
    countDocuments: mockRewardCount,
    findById: mockRewardFindById,
    updateOne: mockRewardUpdateOne,
  },
}));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: mockEmit,
}));

const {
  computeRewardAmount,
  getQualifyingOrderAmount,
  detectFraudSignals,
  evaluateOrderForReferralCashback,
  FRAUD_SIGNALS,
} = await import("../app/services/referralCashbackService.js");

const baseConfig = {
  enabled: true,
  rewardType: "fixed",
  rewardValue: 50,
  maxRewardAmount: 0,
  minOrderValue: 200,
  maxRewardsPerReferrerPerMonth: 0,
  effectiveFrom: new Date("2026-01-01"),
};

describe("reward math", () => {
  test("fixed amount ignores order value", () => {
    expect(computeRewardAmount(baseConfig, 999)).toBe(50);
  });
  test("percent amount is capped by maxRewardAmount", () => {
    const cfg = { ...baseConfig, rewardType: "percent", rewardValue: 10, maxRewardAmount: 75 };
    expect(computeRewardAmount(cfg, 500)).toBe(50);
    expect(computeRewardAmount(cfg, 2000)).toBe(75);
  });
  test("percent with no cap", () => {
    const cfg = { ...baseConfig, rewardType: "percent", rewardValue: 5, maxRewardAmount: 0 };
    expect(computeRewardAmount(cfg, 3333)).toBe(166.65);
  });
  test("qualifying amount prefers subtotal, falls back to total", () => {
    expect(getQualifyingOrderAmount({ pricing: { subtotal: 400, total: 460 } })).toBe(400);
    expect(getQualifyingOrderAmount({ pricing: { total: 460 } })).toBe(460);
  });
});

describe("fraud signals", () => {
  const referrer = {
    phone: "+919876543210",
    signupDeviceId: "dev-1",
    signupIp: "1.2.3.4",
    addresses: [{ fullAddress: "12 MG Road, Pune", location: { lat: 18.52, lng: 73.85 } }],
  };
  test("clean referral has no signals", () => {
    const signals = detectFraudSignals({
      customer: { signupDeviceId: "dev-2", signupIp: "5.6.7.8" },
      referrer,
      order: { address: { phone: "9123456789", address: "Elsewhere", location: { lat: 19.07, lng: 72.87 } } },
    });
    expect(signals).toEqual([]);
  });
  test("same device, network, phone and nearby address are all flagged", () => {
    const signals = detectFraudSignals({
      customer: { signupDeviceId: "dev-1", signupIp: "1.2.3.4" },
      referrer,
      order: { address: { phone: "9876543210", location: { lat: 18.5201, lng: 73.8501 } } },
    });
    expect(signals).toEqual(
      expect.arrayContaining([
        FRAUD_SIGNALS.SAME_DEVICE,
        FRAUD_SIGNALS.SAME_SIGNUP_IP,
        FRAUD_SIGNALS.SAME_PHONE,
        FRAUD_SIGNALS.SAME_ADDRESS,
      ]),
    );
  });
  test("empty device ids never match each other", () => {
    const signals = detectFraudSignals({
      customer: { signupDeviceId: "", signupIp: "" },
      referrer: { ...referrer, signupDeviceId: "", signupIp: "", addresses: [] },
      order: { address: {} },
    });
    expect(signals).toEqual([]);
  });
});

describe("evaluateOrderForReferralCashback", () => {
  const order = {
    _id: "order-1",
    orderId: "ORD-1",
    customer: "friend-1",
    deliveredAt: new Date("2026-11-01"),
    pricing: { subtotal: 500, total: 540 },
    address: { phone: "9000000001", address: "Friend Street" },
  };
  const friend = { _id: "friend-1", name: "Friend", phone: "+919000000001", referredBy: "ref-1" };
  const referrer = {
    _id: "ref-1",
    name: "Referrer",
    phone: "+919000000002",
    role: "user",
    referralCode: "ABC123",
    isActive: true,
    addresses: [],
  };

  const users = (map) => (id) => q(map[String(id)] || null);

  beforeEach(() => {
    jest.clearAllMocks();
    mockRewardExists.mockResolvedValue(null);
    mockOrderExists.mockResolvedValue(null);
    mockRewardCount.mockResolvedValue(0);
    mockRewardCreate.mockImplementation(async (doc) => ({ _id: "reward-1", ...doc }));
    mockCustomerFindById.mockImplementation(users({ "friend-1": friend, "ref-1": referrer }));
  });

  test("skips customers who were not referred", async () => {
    mockCustomerFindById.mockImplementation(users({ "friend-1": { ...friend, referredBy: null } }));
    await expect(evaluateOrderForReferralCashback(order, baseConfig)).resolves.toBe("not_referred");
    expect(mockRewardCreate).not.toHaveBeenCalled();
  });

  test("pays a friend only once", async () => {
    mockRewardExists.mockResolvedValue({ _id: "existing" });
    await expect(evaluateOrderForReferralCashback(order, baseConfig)).resolves.toBe("already_rewarded");
  });

  test("only the first delivered order qualifies", async () => {
    mockOrderExists.mockResolvedValue({ _id: "older-order" });
    await expect(evaluateOrderForReferralCashback(order, baseConfig)).resolves.toBe("not_first_order");
    expect(mockRewardCreate).not.toHaveBeenCalled();
  });

  test("no cashback for the platform default SEVAFAST code", async () => {
    mockCustomerFindById.mockImplementation(
      users({ "friend-1": friend, "ref-1": { ...referrer, role: "admin", referralCode: "SEVAFAST" } }),
    );
    await expect(evaluateOrderForReferralCashback(order, baseConfig)).resolves.toBe("platform_referrer");
    expect(mockRewardCreate).not.toHaveBeenCalled();
  });

  test("below minimum order value is recorded as ineligible", async () => {
    const result = await evaluateOrderForReferralCashback(order, { ...baseConfig, minOrderValue: 1000 });
    expect(result).toBe("ineligible");
    expect(mockRewardCreate).toHaveBeenCalledWith(expect.objectContaining({ status: "ineligible", amount: 0 }));
  });

  test("monthly cap blocks further rewards", async () => {
    mockRewardCount.mockResolvedValue(3);
    const result = await evaluateOrderForReferralCashback(order, {
      ...baseConfig,
      maxRewardsPerReferrerPerMonth: 3,
    });
    expect(result).toBe("ineligible");
  });

  test("suspicious referral is flagged and not paid", async () => {
    mockCustomerFindById.mockImplementation(
      users({
        "friend-1": { ...friend, signupDeviceId: "same-device" },
        "ref-1": { ...referrer, signupDeviceId: "same-device" },
      }),
    );
    const result = await evaluateOrderForReferralCashback(order, baseConfig);
    expect(result).toBe("flagged");
    expect(mockRewardCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "flagged", amount: 50, fraudSignals: [FRAUD_SIGNALS.SAME_DEVICE] }),
    );
    expect(mockCustomerFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("clean referral credits the wallet, writes a ledger row and notifies", async () => {
    const reward = {
      _id: "reward-1",
      referrer: "ref-1",
      referredCustomer: "friend-1",
      order: "order-1",
      amount: 50,
      status: "processing",
      save: jest.fn().mockResolvedValue({}),
    };
    mockRewardFindById.mockImplementation(() => q(reward));
    mockTxFindOne.mockImplementation(() => q(null));
    mockCustomerFindByIdAndUpdate.mockResolvedValue({ walletBalance: 150 });
    mockTxCreate.mockResolvedValue([{}]);
    const fakeSession = {
      withTransaction: async (fn) => fn(),
      endSession: jest.fn(),
    };
    const spy = jest.spyOn(mongoose, "startSession").mockResolvedValue(fakeSession);

    const result = await evaluateOrderForReferralCashback(order, baseConfig);

    expect(result).toBe("credited");
    expect(mockCustomerFindByIdAndUpdate).toHaveBeenCalledWith(
      "ref-1",
      { $inc: { walletBalance: 50 } },
      expect.any(Object),
    );
    expect(mockTxCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ type: "Cashback", amount: 50, reference: "REF-CASHBACK-friend-1" })],
      expect.any(Object),
    );
    expect(reward.status).toBe("credited");
    expect(mockEmit).toHaveBeenCalledWith(
      "REFERRAL_CASHBACK_CREDITED",
      expect.objectContaining({ customerId: "ref-1" }),
    );
    spy.mockRestore();
  });
});
