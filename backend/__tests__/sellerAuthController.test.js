import { jest } from "@jest/globals";

const mockSellerFindOne = jest.fn();
const mockSellerCreate = jest.fn();
const mockVerifySellerVerificationToken = jest.fn();
const mockUploadToCloudinary = jest.fn();

jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: {
    findOne: mockSellerFindOne,
    create: mockSellerCreate,
  },
}));

jest.unstable_mockModule("../app/services/sellerVerificationService.js", () => ({
  issueSellerVerificationOtp: jest.fn(),
  verifySellerOtpCode: jest.fn(),
  verifySellerVerificationToken: mockVerifySellerVerificationToken,
  issueSellerPasswordResetOtp: jest.fn(),
  verifySellerPasswordResetOtp: jest.fn(),
  resetSellerPasswordWithToken: jest.fn(),
}));

jest.unstable_mockModule("../app/services/mediaService.js", () => ({
  uploadToCloudinary: mockUploadToCloudinary,
}));

jest.unstable_mockModule("../app/utils/adminIds.js", () => ({
  getAdminIds: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({
  emitNotificationEvent: jest.fn(),
}));

const { signupSeller, checkSellerApprovalStatus } = await import("../app/controller/sellerAuthController.js");

describe("sellerAuthController signupSeller", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";

    req = {
      body: {
        name: "Seller Owner",
        email: "seller@example.com",
        phone: "9876543210",
        password: "secret123",
        emailVerificationToken: "email-token",
        phoneVerificationToken: "phone-token",
        shopName: "Noyo Mart",
        category: "Groceries",
        address: "MG Road",
        panNumber: "ABCDE1234F",
        bankDetails: {
          accountHolderName: "Seller Owner",
          bankName: "State Bank of India",
          branch: "Main Branch",
          accountNumber: "123456789012",
          ifscCode: "SBIN0001234",
        },
        documents: JSON.stringify({
          tradeLicense: "https://example.com/trade-license.pdf",
          gstCertificate: "https://example.com/gst.pdf",
          idProof: "https://example.com/id-proof.pdf",
          addressProof: "https://example.com/address-proof.pdf",
          cancelledCheque: "https://example.com/cheque.pdf",
        }),
      },
      files: [],
      ip: "127.0.0.1",
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockSellerFindOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
      then: (resolve, reject) => Promise.resolve(null).then(resolve, reject),
    });
    mockSellerCreate.mockImplementation(async (payload) => ({
      _id: "seller-1",
      ...payload,
    }));
  });

  it("requires both verified email and phone tokens before creating the seller", async () => {
    await signupSeller(req, res);

    expect(mockVerifySellerVerificationToken).toHaveBeenCalledTimes(2);
    expect(mockVerifySellerVerificationToken).toHaveBeenNthCalledWith(1, {
      channel: "email",
      rawValue: "seller@example.com",
      token: "email-token",
    });
    expect(mockVerifySellerVerificationToken).toHaveBeenNthCalledWith(2, {
      channel: "phone",
      rawValue: "9876543210",
      token: "phone-token",
    });
    expect(mockSellerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerified: true,
        phoneVerified: true,
        isVerified: false,
        isActive: false,
        applicationStatus: "pending",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("sellerAuthController checkSellerApprovalStatus", () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("returns 200 with approved = true when seller is approved and active", async () => {
    const mockSellerDoc = {
      _id: "seller-123",
      name: "Super Seller",
      shopName: "Super Shop",
      applicationStatus: "approved",
      isVerified: true,
      isActive: true,
    };

    mockSellerFindOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockSellerDoc),
      then: (resolve, reject) => Promise.resolve(mockSellerDoc).then(resolve, reject),
    });

    const req = {
      query: { sellerId: "seller-123" },
      user: null,
    };

    await checkSellerApprovalStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          sellerId: "seller-123",
          isApproved: true,
          applicationStatus: "approved",
        }),
      })
    );
  });

  it("returns 200 with approved = false when seller is pending review", async () => {
    const mockSellerDoc = {
      _id: "seller-123",
      name: "Pending Seller",
      shopName: "New Shop",
      applicationStatus: "pending",
      isVerified: false,
      isActive: false,
    };

    mockSellerFindOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockSellerDoc),
      then: (resolve, reject) => Promise.resolve(mockSellerDoc).then(resolve, reject),
    });

    const req = {
      query: { sellerId: "seller-123" },
      user: null,
    };

    await checkSellerApprovalStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          sellerId: "seller-123",
          isApproved: false,
          applicationStatus: "pending",
        }),
      })
    );
  });
});
