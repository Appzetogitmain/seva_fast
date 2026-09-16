import ChatSession from "../../models/chatbot/chatSession.js";
import ChatMessage, { isRawMessageRetentionEnabled } from "../../models/chatbot/chatMessage.js";
import ChatbotModeration from "../../models/chatbot/chatbotModeration.js";
import ChatbotInterest from "../../models/chatbot/chatbotInterest.js";
import Customer from "../../models/customer.js";
import Seller from "../../models/seller.js";
import Delivery from "../../models/delivery.js";
import Admin from "../../models/admin.js";

const ROLE_MODEL = {
  user: Customer,
  seller: Seller,
  delivery: Delivery,
  admin: Admin,
  "sub-admin": Admin,
};

async function resolveIdentityName(role, userRef) {
  if (!userRef) return null;
  const Model = ROLE_MODEL[role];
  if (!Model) return null;
  const doc = await Model.findById(userRef).select("name shopName email phone").lean();
  if (!doc) return null;
  return doc.shopName || doc.name || doc.email || doc.phone || null;
}

export async function getChatbotOverview({ from, to } = {}) {
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);
  const match = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  const [totalConversations, byRole, byInterest, byRisk, topCategories, topProducts, flaggedOpenCount] =
    await Promise.all([
      ChatSession.countDocuments(match),
      ChatSession.aggregate([{ $match: match }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
      ChatSession.aggregate([
        { $match: match },
        { $group: { _id: "$interest.level", count: { $sum: 1 } } },
      ]),
      ChatSession.aggregate([
        { $match: match },
        { $group: { _id: "$moderation.riskLevel", count: { $sum: 1 } } },
      ]),
      ChatbotInterest.aggregate([
        { $match: { ...match, category: { $nin: [null, ""] } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      ChatbotInterest.aggregate([
        { $match: { ...match, product: { $nin: [null, ""] } } },
        { $group: { _id: "$product", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      ChatbotModeration.countDocuments({ reviewStatus: "open" }),
    ]);

  const toCountMap = (rows) =>
    rows.reduce((acc, r) => {
      acc[r._id || "UNKNOWN"] = r.count;
      return acc;
    }, {});

  return {
    totalConversations,
    byRole: toCountMap(byRole),
    interestBreakdown: toCountMap(byInterest),
    riskBreakdown: toCountMap(byRisk),
    topCategories: topCategories.map((c) => ({ category: c._id, count: c.count })),
    topProducts: topProducts.map((p) => ({ product: p._id, count: p.count })),
    flaggedOpenCount,
  };
}

export async function getChatbotSessions({ role, riskLevel, interestLevel, from, to, search, page = 1, limit = 25 }) {
  const filter = {};
  if (role) filter.role = role;
  if (riskLevel) filter["moderation.riskLevel"] = riskLevel;
  if (interestLevel) filter["interest.level"] = interestLevel;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (search) {
    filter.$or = [
      { summary: { $regex: search, $options: "i" } },
      { intent: { $regex: search, $options: "i" } },
      { "interest.product": { $regex: search, $options: "i" } },
      { "interest.category": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    ChatSession.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    ChatSession.countDocuments(filter),
  ]);

  const withNames = await Promise.all(
    items.map(async (s) => ({
      ...s,
      identityName: await resolveIdentityName(s.role, s.userRef),
    })),
  );

  return { items: withNames, total, page: Number(page), limit: Number(limit) };
}

export async function getChatbotSessionDetail(sessionId) {
  const session = await ChatSession.findOne({ sessionId }).lean();
  if (!session) return null;

  const [identityName, moderationEvents, rawMessages] = await Promise.all([
    resolveIdentityName(session.role, session.userRef),
    ChatbotModeration.find({ sessionId }).sort({ createdAt: -1 }).lean(),
    isRawMessageRetentionEnabled()
      ? ChatMessage.find({ sessionId }).sort({ createdAt: 1 }).lean()
      : Promise.resolve([]),
  ]);

  return { ...session, identityName, moderationEvents, rawMessages };
}

export async function getFlaggedQueue({ riskLevel, reviewStatus = "open", role, page = 1, limit = 25 }) {
  const filter = {};
  if (riskLevel) filter.riskLevel = riskLevel;
  if (reviewStatus) filter.reviewStatus = reviewStatus;
  if (role) filter.role = role;

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    ChatbotModeration.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    ChatbotModeration.countDocuments(filter),
  ]);

  const withNames = await Promise.all(
    items.map(async (m) => ({ ...m, identityName: await resolveIdentityName(m.role, m.userRef) })),
  );

  return { items: withNames, total, page: Number(page), limit: Number(limit) };
}

export async function reviewModerationEvent(id, { reviewStatus, reviewNote, adminId }) {
  const updated = await ChatbotModeration.findByIdAndUpdate(
    id,
    {
      $set: {
        reviewStatus,
        reviewNote: reviewNote || "",
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    },
    { new: true },
  ).lean();
  return updated;
}
