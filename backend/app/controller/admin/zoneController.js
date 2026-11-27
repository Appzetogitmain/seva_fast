import Zone from "../../models/zone.js";
import Seller from "../../models/seller.js";
import Delivery from "../../models/delivery.js";
import Order from "../../models/order.js";
import Admin from "../../models/admin.js";
import handleResponse from "../../utils/helper.js";
import { clearZoneResolverCache } from "../../utils/zoneResolver.js";
import { clearSubadminPermissionCache } from "../../middleware/subadminPermissions.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cityRegex = (name) => new RegExp(`^\\s*${escapeRegex(String(name).trim())}\\s*$`, "i");
const normalize = (value) => String(value || "").trim().toLowerCase();

/**
 * Zones are matched to sellers by city name. After a zone is created or
 * renamed, give every seller WITHOUT a zone whose city matches it this zone,
 * and give those sellers' unzoned orders the same zone. Nothing that already
 * has a zone is changed.
 */
async function assignZoneToMatchingSellers(zone) {
  if (!zone?.name || zone.status === "inactive") return { sellersAssigned: 0, ordersAssigned: 0 };
  const sellers = await Seller.find({
    city: cityRegex(zone.name),
    $or: [{ zoneId: null }, { zoneId: { $exists: false } }],
  })
    .select("_id")
    .lean();
  const sellerIds = sellers.map((s) => s._id);
  if (!sellerIds.length) return { sellersAssigned: 0, ordersAssigned: 0 };

  await Seller.updateMany({ _id: { $in: sellerIds } }, { $set: { zoneId: zone._id } });
  const orders = await Order.updateMany(
    { seller: { $in: sellerIds }, $or: [{ zoneId: null }, { zoneId: { $exists: false } }] },
    { $set: { zoneId: zone._id } },
  );
  return { sellersAssigned: sellerIds.length, ordersAssigned: orders.modifiedCount || 0 };
}

export const getZones = async (req, res) => {
  try {
    const zones = await Zone.find({}).sort({ name: 1 }).lean();

    // Main admin only: match counts per zone + seller cities, so a misspelt
    // zone name (matching no sellers) is visible immediately.
    if (req.user?.role !== "admin") {
      return handleResponse(res, 200, "Zones retrieved successfully", { zones });
    }

    const [sellerCounts, riderCounts, cityRows] = await Promise.all([
      Seller.aggregate([{ $match: { zoneId: { $ne: null } } }, { $group: { _id: "$zoneId", n: { $sum: 1 } } }]),
      Delivery.aggregate([{ $match: { zoneId: { $ne: null } } }, { $group: { _id: "$zoneId", n: { $sum: 1 } } }]),
      Seller.aggregate([
        { $match: { city: { $nin: [null, ""] } } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: "$city" } } },
            label: { $first: { $trim: { input: "$city" } } },
            sellers: { $sum: 1 },
            withoutZone: { $sum: { $cond: [{ $ifNull: ["$zoneId", false] }, 0, 1] } },
          },
        },
        { $sort: { sellers: -1 } },
      ]),
    ]);

    const sellersByZone = new Map(sellerCounts.map((r) => [String(r._id), r.n]));
    const ridersByZone = new Map(riderCounts.map((r) => [String(r._id), r.n]));
    const zoneNames = new Set(zones.map((z) => normalize(z.name)));
    const cityCounts = new Map(cityRows.map((r) => [r._id, r.sellers]));

    const enriched = zones.map((z) => ({
      ...z,
      sellerCount: sellersByZone.get(String(z._id)) || 0,
      riderCount: ridersByZone.get(String(z._id)) || 0,
      // sellers whose city is exactly this zone's name
      cityMatchCount: cityCounts.get(normalize(z.name)) || 0,
    }));

    const sellerCities = cityRows.map((r) => ({
      city: r.label,
      sellers: r.sellers,
      sellersWithoutZone: r.withoutZone,
      hasZone: zoneNames.has(r._id),
    }));

    return handleResponse(res, 200, "Zones retrieved successfully", { zones: enriched, sellerCities });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const createZone = async (req, res) => {
  try {
    const { description, coordinates } = req.body;
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return handleResponse(res, 400, "Zone name is required");
    }

    const existing = await Zone.findOne({ name: cityRegex(name) });
    if (existing) {
      return handleResponse(res, 409, "Zone with this name already exists");
    }

    const zone = await Zone.create({
      name,
      description,
      coordinates: coordinates ? { type: "Polygon", coordinates } : undefined,
    });

    clearZoneResolverCache();
    const assigned = await assignZoneToMatchingSellers(zone);

    return handleResponse(res, 201, buildMessage("Zone created", zone, assigned), { zone, ...assigned });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, coordinates, status } = req.body;
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;

    const zone = await Zone.findById(id);
    if (!zone) {
      return handleResponse(res, 404, "Zone not found");
    }

    if (name && name !== zone.name) {
      const existing = await Zone.findOne({ name: cityRegex(name), _id: { $ne: zone._id } });
      if (existing) {
        return handleResponse(res, 409, "Zone with this name already exists");
      }
      zone.name = name;
    }

    if (description !== undefined) zone.description = description;
    if (coordinates !== undefined) {
      zone.coordinates = { type: "Polygon", coordinates };
    }
    if (status !== undefined) zone.status = status;

    await zone.save();
    clearZoneResolverCache();
    // A fixed spelling / re-activated zone picks up sellers that were missed.
    const assigned = await assignZoneToMatchingSellers(zone);

    return handleResponse(res, 200, buildMessage("Zone updated", zone, assigned), { zone, ...assigned });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findByIdAndDelete(id);
    if (!zone) {
      return handleResponse(res, 404, "Zone not found");
    }
    // Don't leave records pointing at a zone that no longer exists.
    await Promise.all([
      Seller.updateMany({ zoneId: zone._id }, { $set: { zoneId: null } }),
      Delivery.updateMany({ zoneId: zone._id }, { $set: { zoneId: null } }),
      Order.updateMany({ zoneId: zone._id }, { $set: { zoneId: null } }),
      Admin.updateMany({ assignedZones: zone._id }, { $pull: { assignedZones: zone._id } }),
    ]);
    clearZoneResolverCache();
    clearSubadminPermissionCache();
    return handleResponse(res, 200, "Zone deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

function buildMessage(prefix, zone, { sellersAssigned, ordersAssigned }) {
  if (!sellersAssigned) return `${prefix} successfully`;
  return `${prefix}: ${sellersAssigned} seller(s) with city "${zone.name}" and ${ordersAssigned} of their order(s) were added to this zone`;
}
