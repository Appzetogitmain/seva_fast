import { jest } from "@jest/globals";

const mockFind = jest.fn();
const mockCountDocuments = jest.fn();

jest.unstable_mockModule("../app/models/authActivityLog.js", () => ({
  default: {
    find: mockFind,
    countDocuments: mockCountDocuments,
    create: jest.fn(),
  },
}));

const { listAuthActivityLogs } = await import("../app/services/authActivityService.js");

describe("auth activity service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: "log-1",
          role: "seller",
          action: "login",
          userName: "Test Seller",
          createdAt: new Date(),
        },
      ]),
    });
    mockCountDocuments.mockResolvedValue(1);
  });

  it("lists auth activity logs with filters", async () => {
    const result = await listAuthActivityLogs({
      page: 1,
      limit: 10,
      role: "seller",
      action: "login",
      search: "Test",
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].roleLabel).toBe("Seller");
    expect(mockCountDocuments).toHaveBeenCalled();
  });
});
