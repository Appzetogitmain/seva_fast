import Delivery from "../../models/delivery.js";
import Order from "../../models/order.js";
import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import { notify } from "../../modules/notifications/notification.service.js";
import { NOTIFICATION_EVENTS } from "../../modules/notifications/notification.constants.js";

export const getDeliveryPartners = async (req, res) => {
  try {
    const { status, verified } = req.query;
    const query = {};

    if (status === "online") {
      query.isOnline = true;
    } else if (status === "offline") {
      query.isOnline = false;
    }

    if (verified === "true") {
      query.isVerified = true;
    } else if (verified === "false") {
      query.isVerified = false;
    }

    if (req.user.role === "seller") {
      query.sellerId = req.user.id;
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

    return handleResponse(res, 200, "Delivery partners fetched successfully", {
      items: deliveryPartners,
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
    const updateQuery = { _id: id };
    if (req.user.role === "seller") {
      updateQuery.sellerId = req.user.id;
    }
    const rider = await Delivery.findOneAndUpdate(
      updateQuery,
      { isVerified: true, isOnline: true },
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
    const deleteQuery = { _id: id };
    if (req.user.role === "seller") {
      deleteQuery.sellerId = req.user.id;
    }
    const rider = await Delivery.findOneAndDelete(deleteQuery);

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

    const query = { _id: id };
    if (req.user.role === "seller") {
      query.sellerId = req.user.id;
    }

    const rider = await Delivery.findOne(query);
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
