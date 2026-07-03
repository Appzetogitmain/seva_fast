import { jest } from "@jest/globals";

const { upsertPlanSubscription, getActivePlanIds } = await import(
  "../app/services/planSubscriptionService.js"
);

describe("planSubscriptionService", () => {
  it("keeps multiple purchased plans active", () => {
    const bornzId = "bornz-plan";
    const silverId = "silver-plan";

    let subscriptions = upsertPlanSubscription([], {
      planId: bornzId,
      validityDays: 365,
      paymentReference: "pay_1",
    });

    subscriptions = upsertPlanSubscription(subscriptions, {
      planId: silverId,
      validityDays: 365,
      paymentReference: "pay_2",
    });

    const activeIds = getActivePlanIds(subscriptions);
    expect(activeIds.has(bornzId)).toBe(true);
    expect(activeIds.has(silverId)).toBe(true);
    expect(activeIds.size).toBe(2);
  });
});
