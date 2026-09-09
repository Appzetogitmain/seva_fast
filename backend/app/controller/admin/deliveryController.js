import Delivery from "../../models/delivery.js";
import Order from "../../models/order.js";
import Wallet from "../../models/wallet.js";
import Transaction from "../../models/transaction.js";
import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import { roundCurrency } from "../../utils/money.js";
import { notify } from "../../modules/notifications/notification.service.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";

export const getDeliveryPartners = async (req, res) => {
  try {
    const { status, verified, search } = req.query;
    const query = {};

    if (status === "online" || status === "available") {
      query.isOnline = true;
    } else if (status === "offline") {
      query.isOnline = false;
    }

    if (verified === "true") {
      query.isVerified = true;
    } else if (verified === "false") {
      query.isVerified = false;
      query.isPhoneVerified = { $ne: false };
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { currentArea: searchRegex },
        { preferredArea: searchRegex },
      ];
    }

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 200,
    });

    const [deliveryPartners, total] = await Promise.all([
      Delivery.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Delivery.countDocuments(query),
    ]);

    const partnerIds = deliveryPartners.map((dp) => dp._id);

    // Fetch live wallet balances, completed deliveries, and earnings
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [wallets, orderCounts, earningsAgg] = await Promise.all([
      Wallet.find({
        ownerType: "DELIVERY_PARTNER",
        ownerId: { $in: partnerIds },
      }).lean(),
      Order.aggregate([
        {
          $match: {
            deliveryBoy: { $in: partnerIds },
            status: "delivered",
          },
        },
        {
          $group: {
            _id: "$deliveryBoy",
            totalDeliveries: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            user: { $in: partnerIds },
            userModel: "Delivery",
            status: "Settled",
            type: { $in: ["Delivery Earning", "Incentive", "Bonus"] },
          },
        },
        {
          $group: {
            _id: "$user",
            totalEarnings: { $sum: "$amount" },
            todayEarnings: {
              $sum: {
                $cond: [{ $gte: ["$createdAt", startOfToday] }, "$amount", 0],
              },
            },
          },
        },
      ]),
    ]);

    const walletMap = new Map(wallets.map((w) => [String(w.ownerId), w]));
    const orderCountMap = new Map(
      orderCounts.map((o) => [String(o._id), o.totalDeliveries]),
    );
    const earningsMap = new Map(earningsAgg.map((e) => [String(e._id), e]));

    const enrichedItems = deliveryPartners.map((dp) => {
      const w = walletMap.get(String(dp._id));
      const totalDeliveries = orderCountMap.get(String(dp._id)) || 0;
      const earn = earningsMap.get(String(dp._id));
      const totalEarnings = roundCurrency(earn?.totalEarnings || 0);
      const todayEarnings = roundCurrency(earn?.todayEarnings || 0);
      const walletBalance = roundCurrency(w?.availableBalance || 0);
      const cashInHand = roundCurrency(w?.cashInHand || 0);
      const rating =
        typeof dp.rating === "number" ? Number(dp.rating.toFixed(1)) : 5.0;

      return {
        ...dp,
        totalDeliveries,
        totalOrders: totalDeliveries,
        todayEarnings,
        totalEarnings,
        walletBalance,
        cashInHand,
        rating,
      };
    });

    return handleResponse(res, 200, "Delivery partners fetched successfully", {
      items: enrichedItems,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const approveDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Delivery.findOneAndUpdate(
      { _id: id },
      { isVerified: true, isPhoneVerified: true, isOnline: true },
      { new: true },
    );

    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    try {
      await notify(NOTIFICATION_EVENTS.DELIVERY_APPROVED, {
        deliveryId: rider._id,
      });
    } catch (err) {
      console.error("Failed to notify delivery partner of approval", err);
    }

    return handleResponse(res, 200, "Rider approved successfully", rider);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const rider = await Delivery.findOneAndDelete({ _id: id });

    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    try {
      await notify(NOTIFICATION_EVENTS.DELIVERY_REJECTED, {
        deliveryId: rider._id,
      });
    } catch (err) {
      console.error("Failed to notify delivery partner of rejection", err);
    }

    return handleResponse(
      res,
      200,
      "Rider application rejected and removed",
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      email,
      vehicleType,
      vehicleNumber,
      currentArea,
      isOnline,
    } = req.body || {};

    const rider = await Delivery.findOne({ _id: id });
    if (!rider) {
      return handleResponse(res, 404, "Rider not found");
    }

    if (name !== undefined) rider.name = String(name).trim();
    if (phone !== undefined) rider.phone = String(phone).trim();
    if (email !== undefined) rider.email = String(email).trim();
    if (vehicleType !== undefined) rider.vehicleType = vehicleType;
    if (vehicleNumber !== undefined) rider.vehicleNumber = vehicleNumber;
    if (currentArea !== undefined) rider.currentArea = currentArea;
    if (typeof isOnline === "boolean") rider.isOnline = isOnline;

    await rider.save();

    return handleResponse(res, 200, "Delivery partner updated successfully", rider);
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 409, "Phone or email already in use");
    }
    return handleResponse(res, 500, error.message);
  }
};

export const getActiveFleet = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 200,
    });

    const query = {
      deliveryBoy: { $ne: null },
      status: {
        $in: ["confirmed", "packed", "shipped", "out_for_delivery"],
      },
    };

    if (req.user.role === "seller") {
      query.seller = req.user.id;
    }

    const [activeOrders, total] = await Promise.all([
      Order.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("deliveryBoy", "name phone documents vehicleType")
        .populate("seller", "shopName address name")
        .populate("customer", "name phone")
        .lean(),
      Order.countDocuments(query),
    ]);

    const fleetData = activeOrders.map((order) => ({
      id: order.orderId,
      status:
        order.status === "out_for_delivery"
          ? "On the Way"
          : order.status === "packed"
            ? "At Pickup"
            : order.status === "shipped"
              ? "In Transit"
              : "Assigned",
      deliveryBoy: {
        name: order.deliveryBoy?.name || "Unknown",
        phone: order.deliveryBoy?.phone || "N/A",
        id: order.deliveryBoy?._id || "N/A",
        vehicle: order.deliveryBoy?.vehicleType || "N/A",
        image:
          order.deliveryBoy?.documents?.profileImage ||
          "https://via.placeholder.com/200",
      },
      seller: {
        name: order.seller?.shopName || order.seller?.name || "Unknown",
      },
      customer: {
        name: order.customer?.name || "Guest",
        phone: order.customer?.phone || "N/A",
      },
      lastUpdate: order.updatedAt,
    }));

    return handleResponse(res, 200, "Active fleet fetched successfully", {
      items: fleetData,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
