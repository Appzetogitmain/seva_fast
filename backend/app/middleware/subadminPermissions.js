import mongoose from "mongoose";
import Admin from "../models/admin.js";
import Seller from "../models/seller.js";
import Delivery from "../models/delivery.js";
import Order from "../models/order.js";

/**
 * Server-side enforcement of sub-admin permissions.
 *
 * Each rule maps an API path (relative to /api) + method to the panel
 * permission(s) that allow it — the same names the main admin ticks when
 * creating a sub-admin (Admin → Sub-Admins). A sub-admin may call a route
 * only if a rule matches AND they hold one of its permissions.
 * Unmatched routes are DENIED for sub-admins (default deny).
 *
 *   perms: "*"          → any logged-in sub-admin (own profile, uploads…)
 *   perms: "ADMIN_ONLY" → main admin only, never a sub-admin
 *   perms: [..names]    → any one of these permissions
 */
const ANY = "*";
const ADMIN_ONLY = "ADMIN_ONLY";

const RULES = [
  // ---- main-admin only (privilege / money-sensitive) ----
  { path: /^\/admin\/subadmins(\/|$)/, perms: ADMIN_ONLY },
  { path: /^\/admin\/users\/[^/]+\/(wallet|status)$/, perms: ADMIN_ONLY },
  { method: "DELETE", path: /^\/admin\/users\/[^/]+$/, perms: ADMIN_ONLY },
  { path: /^\/admin\/signup$/, perms: ADMIN_ONLY },

  // ---- available to every sub-admin ----
  { path: /^\/admin\/profile(\/|$)/, perms: ANY },
  { path: /^\/admin\/ai(\/|$)/, perms: ANY },
  { path: /^\/media\/upload$/, perms: ANY },
  { path: /^\/notifications(\/[^/]+\/read|\/mark-all-read)?$/, perms: ANY },
  { method: "GET", path: /^\/admin\/categories(\/|$)/, perms: ANY }, // reference data for many pages

  // ---- Dashboard / analytics ----
  { path: /^\/admin\/stats(\/|$)/, perms: ["Dashboard"] },
  { path: /^\/admin\/dashboard(\/|$)/, perms: ["Dashboard"] },
  { path: /^\/categories(\/|$)/, perms: ["Categories"] },
  { path: /^\/plans(\/|$)/, perms: ["Referrals & Plans", "Subscription Plans"] },
  { path: /^\/delivery\/orders\/[^/]+\/(generate|validate)-otp$/, perms: ["Orders"] },
  { method: "POST", path: /^\/products$/, perms: ["Products"] },
  { path: /^\/admin\/reports(\/|$)/, perms: ["Dashboard", "Advanced Analytics"] },
  { path: /^\/admin\/analytics(\/|$)/, perms: ["Advanced Analytics", "Dashboard"] },

  // ---- Customers ----
  { method: "GET", path: /^\/admin\/users\/[^/]+\/referral-tree$/, perms: ["Customers", "Referrals & Plans"] },
  { method: "GET", path: /^\/admin\/users(\/[^/]+)?$/, perms: ["Customers", "Marketing Tools", "Referrals & Plans"] },

  // ---- Sellers ----
  { method: "GET", path: /^\/admin\/sellers$/, perms: ["Sellers", "Marketing Tools"] },
  { path: /^\/admin\/sellers(\/|$)/, perms: ["Sellers"] },
  { method: "GET", path: /^\/store-promotions\/admin\/purchases$/, perms: ["Sellers", "Marketing Tools"] },

  // ---- Products ----
  { path: /^\/products\/moderation(\/|$)/, perms: ["Products"] },
  { method: "GET", path: /^\/products(\/|$)/, perms: ["Products", "Marketing Tools"] },
  { path: /^\/products\/[^/]+$/, perms: ["Products"] },
  { path: /^\/reviews\/admin(\/|$)/, perms: ["Products"] },

  // ---- Categories ----
  { path: /^\/admin\/categories(\/|$)/, perms: ["Categories"] },

  // ---- Orders / returns / photo orders ----
  { path: /^\/orders(\/|$)/, perms: ["Orders"] },
  { path: /^\/admin\/photo-orders(\/|$)/, perms: ["Orders"] },

  // ---- Customer support ----
  { path: /^\/tickets(\/|$)/, perms: ["Customer Support"] },

  // ---- Delivery drivers ----
  { path: /^\/admin\/delivery-partners(\/|$)/, perms: ["Delivery Drivers"] },
  { path: /^\/admin\/active-fleet(\/|$)/, perms: ["Delivery Drivers"] },
  { path: /^\/admin\/delivery-transactions(\/|$)/, perms: ["Delivery Drivers"] },
  { path: /^\/admin\/transactions(\/|$)/, perms: ["Delivery Drivers"] },

  // ---- Money ----
  { path: /^\/admin\/finance(\/|$)/, perms: ["Wallet"] },
  { path: /^\/admin\/wallet-data(\/|$)/, perms: ["Wallet"] },
  { path: /^\/admin\/(seller-withdrawals|delivery-withdrawals|withdrawals)(\/|$)/, perms: ["Money Requests"] },
  { path: /^\/admin\/seller-transactions(\/|$)/, perms: ["Seller Payments"] },
  { path: /^\/admin\/(delivery-cash|rider-cash-details|settle-cash|cash-history)(\/|$)/, perms: ["Collect Cash"] },
  { path: /^\/admin\/rider-payouts(\/|$)/, perms: ["Rider Payouts"] },

  // ---- Marketing ----
  { path: /^\/notifications\/broadcast(\/|$)/, perms: ["Marketing Tools"] },
  { path: /^\/admin\/whatsapp(\/|$)/, perms: ["Marketing Tools"] },
  { path: /^\/admin\/experience(\/|$)/, perms: ["Marketing Tools"] },
  { path: /^\/admin-offers(\/|$)/, perms: ["Marketing Tools"] },
  { path: /^\/admin-offer-sections(\/|$)/, perms: ["Marketing Tools"] },
  { path: /^\/admin\/coupons(\/|$)/, perms: ["Marketing Tools"] },
  { path: /^\/store-promotions\/admin(\/|$)/, perms: ["Marketing Tools"] },

  // ---- Other sections ----
  { path: /^\/admin\/professionals(\/|$)/, perms: ["Professional Directory"] },
  { path: /^\/admin\/referral-rewards(\/|$)/, perms: ["Referrals & Plans"] },
  { path: /^\/admin\/chatbot(\/|$)/, perms: ["Chatbot Analytics"] },
  { path: /^\/admin\/faqs(\/|$)/, perms: ["FAQs"] },
  { path: /^\/admin\/zones(\/|$)/, perms: ["Zones"] },
  { path: /^\/admin\/settings(\/|$)/, perms: ["Fees & Charges"] },
  { path: /^\/settings(\/|$)/, perms: ["Settings", "Legal Documents"] },
  { path: /^\/admin\/auth-activity(\/|$)/, perms: ["Login Activity"] },
  { path: /^\/admin\/seller-plans(\/|$)/, perms: ["Subscription Plans"] },
];

const PERMS_TTL_MS = 60 * 1000;
const permsCache = new Map(); // subadminId -> { entry: { perms:Set, zones:string[] } | null, at }

export function clearSubadminPermissionCache(subadminId) {
  if (subadminId) permsCache.delete(String(subadminId));
  else permsCache.clear();
}

async function loadPermissions(subadminId) {
  const key = String(subadminId);
  const cached = permsCache.get(key);
  if (cached && Date.now() - cached.at < PERMS_TTL_MS) return cached.entry;
  const admin = await Admin.findById(subadminId).select("role allowedPermissions assignedZones").lean();
  const entry =
    admin && admin.role === "sub-admin"
      ? {
          perms: new Set(Array.isArray(admin.allowedPermissions) ? admin.allowedPermissions : []),
          zones: (Array.isArray(admin.assignedZones) ? admin.assignedZones : []).map(String),
        }
      : null; // deleted / no longer a sub-admin
  permsCache.set(key, { entry, at: Date.now() });
  return entry;
}

/* ---------- Zone checks for actions on ONE record ----------
   A sub-admin may only act on sellers / riders / orders / customers that
   belong to one of their assigned zones. Each resolver returns the zone ids
   the target belongs to (empty = not in any zone → denied). */
const isOid = (v) => mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === String(v);

const zoneOfSeller = async (id) => {
  if (!isOid(id)) return [];
  const s = await Seller.findById(id).select("zoneId").lean();
  return s?.zoneId ? [String(s.zoneId)] : [];
};
const zoneOfDelivery = async (id) => {
  if (!isOid(id)) return [];
  const d = await Delivery.findById(id).select("zoneId").lean();
  return d?.zoneId ? [String(d.zoneId)] : [];
};
const zoneOfOrder = async (id) => {
  const o = await Order.findOne(isOid(id) ? { $or: [{ _id: id }, { orderId: id }] } : { orderId: id })
    .select("zoneId")
    .lean();
  return o?.zoneId ? [String(o.zoneId)] : [];
};
const zonesOfCustomer = async (id) => {
  if (!isOid(id)) return [];
  const zones = await Order.distinct("zoneId", { customer: new mongoose.Types.ObjectId(id) });
  return zones.filter(Boolean).map(String);
};

// [path regex with the id as group 1, resolver]
const ZONE_TARGETS = [
  [/^\/admin\/sellers\/(?:approve\/|reject\/)?([0-9a-fA-F]{24})(?:\/(?:certificate|kyc-document))?$/, zoneOfSeller],
  [/^\/admin\/delivery-partners\/(?:approve\/|reject\/)?([0-9a-fA-F]{24})$/, zoneOfDelivery],
  [/^\/admin\/rider-cash-details\/([0-9a-fA-F]{24})$/, zoneOfDelivery],
  [/^\/orders\/(?:details|status)\/([^/]+)$/, zoneOfOrder],
  [/^\/orders\/returns\/([^/]+)\/(?:approve|reject|assign-delivery|qc)$/, zoneOfOrder],
  [/^\/admin\/users\/([0-9a-fA-F]{24})(?:\/referral-tree)?$/, zonesOfCustomer],
];

async function checkZoneTarget(path, zones) {
  for (const [re, resolve] of ZONE_TARGETS) {
    const m = path.match(re);
    if (!m) continue;
    const targetZones = await resolve(m[1]);
    if (targetZones.length === 0) return false;
    return targetZones.some((z) => zones.includes(z));
  }
  return true; // not a single-record route
}

/** Zone ids (ObjectIds) a sub-admin is limited to, or null when not zone-limited. */
export function subadminZoneIds(req) {
  if (req.user?.role !== "sub-admin") return null;
  return (req.assignedZones || []).map((z) => new mongoose.Types.ObjectId(String(z)));
}

function apiPath(req) {
  const full = String(req.originalUrl || req.url || "").split("?")[0];
  return full.replace(/^\/api(?=\/)/, "");
}

function findRule(method, path) {
  return RULES.find((rule) => (!rule.method || rule.method === method) && rule.path.test(path));
}

/**
 * Returns { allowed, reason } for a sub-admin request.
 */
export async function checkSubadminAccess(req) {
  const path = apiPath(req);
  const rule = findRule(req.method, path);
  if (!rule) {
    return { allowed: false, reason: "Access denied: this section is not available to sub-admins" };
  }
  if (rule.perms === ADMIN_ONLY) {
    return { allowed: false, reason: "Access denied: only the main admin can do this" };
  }
  const entry = await loadPermissions(req.user.id);
  if (!entry) {
    return { allowed: false, reason: "Access denied: sub-admin account not found" };
  }
  // Expose zones to controllers (same field the older zone middleware used).
  req.assignedZones = entry.zones
    .filter((z) => mongoose.Types.ObjectId.isValid(z))
    .map((z) => new mongoose.Types.ObjectId(z));

  if (rule.perms !== ANY && !rule.perms.some((p) => entry.perms.has(p))) {
    return {
      allowed: false,
      reason: `Access denied: you need the "${rule.perms[0]}" permission for this`,
    };
  }
  if (!(await checkZoneTarget(path, entry.zones))) {
    return { allowed: false, reason: "Access denied: this record is outside your assigned zones" };
  }
  return { allowed: true };
}
