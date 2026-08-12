import Admin from "../models/admin.js";
import handleResponse from "../utils/helper.js";

// Load assigned zones and categories for a sub-admin
export const loadSubadminZones = async (req, res, next) => {
  if (req.user?.role === "sub-admin") {
    try {
      const admin = await Admin.findById(req.user.id)
        .select("assignedZones assignedCategories categoryCommissionRate")
        .lean();
      req.assignedZones = admin?.assignedZones || [];
      req.assignedCategories = admin?.assignedCategories || [];
      req.categoryCommissionRate = admin?.categoryCommissionRate ?? null;
    } catch (err) {
      req.assignedZones = [];
      req.assignedCategories = [];
      req.categoryCommissionRate = null;
    }
  }
  next();
};

// Protect actions on specific entities by checking their zone matches the sub-admin's zones
export const enforceZoneAccess = (resolveZoneIdFn) => {
  return async (req, res, next) => {
    if (req.user?.role === "admin") {
      return next(); // Super Admin bypasses
    }

    if (req.user?.role === "sub-admin") {
      try {
        const targetZoneId = await resolveZoneIdFn(req);
        if (!targetZoneId) {
          return handleResponse(res, 403, "Access Denied: Resource has no zone assigned");
        }

        const hasAccess = req.assignedZones.some(
          (id) => String(id) === String(targetZoneId)
        );

        if (!hasAccess) {
          return handleResponse(res, 403, "Access Denied: You do not have permissions for this zone");
        }
      } catch (error) {
        return handleResponse(res, 500, error.message);
      }
    }

    next();
  };
};
