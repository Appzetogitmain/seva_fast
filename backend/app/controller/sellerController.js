import Seller from "../models/seller.js";
import Transaction from "../models/transaction.js";
import { handleResponse, calculateDistance } from "../utils/helper.js";
import mongoose from "mongoose";
import { invalidateSellerName } from "../services/entityNameCache.js";
import { registerOrUpdateSellerPickupLocation } from "../services/shiprocket/shiprocketOrderService.js";
import { invalidate } from "../services/cacheService.js";
import { geocodeAddress } from "../services/mapsGeocodeService.js";

/* ===============================
   GET NEARBY SELLERS
================================ */
export const getNearbySellers = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return handleResponse(res, 400, "Latitude and longitude are required");
    }

    const customerLat = Number(lat);
    const customerLng = Number(lng);

    // Fetch all active/verified sellers
    // We could use $geoNear, but to strictly follow the requirement of individual radii,
    // we'll fetch sellers within a reasonable max distance (e.g. 100km) and then filter.
    const sellers = await Seller.find({
      isActive: true,
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [customerLng, customerLat],
          },
          $maxDistance: 100000, // 100km max search area for performance
        },
      },
    }).lean();

    // Filter based on individual service radius
    const nearbySellers = sellers.filter((seller) => {
      const sellerLng = seller.location.coordinates[0];
      const sellerLat = seller.location.coordinates[1];
      const distance = calculateDistance(
        customerLat,
        customerLng,
        sellerLat,
        sellerLng,
      );

      // Add distance to seller object for frontend
      seller.distance = distance;

      return distance <= (seller.serviceRadius || 5);
    });

    return handleResponse(
      res,
      200,
      "Nearby sellers fetched successfully",
      nearbySellers,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REQUEST WITHDRAWAL (Seller)
================================ */
export const requestWithdrawal = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return handleResponse(res, 400, "Please enter a valid amount");
    }

    // 1. Calculate current available balance
    // Consistent with getSellerEarnings logic in sellerStatsController.js
    const transactions = await Transaction.find({
      user: sellerId,
      userModel: "Seller",
    })
      .select("status amount type")
      .lean();

    const settledBalance = transactions
      .filter((t) => t.status === "Settled")
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    const pendingPayouts = transactions
      .filter(
        (t) =>
          t.type === "Withdrawal" &&
          (t.status === "Pending" || t.status === "Processing"),
      )
      .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

    const availableBalance = settledBalance - pendingPayouts;

    if (amount > availableBalance) {
      return handleResponse(
        res,
        400,
        `Insufficient balance. Available: ₹${availableBalance}`,
      );
    }

    // 2. Create Withdrawal Transaction
    // Withdrawals have negative amounts per the model comment
    const withdrawal = await Transaction.create({
      user: sellerId,
      userModel: "Seller",
      type: "Withdrawal",
      amount: -Math.abs(amount),
      status: "Pending",
      reference: `WDR-${Date.now()}`,
    });

    return handleResponse(
      res,
      201,
      "Withdrawal request submitted successfully",
      withdrawal,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER PROFILE
================================ */
export const getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    if (seller.isVerified || seller.applicationStatus === "approved") {
      let needsSave = false;
      if (!seller.certificate) {
        seller.certificate = {};
        needsSave = true;
      }
      const cert = seller.certificate;
      if (!cert.sellerName || cert.sellerName === "-") { cert.sellerName = seller.name || ""; needsSave = true; }
      if (!cert.shopName || cert.shopName === "-") { cert.shopName = seller.shopName || ""; needsSave = true; }
      if (!cert.category || cert.category === "-") { cert.category = seller.category || "General"; needsSave = true; }
      if (!cert.cityLocation || cert.cityLocation === "-") { cert.cityLocation = seller.city || seller.address || seller.locality || seller.state || "Registered Location"; needsSave = true; }
      if (!cert.sellerId || cert.sellerId === "SF-PENDING") { cert.sellerId = seller.sellerCode || `SF-${seller._id.toString().slice(-6).toUpperCase()}`; needsSave = true; }
      if (!cert.certificateNo || cert.certificateNo === "SF-AS-PENDING") { cert.certificateNo = `SF-AS-${cert.sellerId.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString().slice(-4)}`; needsSave = true; }
      if (!cert.issueDate || cert.issueDate === "-") { cert.issueDate = seller.reviewedAt ? new Date(seller.reviewedAt).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"); needsSave = true; }
      if (!cert.validFrom || cert.validFrom === "-") { cert.validFrom = cert.issueDate; needsSave = true; }
      if (!cert.validUntil || cert.validUntil === "-") {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        cert.validUntil = nextYear.toLocaleDateString("en-IN");
        needsSave = true;
      }
      if (!cert.signatoryName) { cert.signatoryName = "SEVAFAST Operations"; needsSave = true; }

      if (needsSave) {
        seller.markModified("certificate");
        await seller.save();
      }
    }

    return handleResponse(
      res,
      200,
      "Seller profile fetched successfully",
      seller,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE SELLER PROFILE
================================ */
export const updateSellerProfile = async (req, res) => {
  try {
    const { name, shopName, phone, address, locality, pincode, city, state, lat, lng, radius } = req.body;

    // Find seller
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    // Update fields if provided
    if (name) seller.name = name;
    if (shopName) seller.shopName = shopName;
    if (phone) seller.phone = phone;
    if (address !== undefined) seller.address = address;
    if (locality !== undefined) seller.locality = locality;
    if (pincode !== undefined) seller.pincode = pincode;
    if (city !== undefined) seller.city = city;
    if (state !== undefined) seller.state = state;

    // Validate and update geo data
    let locationChanged = false;
    if (lat !== undefined && lng !== undefined) {
      if (lat < -90 || lat > 90)
        return handleResponse(res, 400, "Invalid latitude");
      if (lng < -180 || lng > 180)
        return handleResponse(res, 400, "Invalid longitude");

      seller.location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      };
      seller.markModified("location");
      locationChanged = true;
    } else {
      // No map pin in this request. If the seller still has no real location
      // saved (e.g. the map failed to load and they never placed a pin),
      // fall back to geocoding the free-text address they've submitted so
      // they aren't invisible to nearby customers. A precise map pin always
      // takes priority over this fallback and is never overwritten by it.
      const coords = seller.location?.coordinates;
      const hasRealLocation =
        Array.isArray(coords) && (coords[0] !== 0 || coords[1] !== 0);
      const addressText = [
        seller.address,
        seller.locality,
        seller.city,
        seller.state,
        seller.pincode,
      ]
        .filter((part) => part && String(part).trim())
        .join(", ");

      if (!hasRealLocation && addressText) {
        try {
          const geocoded = await geocodeAddress(addressText, { country: "IN" });
          seller.location = {
            type: "Point",
            coordinates: [geocoded.lng, geocoded.lat],
          };
          seller.markModified("location");
          locationChanged = true;
        } catch (err) {
          console.warn("[Seller] Address fallback geocoding failed:", err.message);
        }
      }
    }

    if (radius !== undefined) {
      if (radius < 1 || radius > 100)
        return handleResponse(res, 400, "Radius must be between 1 and 100 km");
      seller.serviceRadius = Number(radius);
    }

    const updatedSeller = await seller.save();

    // Invalidate cached nearby-seller lookups so customers see the new
    // location/radius immediately instead of the stale 5-minute cache
    if (locationChanged || radius !== undefined) {
      invalidate("cache:sellers:nearby:*").catch((err) => {
        console.warn("[Seller] Nearby sellers cache invalidation failed:", err.message);
      });
    }

    // Invalidate cached seller name in case shopName changed
    invalidateSellerName(req.user.id).catch((err) => {
      console.warn("[Seller] Name cache invalidation failed:", err.message);
    });

    // Sync pickup location to Shiprocket in background
    setImmediate(() => {
      registerOrUpdateSellerPickupLocation(updatedSeller).catch((err) => {
        console.warn("[Seller] Shiprocket pickup location sync failed:", err.message);
      });
    });

    return handleResponse(
      res,
      200,
      "Profile updated successfully",
      updatedSeller,
    );
  } catch (error) {
    // Handle duplicate phone error
    if (error.code === 11000) {
      return handleResponse(res, 400, "Phone number already in use");
    }
    return handleResponse(res, 500, error.message);
  }
};

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/* ===============================
   SELLER COD CASH SUMMARY
================================ */
export const getSellerCodCashSummary = async (req, res) => {
  try {
    const sellerId = req.user?.id ?? req.user?._id;
    if (!sellerId) {
      return handleResponse(res, 401, "Unauthorized");
    }

    const Order = (await import("../models/order.js")).default;
    const Wallet = (await import("../models/wallet.js")).default;
    const Delivery = (await import("../models/delivery.js")).default;

    const wallet = await Wallet.findOne({
      ownerType: "SELLER",
      ownerId: sellerId,
    })
      .select("cashInHand")
      .lean();

    const orders = await Order.find({
      seller: sellerId,
      paymentMode: "COD",
      status: { $ne: "cancelled" },
      orderStatus: { $ne: "cancelled" },
      "financeFlags.codCashWithSeller": true,
    })
      .select(
        "orderId status orderStatus deliveredAt createdAt financeFlags paymentBreakdown pricing deliveryBoy",
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Cash the rider collected but hasn't handed to the seller yet — this is
    // what the rider still owes the seller, per order.
    const heldByRiderOrders = await Order.find({
      seller: sellerId,
      paymentMode: "COD",
      status: { $ne: "cancelled" },
      orderStatus: { $ne: "cancelled" },
      "financeFlags.codCashWithRider": true,
      "financeFlags.codCashWithSeller": { $ne: true },
      "paymentBreakdown.codPendingAmount": { $gt: 0 },
    })
      .select("orderId deliveredAt createdAt paymentBreakdown pricing deliveryBoy")
      .populate("deliveryBoy", "name phone")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const heldByRider = heldByRiderOrders.map((order) => ({
      orderId: order.orderId,
      deliveredAt: order.deliveredAt || null,
      createdAt: order.createdAt || null,
      riderId: order.deliveryBoy?._id || null,
      riderName: order.deliveryBoy?.name || "Unassigned",
      riderPhone: order.deliveryBoy?.phone || "",
      amountGross: roundCurrency(order.paymentBreakdown?.grandTotal ?? order.pricing?.total ?? 0),
      riderCommission: roundCurrency(order.paymentBreakdown?.riderPayoutTotal ?? 0),
      amountOwedBySeller: roundCurrency(order.paymentBreakdown?.codPendingAmount ?? 0),
    }));
    const totalHeldByRiders = roundCurrency(
      heldByRider.reduce((sum, row) => sum + Number(row.amountOwedBySeller || 0), 0),
    );

    // Seller's own product-margin payout, per order — separate from COD cash
    // flow entirely. "Order Payment" transactions still Pending are what
    // admin has not yet released to the seller.
    const pendingAdminTxns = await Transaction.find({
      user: sellerId,
      userModel: "Seller",
      type: "Order Payment",
      status: "Pending",
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("order", "orderId")
      .lean();

    const owedByAdmin = pendingAdminTxns.map((txn) => ({
      orderId: txn.order?.orderId || txn.reference,
      amount: roundCurrency(txn.amount || 0),
      createdAt: txn.createdAt || null,
    }));
    const totalOwedByAdmin = roundCurrency(
      owedByAdmin.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    );

    const normalized = orders.map((order) => {
      const gross = roundCurrency(
        order.paymentBreakdown?.grandTotal ?? order.pricing?.total ?? 0,
      );
      const riderCommission = roundCurrency(
        order.paymentBreakdown?.riderPayoutTotal ?? 0,
      );
      const pendingNet = roundCurrency(
        order.paymentBreakdown?.codPendingAmount ?? 0,
      );
      const remittedNet = roundCurrency(
        order.paymentBreakdown?.codRemittedAmount ?? 0,
      );
      return {
        orderId: order.orderId,
        status: order.status,
        deliveredAt: order.deliveredAt || null,
        createdAt: order.createdAt || null,
        amountGross: gross,
        riderCommission,
        amountNetPending: pendingNet,
        amountNetRemitted: remittedNet,
      };
    });

    const pendingOrders = normalized.filter((row) => row.amountNetPending > 0);

    const totalPending = roundCurrency(
      pendingOrders.reduce((sum, row) => sum + Number(row.amountNetPending || 0), 0),
    );
    // Amount already remitted onward to admin — what's been settled so far.
    const totalSettled = roundCurrency(
      normalized.reduce((sum, row) => sum + Number(row.amountNetRemitted || 0), 0),
    );

    return handleResponse(res, 200, "Seller COD cash summary fetched", {
      cashInHand: roundCurrency(wallet?.cashInHand || 0),
      totalPending,
      totalSettled,
      pendingOrders,
      heldByRider,
      totalHeldByRiders,
      owedByAdmin,
      totalOwedByAdmin,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   SELLER REMIT COD CASH TO ADMIN
================================ */
export const submitSellerCodCashToAdmin = async (req, res) => {
  try {
    const sellerId = req.user?.id ?? req.user?._id;
    if (!sellerId) {
      return handleResponse(res, 401, "Unauthorized");
    }

    const Order = (await import("../models/order.js")).default;
    const Wallet = (await import("../models/wallet.js")).default;
    const { sellerCodPaySchema } = await import(
      "../validation/financeValidation.js"
    );
    const { sellerRemitCodCash } = await import(
      "../services/finance/orderFinanceService.js"
    );
    const { finalizeCodAfterAdminCredit } = await import(
      "../services/orderSettlement.js"
    );

    const { error, value: payload } = sellerCodPaySchema.validate(req.body || {}, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return handleResponse(
        res,
        400,
        error.details.map((item) => item.message).join("; "),
      );
    }

    const query = {
      seller: sellerId,
      paymentMode: "COD",
      status: { $ne: "cancelled" },
      orderStatus: { $ne: "cancelled" },
      "financeFlags.codCashWithSeller": true,
      "paymentBreakdown.codPendingAmount": { $gt: 0 },
    };
    if (payload.orderId) {
      query.orderId = payload.orderId;
    }

    const orders = await Order.find(query)
      .select("orderId paymentBreakdown.codPendingAmount")
      .sort({ createdAt: 1 })
      .lean();

    if (!orders.length) {
      return handleResponse(res, 400, "No COD cash pending with seller to remit");
    }

    const totalAvailable = roundCurrency(
      orders.reduce(
        (sum, order) => sum + Number(order?.paymentBreakdown?.codPendingAmount || 0),
        0,
      ),
    );
    const amountToSubmit =
      payload.amount == null ? totalAvailable : roundCurrency(payload.amount);

    if (amountToSubmit <= 0) {
      return handleResponse(res, 400, "Enter a valid amount to remit");
    }
    if (amountToSubmit > totalAvailable) {
      return handleResponse(
        res,
        400,
        `You can remit up to ${String.fromCharCode(8377)}${totalAvailable.toLocaleString()}`,
      );
    }

    const settledOrders = [];
    let totalSubmitted = 0;
    let remaining = amountToSubmit;

    for (const order of orders) {
      const pending = roundCurrency(order?.paymentBreakdown?.codPendingAmount || 0);
      if (pending <= 0 || remaining <= 0) continue;
      const settleAmount = roundCurrency(Math.min(pending, remaining));

      const remitted = await sellerRemitCodCash(order._id, settleAmount, {
        actorId: sellerId,
      });
      await finalizeCodAfterAdminCredit(remitted._id, remitted.orderId);

      totalSubmitted = roundCurrency(totalSubmitted + settleAmount);
      remaining = roundCurrency(remaining - settleAmount);
      settledOrders.push({
        orderId: order.orderId,
        amount: settleAmount,
      });
    }

    if (totalSubmitted <= 0) {
      return handleResponse(res, 400, "No COD cash was remitted");
    }

    await Transaction.create({
      user: sellerId,
      userModel: "Seller",
      type: "Cash Settlement",
      amount: -Math.abs(totalSubmitted),
      status: "Settled",
      reference: `CSH-SELLER-${sellerId}-${Date.now()}`,
      meta: {
        source: "seller_cod_cash_page",
        orders: settledOrders.map((item) => item.orderId),
      },
    });

    const wallet = await Wallet.findOne({
      ownerType: "SELLER",
      ownerId: sellerId,
    })
      .select("cashInHand")
      .lean();

    return handleResponse(res, 200, "COD cash remitted to admin successfully", {
      totalSubmitted,
      orderCount: settledOrders.length,
      orders: settledOrders,
      cashInHand: roundCurrency(wallet?.cashInHand || 0),
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
