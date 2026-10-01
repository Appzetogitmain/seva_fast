import { jest } from "@jest/globals";

const mockUserFindById = jest.fn();
const mockPlanFindById = jest.fn();
const mockTransactionFindOne = jest.fn();
const mockTransactionExists = jest.fn();
const mockTransactionCreate = jest.fn();
const mockOrderCountDocuments = jest.fn();
const mockOrderFind = jest.fn();
const mockSellerFind = jest.fn();

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: { findById: mockUserFindById },
}));
jest.unstable_mockModule("../app/models/plan.js", () => ({
  default: { findById: mockPlanFindById },
}));
jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: { find: mockSellerFind },
}));
jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    findOne: mockTransactionFindOne,
    exists: mockTransactionExists,
    create: mockTransactionCreate,
  },
}));
jest.unstable_mockModule("../app/models/order.js", () => ({
  default: { countDocuments: mockOrderCountDocuments, find: mockOrderFind },
}));

const { processOrderLevelCommissions, processMonthlyTurnoverCommissions } = await import(
  "../app/services/finance/commissionService.js"
);

// A user lookup that supports both `await findById(id)` and `findById(id).lean()`.
const userLookup = (users) => (id) => {
  const user = users[String(id)] || null;
  const result = Promise.resolve(user);
  result.lean = () => Promise.resolve(user);
  return result;
};

describe("order level referral commission", () => {
  const order = { _id: "order-2", customer: "buyer-1", pricing: { total: 1000 } };
  let referrerSave;

  beforeEach(() => {
    jest.clearAllMocks();
    referrerSave = jest.fn().mockResolvedValue({});
    mockUserFindById.mockImplementation(
      userLookup({
        "buyer-1": { _id: "buyer-1", name: "Buyer", referredBy: "ref-1" },
        "ref-1": { _id: "ref-1", role: "user", walletBalance: 0, save: referrerSave },
      }),
    );
    mockTransactionExists.mockResolvedValue(null);
    mockTransactionCreate.mockResolvedValue({});
  });

  it("matches delivered orders by the stored DELIVERED status", async () => {
    mockOrderCountDocuments.mockResolvedValue(0);
    await processOrderLevelCommissions(order);

    const filter = mockOrderCountDocuments.mock.calls[0][0];
    expect(filter.$or).toEqual(
      expect.arrayContaining([{ workflowStatus: "DELIVERED" }, { status: "delivered" }]),
    );
  });

  it("pays 10% to the direct referrer on the customer's first delivered order", async () => {
    mockOrderCountDocuments.mockResolvedValue(0);
    await processOrderLevelCommissions(order);

    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ user: "ref-1", amount: 100, reference: "LVL-COMM-order-2-1" }),
    );
  });

  it("pays nothing when the customer already has a delivered order", async () => {
    mockOrderCountDocuments.mockResolvedValue(1);
    await processOrderLevelCommissions(order);

    expect(mockTransactionCreate).not.toHaveBeenCalled();
    expect(referrerSave).not.toHaveBeenCalled();
  });

  it("does not pay twice if the order is settled again", async () => {
    mockOrderCountDocuments.mockResolvedValue(0);
    mockTransactionExists.mockResolvedValue({ _id: "existing" });
    await processOrderLevelCommissions(order);

    expect(mockTransactionCreate).not.toHaveBeenCalled();
    expect(referrerSave).not.toHaveBeenCalled();
  });
});

describe("monthly seller turnover commission", () => {
  it("sums delivered orders using pricing.total", async () => {
    jest.clearAllMocks();
    const userSave = jest.fn().mockResolvedValue({});
    mockSellerFind.mockReturnValue({
      lean: () => Promise.resolve([{ _id: "seller-1", shopName: "Shop", onboardedBy: "user-1" }]),
    });
    mockUserFindById.mockResolvedValue({
      _id: "user-1",
      role: "user",
      currentPlan: "plan-1",
      planExpiry: new Date(Date.now() + 86400000),
      walletBalance: 0,
      save: userSave,
    });
    mockPlanFindById.mockResolvedValue({ features: [{ key: "TURNOVER_COMMISSION", value: 2 }] });
    mockTransactionFindOne.mockResolvedValue(null);
    mockOrderFind.mockReturnValue({
      lean: () => Promise.resolve([{ pricing: { total: 500 } }, { pricing: { total: 1500 } }]),
    });
    mockTransactionCreate.mockResolvedValue({});

    const result = await processMonthlyTurnoverCommissions();

    expect(result.processed).toBe(1);
    expect(mockOrderFind.mock.calls[0][0].$or).toEqual(
      expect.arrayContaining([{ workflowStatus: "DELIVERED" }, { status: "delivered" }]),
    );
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ user: "user-1", amount: 40, type: "Incentive" }),
    );
  });
});
