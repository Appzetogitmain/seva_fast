import { jest } from "@jest/globals";

const mockOrderFind = jest.fn();
const mockOrderCountDocuments = jest.fn();
const mockDeliveryFindById = jest.fn();
const mockSellerFind = jest.fn();
const mockDistanceMeters = jest.fn();

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    find: mockOrderFind,
    countDocuments: mockOrderCountDocuments,
  },
}));

jest.unstable_mockModule("../app/models/delivery.js", () => ({
  default: {
    findById: mockDeliveryFindById,
  },
}));

jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: {
    find: mockSellerFind,
  },
}));

jest.unstable_mockModule("../app/utils/geoUtils.js", () => ({
  distanceMeters: mockDistanceMeters,
}));

const {
  buildSellerOrdersQuery,
  fetchAvailableOrdersForDelivery,
} = await import("../app/services/orderQueryService.js");

function makeOrderQueryChain(result) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

function makeSelectChain(result) {
  return {
    select: jest.fn().mockResolvedValue(result),
  };
}

describe("orderQueryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("buildSellerOrdersQuery maps sidebar status values and date range", () => {
    const query = buildSellerOrdersQuery({
      role: "seller",
      userId: "seller-1",
      statusParam: "processed",
      startDate: "2026-03-01",
      endDate: "2026-03-29",
    });

    expect(query.seller).toBe("seller-1");
    expect(query.status).toEqual({ $in: ["confirmed", "packed"] });
    expect(query.createdAt.$gte).toEqual(new Date("2026-03-01"));
    expect(query.createdAt.$lte.getFullYear()).toBe(2026);
    expect(query.createdAt.$lte.getMonth()).toBe(2);
    expect(query.createdAt.$lte.getDate()).toBe(29);
    expect(query.createdAt.$lte.getHours()).toBe(23);
    expect(query.createdAt.$lte.getMinutes()).toBe(59);
    expect(query.createdAt.$lte.getSeconds()).toBe(59);
    expect(query.createdAt.$lte.getMilliseconds()).toBe(999);
  });

  test("fetchAvailableOrdersForDelivery returns seller-assigned orders only", async () => {
    mockOrderFind.mockImplementation((query) => {
      if (query.returnStatus) {
        return makeOrderQueryChain([]);
      }
      if (query.workflowStatus) {
        expect(query.deliveryBoy).toBe("rider-1");
        expect(query.workflowStatus.$in).toEqual(["DELIVERY_SEARCH", "DELIVERY_ASSIGNED"]);
        return makeOrderQueryChain([
          {
            orderId: "ORD-1",
            seller: { shopName: "Store A" },
          },
        ]);
      }
      expect(query.deliveryBoy).toBe("rider-1");
      return makeOrderQueryChain([
        {
          orderId: "ORD-2",
          seller: { shopName: "Store B" },
        },
      ]);
    });

    const result = await fetchAvailableOrdersForDelivery({
      userId: "rider-1",
      requestedLimit: "10",
    });

    expect(result.requiresLocation).toBe(false);
    expect(result.orders.map((order) => order.orderId)).toEqual(["ORD-1", "ORD-2"]);
    expect(mockDeliveryFindById).not.toHaveBeenCalled();
    expect(mockSellerFind).not.toHaveBeenCalled();
  });
});
