import AuthActivityLog from "../models/authActivityLog.js";

const ROLE_LABELS = {
  customer: "Customer",
  seller: "Seller",
  admin: "Admin",
  "sub-admin": "Sub-Admin",
  delivery: "Delivery Partner",
};

export function normalizeAuthRole(role = "") {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "subadmin" || normalized === "sub_admin") return "sub-admin";
  return normalized;
}

export function getRequestMeta(req = {}) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return {
    ipAddress: forwarded || String(req.ip || "").trim(),
    userAgent: String(req.headers?.["user-agent"] || "").trim().slice(0, 500),
  };
}

export function buildUserSnapshot(user = {}, role = "") {
  const normalizedRole = normalizeAuthRole(role || user?.role);
  const name =
    String(user?.name || user?.shopName || user?.fullName || "").trim() ||
    "Unknown User";
  const email = String(user?.email || "").trim().toLowerCase();
  const phone = String(user?.phone || "").trim();

  return {
    role: normalizedRole,
    userName: name,
    userEmail: email,
    userPhone: phone,
  };
}

export async function recordAuthActivity({
  role,
  action,
  userId,
  user = {},
  req = null,
}) {
  if (!userId || !action) return null;

  const snapshot = buildUserSnapshot(user, role);
  const requestMeta = req ? getRequestMeta(req) : { ipAddress: "", userAgent: "" };

  try {
    return await AuthActivityLog.create({
      role: snapshot.role || normalizeAuthRole(role),
      action,
      userId,
      userName: snapshot.userName,
      userEmail: snapshot.userEmail,
      userPhone: snapshot.userPhone,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  } catch (error) {
    console.error("[AuthActivity] Failed to record activity:", error?.message || error);
    return null;
  }
}

export async function listAuthActivityLogs({
  page = 1,
  limit = 25,
  role = "",
  action = "",
  search = "",
  from = null,
  to = null,
}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const query = {};

  if (role && role !== "all") {
    query.role = normalizeAuthRole(role);
  }

  if (action && action !== "all") {
    query.action = String(action).trim().toLowerCase();
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const trimmedSearch = String(search || "").trim();
  if (trimmedSearch) {
    const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [
      { userName: regex },
      { userEmail: regex },
      { userPhone: regex },
      { ipAddress: regex },
    ];
  }

  const [items, total] = await Promise.all([
    AuthActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    AuthActivityLog.countDocuments(query),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      id: String(item._id),
      roleLabel: ROLE_LABELS[item.role] || item.role,
    })),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(Math.ceil(total / safeLimit), 1),
  };
}
