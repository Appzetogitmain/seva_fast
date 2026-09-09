import { jest } from "@jest/globals";
import { PAYOUT_TYPE, OWNER_TYPE } from "../app/constants/finance.js";

const mockWalletFindOne = jest.fn();
const mockWalletCreate = jest.fn();
const mockPayoutFindOne = jest.fn();
const mockPayoutCreate = jest.fn();
const mockLedgerCreate = jest.fn();

jest.unstable_mockModule("../app/models/wallet.js", () => ({
  default: {
    findOne: mockWalletFindOne,
    create: mockWalletCreate,
  },
}));

jest.unstable_mockModule("../app/models/payout.js", () => ({
  default: {
    findOne: mockPayoutFindOne,
    create: mockPayoutCreate,
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    create: jest.fn(),
  },
}));

jest.unstable_mockModule("../app/models/financeAuditLog.js", () => ({
  default: {
    create: jest.fn(),
  },
}));

jest.unstable_mockModule("../app/services/finance/ledgerService.js", () => ({
  createLedgerEntry: mockLedgerCreate,
}));

const { createPendingPayoutForOrder } = await import(
  "../app/services/finance/payoutService.js"
);
const { getOrCreateWallet } = await import(
  "../app/services/finance/walletService.js"
);

describe("createPendingPayoutForOrder & getOrCreateWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("correctly creates wallet with OWNER_TYPE.DELIVERY_PARTNER when queuing rider payout", async () => {
    mockPayoutFindOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(null),
    });

    const fakeWallet = {
      _id: "wallet-rider-1",
      ownerType: OWNER_TYPE.DELIVERY_PARTNER,
      ownerId: "rider-1",
      pendingBalance: 0,
      totalCredited: 0,
      status: "ACTIVE",
      save: jest.fn().mockResolvedValue(true),
    };

    mockWalletFindOne.mockResolvedValue(null);
    mockWalletCreate.mockResolvedValue([fakeWallet]);

    mockPayoutCreate.mockResolvedValue([
      {
        _id: "payout-1",
        payoutType: PAYOUT_TYPE.DELIVERY_PARTNER,
        beneficiaryId: "rider-1",
        amount: 50,
      },
    ]);

    const fakeOrder = {
      _id: "order-mongo-1",
      orderId: "ORD12345",
      status: "delivered",
      paymentMode: "ONLINE",
    };

    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    const result = await createPendingPayoutForOrder(
      {
        order: fakeOrder,
        payoutType: PAYOUT_TYPE.DELIVERY_PARTNER,
        beneficiaryId: "rider-1",
        amount: 50,
      },
      { session },
    );

    expect(result).toBeDefined();
    expect(mockWalletCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          ownerType: "DELIVERY_PARTNER",
          ownerId: "rider-1",
        }),
      ],
      expect.anything(),
    );
  });

  it("normalizes RIDER string alias in getOrCreateWallet without error", async () => {
    const fakeWallet = {
      _id: "wallet-rider-2",
      ownerType: "DELIVERY_PARTNER",
      ownerId: "rider-2",
    };
    mockWalletFindOne.mockResolvedValue(fakeWallet);

    const wallet = await getOrCreateWallet("RIDER", "rider-2");
    expect(wallet.ownerType).toBe("DELIVERY_PARTNER");
    expect(mockWalletFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: "DELIVERY_PARTNER",
        ownerId: "rider-2",
      }),
      null,
      expect.anything(),
    );
  });
});
