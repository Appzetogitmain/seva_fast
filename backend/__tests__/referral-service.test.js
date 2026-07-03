import { jest } from "@jest/globals";

const mockFindOne = jest.fn();
const mockCreate = jest.fn();

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: {
    findOne: mockFindOne,
    create: mockCreate,
  },
}));

const { resolveReferrerByCode, resolvePlanPurchaseReferrer } = await import("../app/services/referralService.js");

describe("referralService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates default SEVAFAST admin referrer when missing", async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ _id: "admin-1", referralCode: "SEVAFAST", role: "admin" });

    const referrer = await resolveReferrerByCode("sevafast");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        referralCode: "SEVAFAST",
        role: "admin",
      }),
    );
    expect(referrer._id).toBe("admin-1");
  });

  it("returns null for unknown referral codes", async () => {
    mockFindOne.mockResolvedValue(null);

    const referrer = await resolveReferrerByCode("UNKNOWN");

    expect(referrer).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("falls back to SEVAFAST for self-referral during plan purchase", async () => {
    mockFindOne
      .mockResolvedValueOnce({ _id: "buyer-1", referralCode: "A04B6BB3" })
      .mockResolvedValueOnce({ _id: "admin-1", referralCode: "SEVAFAST", role: "admin" });

    const referredBy = await resolvePlanPurchaseReferrer("buyer-1", {
      referralCode: "A04B6BB3",
    });

    expect(String(referredBy)).toBe("admin-1");
  });

  it("uses a valid third-party referral for plan purchase", async () => {
    mockFindOne.mockResolvedValueOnce({ _id: "referrer-2", referralCode: "A04B6BB3" });

    const referredBy = await resolvePlanPurchaseReferrer("buyer-1", {
      referralCode: "A04B6BB3",
    });

    expect(String(referredBy)).toBe("referrer-2");
  });
});
