import { jest } from "@jest/globals";

const mockUserFindById = jest.fn();
const mockPlanFindById = jest.fn();
const mockTransactionFindOne = jest.fn();
const mockTransactionCreate = jest.fn();

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule("../app/models/plan.js", () => ({
  default: {
    findById: mockPlanFindById,
  },
}));

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    findOne: mockTransactionFindOne,
    create: mockTransactionCreate,
  },
}));

const { processPlanPurchaseLevelCommissions } = await import(
  "../app/services/finance/commissionService.js"
);

describe("plan purchase referral commissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    mockTransactionCreate.mockResolvedValue({});
  });

  it("credits referrer using purchased plan level commission, not referrer plan", async () => {
    const buyerId = "buyer-1";
    const referrerId = "referrer-1";
    const referrerSave = jest.fn().mockResolvedValue({});

    const users = {
      [buyerId]: { _id: buyerId, name: "shivamm", referredBy: referrerId },
      [referrerId]: {
        _id: referrerId,
        role: "user",
        referralCode: "A04B6BB3",
        currentPlan: "silver-plan",
        planExpiry: new Date(Date.now() + 86400000),
        walletBalance: 100,
        save: referrerSave,
      },
    };

    mockUserFindById.mockImplementation((id) => {
      const user = users[String(id)];
      if (!user) {
        return { lean: jest.fn().mockResolvedValue(null) };
      }
      return {
        lean: jest.fn().mockResolvedValue(user),
        ...user,
      };
    });

    mockPlanFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "bornz-plan",
        name: "Bornz",
        features: [
          { key: "REFERRAL_LEVELS", value: 5 },
          { key: "LEVEL_COMMISSION", value: [20, 10, 10, 5, 5] },
        ],
      }),
    });

    const result = await processPlanPurchaseLevelCommissions({
      buyerId,
      planPrice: 199,
      planId: "bornz-plan",
      planName: "Bornz",
      paymentReference: "pay_test_1",
    });

    expect(result.credited).toBe(1);
    expect(referrerSave).toHaveBeenCalled();
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user: referrerId,
        amount: 39.8,
        type: "Commission",
        reference: "PLAN-LVL-COMM-pay_test_1-1-referrer-1",
        meta: expect.objectContaining({
          commissionPercent: 20,
          planPrice: 199,
        }),
      }),
    );
  });
});
