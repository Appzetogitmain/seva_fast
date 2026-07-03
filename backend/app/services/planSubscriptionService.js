import Plan from "../models/plan.js";
import Transaction from "../models/transaction.js";
import Customer from "../models/customer.js";

function normalizePlanRef(planRef) {
  if (!planRef) return "";
  if (typeof planRef === "object") {
    return String(planRef._id || planRef.id || "").trim();
  }
  return String(planRef).trim();
}

export function buildPlanExpiryDate(startDate, validityDays = 365) {
  const expiresAt = new Date(startDate);
  expiresAt.setDate(expiresAt.getDate() + (Number(validityDays) || 365));
  return expiresAt;
}

export function upsertPlanSubscription(
  subscriptions = [],
  { planId, validityDays = 365, paymentReference = "" } = {},
) {
  const now = new Date();
  const list = Array.isArray(subscriptions)
    ? subscriptions.map((entry) => ({
        plan: entry.plan,
        purchasedAt: entry.purchasedAt,
        expiresAt: entry.expiresAt,
        paymentReference: entry.paymentReference,
      }))
    : [];

  const normalizedPlanId = normalizePlanRef(planId);
  const index = list.findIndex(
    (entry) => normalizePlanRef(entry.plan) === normalizedPlanId,
  );

  const existingExpiry =
    index >= 0 && list[index].expiresAt
      ? new Date(list[index].expiresAt)
      : null;
  const renewalBase =
    existingExpiry && existingExpiry.getTime() > now.getTime()
      ? existingExpiry
      : now;

  const entry = {
    plan: planId,
    purchasedAt: now,
    expiresAt: buildPlanExpiryDate(renewalBase, validityDays),
    paymentReference: String(paymentReference || "").trim(),
  };

  if (index >= 0) {
    list[index] = entry;
  } else {
    list.push(entry);
  }

  return list;
}

export function getActivePlanIds(subscriptions = [], referenceDate = new Date()) {
  const now = referenceDate.getTime();
  return new Set(
    (subscriptions || [])
      .filter((entry) => {
        const expiresAt = entry?.expiresAt ? new Date(entry.expiresAt).getTime() : 0;
        return expiresAt > now;
      })
      .map((entry) => normalizePlanRef(entry.plan))
      .filter(Boolean),
  );
}

async function inferPlanSubscriptionsFromCommissions(userId) {
  const commissions = await Transaction.find({
    type: "Commission",
    "meta.referredUser": userId,
    "meta.planId": { $exists: true },
  })
    .select("meta createdAt")
    .lean();

  if (!commissions.length) {
    return [];
  }

  const purchasesByPlan = new Map();
  for (const tx of commissions) {
    const planId = normalizePlanRef(tx.meta?.planId);
    if (!planId) continue;

    const purchasedAt = new Date(tx.createdAt);
    const existing = purchasesByPlan.get(planId);
    if (!existing || purchasedAt > existing.purchasedAt) {
      purchasesByPlan.set(planId, { planId, purchasedAt });
    }
  }

  const planIds = [...purchasesByPlan.keys()];
  const plans = await Plan.find({ _id: { $in: planIds } })
    .select("validityDays")
    .lean();
  const validityByPlan = new Map(
    plans.map((plan) => [String(plan._id), plan.validityDays || 365]),
  );

  return planIds.map((planId) => {
    const { purchasedAt } = purchasesByPlan.get(planId);
    return {
      plan: planId,
      purchasedAt,
      expiresAt: buildPlanExpiryDate(
        purchasedAt,
        validityByPlan.get(planId) || 365,
      ),
      paymentReference: "",
    };
  });
}

export async function ensurePlanSubscriptionsSynced(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer) return null;

  let subscriptions = Array.isArray(customer.planSubscriptions)
    ? customer.planSubscriptions.map((entry) => ({
        plan: entry.plan,
        purchasedAt: entry.purchasedAt,
        expiresAt: entry.expiresAt,
        paymentReference: entry.paymentReference,
      }))
    : [];

  const knownPlanIds = new Set(
    subscriptions.map((entry) => normalizePlanRef(entry.plan)).filter(Boolean),
  );

  const inferred = await inferPlanSubscriptionsFromCommissions(customer._id);
  for (const entry of inferred) {
    const planId = normalizePlanRef(entry.plan);
    if (!planId || knownPlanIds.has(planId)) continue;
    subscriptions.push(entry);
    knownPlanIds.add(planId);
  }

  const currentPlanId = normalizePlanRef(customer.currentPlan);
  if (
    currentPlanId &&
    !knownPlanIds.has(currentPlanId) &&
    customer.planExpiry
  ) {
    subscriptions.push({
      plan: customer.currentPlan,
      purchasedAt: customer.updatedAt || new Date(),
      expiresAt: customer.planExpiry,
      paymentReference: "",
    });
    knownPlanIds.add(currentPlanId);
  }

  const changed =
    subscriptions.length !== (customer.planSubscriptions?.length || 0) ||
    subscriptions.some((entry, index) => {
      const current = customer.planSubscriptions?.[index];
      return (
        normalizePlanRef(current?.plan) !== normalizePlanRef(entry.plan) ||
        new Date(current?.expiresAt || 0).getTime() !==
          new Date(entry.expiresAt || 0).getTime()
      );
    });

  if (changed) {
    customer.planSubscriptions = subscriptions;
    await customer.save();
  }

  return Customer.findById(customerId).populate("planSubscriptions.plan");
}
