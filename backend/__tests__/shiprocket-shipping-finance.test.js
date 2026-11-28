/**
 * Shiprocket shipping / COD / RTO / return finance — scenario tests.
 *
 * Runs the REAL shippingChargeService + orderFinanceService against an
 * in-memory fake of the Order model, wallets, ledger and audit log. The fake
 * honours transactions (abort replays an undo journal) and the wallet schema's
 * "balance can't go below 0" rule, so money-conservation and idempotency
 * are checked end-to-end rather than via call counts.
 */
import { jest } from "@jest/globals";

// ---------------------------------------------------------------- fake DB
const db = { orders: new Map(), wallets: new Map(), ledger: [], audit: [], payouts: [] };
let failNextLedgerWrite = false;

const clone = (v) => JSON.parse(JSON.stringify(v));
const idOf = (v) => String(v && typeof v === "object" && "value" in v ? v.value : v);

// Each session keeps an undo journal; abort replays it in reverse. Works
// correctly even when concurrent sessions interleave.
function makeSession() {
  const undo = [];
  let active = false;
  return {
    undo,
    startTransaction() { active = true; },
    inTransaction: () => active,
    async commitTransaction() { active = false; undo.length = 0; },
    async abortTransaction() {
      while (undo.length) undo.pop()();
      active = false;
    },
    endSession() {},
  };
}
function journal(session, fn) {
  if (session?.undo) session.undo.push(fn);
}

function hydrate(raw) {
  if (!raw) return null;
  const doc = clone(raw);
  Object.defineProperty(doc, "save", {
    value: async ({ session } = {}) => {
      const key = idOf(doc._id);
      const prev = db.orders.get(key);
      journal(session, () => db.orders.set(key, prev));
      db.orders.set(key, clone(doc));
    },
  });
  Object.defineProperty(doc, "markModified", { value: () => {} });
  return doc;
}

function matchOrder(q) {
  if (q._id != null) return db.orders.get(idOf(q._id)) || null;
  if (q.orderId != null) return [...db.orders.values()].find((o) => o.orderId === q.orderId) || null;
  return null;
}

const OrderMock = {
  findOne(q) {
    const raw = matchOrder(q);
    const p = Promise.resolve(hydrate(raw));
    p.lean = () => Promise.resolve(raw ? clone(raw) : null);
    return p;
  },
  async updateOne(filter, update, { session } = {}) {
    const raw = matchOrder(filter);
    if (!raw) return { modifiedCount: 0 };
    const neKey = filter["paymentBreakdown.shippingChargeKeys"]?.$ne;
    raw.paymentBreakdown = raw.paymentBreakdown || {};
    const keys = raw.paymentBreakdown.shippingChargeKeys || [];
    if (neKey && keys.includes(neKey)) return { modifiedCount: 0 };
    const add = update.$addToSet?.["paymentBreakdown.shippingChargeKeys"];
    if (add) {
      raw.paymentBreakdown.shippingChargeKeys = [...keys, add];
      journal(session, () => {
        const cur = db.orders.get(idOf(raw._id));
        if (cur) cur.paymentBreakdown.shippingChargeKeys = cur.paymentBreakdown.shippingChargeKeys.filter((k) => k !== add);
      });
    }
    return { modifiedCount: 1 };
  },
  find(q) {
    const rows = [...db.orders.values()].filter(
      (o) =>
        String(o.seller) === String(q.seller) &&
        Number(o.paymentBreakdown?.sellerShippingDueOutstanding || 0) > 0,
    );
    return { sort: async () => rows.sort((a, b) => a.createdAt - b.createdAt).map(hydrate) };
  },
};

// ---------------------------------------------------------------- mocks
class MockObjectId {
  constructor(v) { this.value = v; }
  toString() { return String(this.value); }
}
MockObjectId.isValid = (v) => typeof idOf(v) === "string" && idOf(v).startsWith("oid-");

jest.unstable_mockModule("mongoose", () => ({
  default: { startSession: async () => makeSession(), Types: { ObjectId: MockObjectId } },
}));
jest.unstable_mockModule("../app/models/order.js", () => ({ default: OrderMock }));
jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: { findOneAndUpdate: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
}));

const walletKey = (t, id) => `${t}:${id ?? "null"}`;
function wallet(t, id) {
  const k = walletKey(t, id);
  if (!db.wallets.has(k)) {
    db.wallets.set(k, { _id: `w-${k}`, ownerType: t, ownerId: id, availableBalance: 0, pendingBalance: 0, totalCredited: 0, totalDebited: 0 });
  }
  return db.wallets.get(k);
}
const r2 = (v) => Math.round(Number(v) * 100) / 100;

jest.unstable_mockModule("../app/services/finance/walletService.js", () => ({
  getOrCreateWallet: async (t, id) => wallet(t, id),
  creditWallet: async ({ ownerType, ownerId, amount, bucket = "available", session }) => {
    if (!(amount > 0)) throw new Error("Amount must be greater than 0");
    const w = wallet(ownerType, ownerId);
    const before = w[`${bucket}Balance`];
    const prevW = clone(w);
    journal(session, () => Object.assign(w, prevW));
    w[`${bucket}Balance`] = r2(before + amount);
    w.totalCredited = r2(w.totalCredited + amount);
    return { wallet: w, amount, before, after: w[`${bucket}Balance`] };
  },
  debitWallet: async ({ ownerType, ownerId, amount, bucket = "available", session }) => {
    if (!(amount > 0)) throw new Error("Amount must be greater than 0");
    const w = wallet(ownerType, ownerId);
    const before = w[`${bucket}Balance`];
    if (before < amount) throw new Error(`Insufficient ${bucket} balance`);
    const prevW = clone(w);
    journal(session, () => Object.assign(w, prevW));
    w[`${bucket}Balance`] = r2(before - amount);
    w.totalDebited = r2(w.totalDebited + amount);
    return { wallet: w, amount, before, after: w[`${bucket}Balance`] };
  },
  updateCashInHand: jest.fn(),
}));
jest.unstable_mockModule("../app/services/finance/ledgerService.js", () => ({
  createLedgerEntry: async (entry, { session } = {}) => {
    if (failNextLedgerWrite) { failNextLedgerWrite = false; throw new Error("ledger write failed"); }
    if (entry.amount < 0) throw new Error("Ledger amount cannot be negative");
    const e = clone(entry);
    db.ledger.push(e);
    journal(session, () => db.ledger.splice(db.ledger.indexOf(e), 1));
  },
}));
jest.unstable_mockModule("../app/services/finance/auditLogService.js", () => ({
  createFinanceAuditLog: async (entry, { session } = {}) => {
    const e = clone(entry);
    db.audit.push(e);
    journal(session, () => db.audit.splice(db.audit.indexOf(e), 1));
  },
}));
jest.unstable_mockModule("../app/services/finance/payoutService.js", () => ({
  createPendingPayoutForOrder: async ({ order, beneficiaryId, amount }) => {
    const p = { orderId: order.orderId, beneficiaryId: String(beneficiaryId), amount };
    db.payouts.push(p);
    const w = wallet("SELLER", String(beneficiaryId));
    w.pendingBalance = r2(w.pendingBalance + amount);
    return p;
  },
  autoProcessSellerPayoutForOrder: jest.fn(),
}));
jest.unstable_mockModule("../app/services/finance/pricingService.js", () => ({
  resolveSellerOrderEarning: (o) => Number(o?.paymentBreakdown?.sellerPayoutTotal || 0),
}));
jest.unstable_mockModule("../app/modules/notifications/notification.emitter.js", () => ({ emitNotificationEvent: jest.fn() }));
jest.unstable_mockModule("../app/modules/notifications/notification.constants.js", () => ({ NOTIFICATION_EVENTS: {} }));
jest.unstable_mockModule("../app/services/paymentService.js", () => ({ issueRazorpayRefund: jest.fn() }));

const ship = await import("../app/services/finance/shippingChargeService.js");
const fin = await import("../app/services/finance/orderFinanceService.js");
const { SHIPPING_CHARGE_KIND: K, SHIPPING_BEARER: B } = ship;

// ---------------------------------------------------------------- helpers
let seq = 0;
/**
 * Pan-India order: products 1000, commission 100, delivery fee 140,
 * handling 10 → customer pays 1150, seller payout 1040 before Shiprocket.
 */
function seedOrder(overrides = {}) {
  seq += 1;
  const id = `oid-${seq}`;
  const order = {
    _id: id,
    orderId: `ORD${1000 + seq}`,
    seller: "seller-1",
    customer: "cust-1",
    deliveryType: "scheduled",
    paymentMode: "ONLINE",
    payment: { method: "online" },
    status: "confirmed",
    orderStatus: "confirmed",
    createdAt: seq,
    items: [],
    pricing: { walletAmount: 0, total: 1150 },
    paymentBreakdown: {
      productSubtotal: 1000,
      adminProductCommissionTotal: 100,
      deliveryFeeCharged: 140,
      deliveryFeeBase: 140,
      sellerDeliveryFeeShare: 140,
      handlingFeeCharged: 10,
      grandTotal: 1150,
      sellerPayoutTotal: 1040,
      platformTotalEarning: 110,
      totalCostPrice: 600,
      shippingCharges: [],
      shippingChargeKeys: [],
      sellerShippingDueOutstanding: 0,
      snapshots: { deliverySettings: {} },
    },
    financeFlags: { slabCommissionsDistributed: true },
    settlementStatus: { sellerPayout: "PENDING" },
    ...overrides,
  };
  db.orders.set(id, clone(order));
  return id;
}
const get = (id) => db.orders.get(id);
const pb = (id) => get(id).paymentBreakdown;
const sellerWallet = (id = "seller-1") => wallet("SELLER", id);
const ledgerFor = (id, type = "SHIPROCKET_SHIPPING_CHARGE") =>
  db.ledger.filter((e) => idOf(e.orderId) === id && e.type === type);

beforeEach(() => {
  db.orders.clear();
  db.wallets.clear();
  db.ledger.length = 0;
  db.audit.length = 0;
  db.payouts.length = 0;
  failNextLedgerWrite = false;
  delete process.env.SHIPROCKET_COD_HOLD_UNTIL_REMITTED;
});

// ================================================================ FORWARD
describe("forward shipping charge", () => {
  test("is netted from the seller payout exactly once, with ledger + audit", async () => {
    const id = seedOrder();
    const r1 = await fin.applyShiprocketShippingCharge(id, { charge: 95, courierName: "Delhivery Surface" });
    const r2 = await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    expect(r1.applied).toBe(true);
    expect(r2.duplicate).toBe(true);
    expect(pb(id).sellerPayoutTotal).toBe(945);
    expect(pb(id).shiprocketShippingCharge).toBe(95);
    expect(pb(id).sellerNetProfit).toBe(345);
    expect(ledgerFor(id)).toHaveLength(1);
    expect(ledgerFor(id)[0]).toMatchObject({ direction: "DEBIT", amount: 95, actorType: "SELLER" });
    expect(db.audit.filter((a) => a.action === "SHIPROCKET_SHIPPING_CHARGE_APPLIED")).toHaveLength(1);
  });

  test("10 concurrent duplicate calls (webhook storm) deduct only once", async () => {
    const id = seedOrder();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => fin.applyShiprocketShippingCharge(id, { charge: 95 })),
    );
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(pb(id).sellerPayoutTotal).toBe(945);
    expect(ledgerFor(id)).toHaveLength(1);
  });

  test("ignores zero / negative / NaN charges and unknown kinds", async () => {
    const id = seedOrder();
    expect(await fin.applyShiprocketShippingCharge(id, { charge: 0 })).toBeNull();
    expect(await fin.applyShiprocketShippingCharge(id, { charge: -5 })).toBeNull();
    expect(await fin.applyShiprocketShippingCharge(id, { charge: "abc" })).toBeNull();
    await expect(ship.applyShippingCharge(id, { kind: "BOGUS", amount: 5, key: "x" })).rejects.toThrow(/Unknown/);
    await expect(ship.applyShippingCharge(id, { kind: K.FORWARD, amount: 5 })).rejects.toThrow(/idempotency key/);
    expect(pb(id).sellerPayoutTotal).toBe(1040);
  });

  test("a failure mid-way rolls back fully and the key stays usable for a retry", async () => {
    const id = seedOrder();
    failNextLedgerWrite = true;
    await expect(fin.applyShiprocketShippingCharge(id, { charge: 95 })).rejects.toThrow(/ledger/);
    expect(pb(id).sellerPayoutTotal).toBe(1040);
    expect(pb(id).shippingChargeKeys).toEqual([]);
    const retry = await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    expect(retry.applied).toBe(true);
    expect(pb(id).sellerPayoutTotal).toBe(945);
  });

  test("charge learned after payout was queued is recovered from the wallet", async () => {
    const id = seedOrder({ financeFlags: { sellerPayoutQueued: true } });
    sellerWallet().availableBalance = 500;
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    expect(pb(id).sellerPayoutTotal).toBe(1040); // payout already gone
    expect(sellerWallet().availableBalance).toBe(405);
    expect(pb(id).sellerShippingRecoveredFromWallet).toBe(95);
    expect(pb(id).sellerShippingDueOutstanding).toBe(0);
  });
});

// ================================================================ FINAL BILL
describe("final Shiprocket billing reconciliation", () => {
  test("weight dispute raises the charge; re-uploading the same bill is a no-op", async () => {
    const id = seedOrder();
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    const r = await ship.reconcileFinalShippingCharge(id, { finalAmount: 160, reference: "INV-77", reason: "weight 1.2kg→2kg" });
    expect(r).toMatchObject({ applied: true, delta: 65, alreadyApplied: 95 });
    expect(pb(id).shiprocketShippingCharge).toBe(160);
    expect(pb(id).sellerPayoutTotal).toBe(880);

    const again = await ship.reconcileFinalShippingCharge(id, { finalAmount: 160, reference: "INV-77" });
    expect(again.applied).toBe(false);
    const sameRefDifferentAmount = await ship.reconcileFinalShippingCharge(id, { finalAmount: 170, reference: "INV-77" });
    expect(sameRefDifferentAmount.duplicate).toBe(true);
    expect(pb(id).sellerPayoutTotal).toBe(880);
  });

  test("cheaper final bill refunds the seller (into payout, then wallet after payout)", async () => {
    const id = seedOrder();
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    await ship.reconcileFinalShippingCharge(id, { finalAmount: 80, reference: "INV-1" });
    expect(pb(id).sellerPayoutTotal).toBe(960);
    expect(ledgerFor(id).at(-1)).toMatchObject({ direction: "CREDIT", amount: 15 });

    const id2 = seedOrder({ financeFlags: { sellerPayoutQueued: true } });
    await fin.applyShiprocketShippingCharge(id2, { charge: 95 }); // wallet 0 → outstanding 95
    expect(pb(id2).sellerShippingDueOutstanding).toBe(95);
    await ship.reconcileFinalShippingCharge(id2, { finalAmount: 60, reference: "INV-2" });
    // 35 refund first clears outstanding — no cash credited
    expect(pb(id2).sellerShippingDueOutstanding).toBe(60);
    expect(sellerWallet().availableBalance).toBe(0);
  });

  test("refund larger than outstanding credits the remainder to the wallet", async () => {
    const id = seedOrder({ financeFlags: { sellerPayoutQueued: true } });
    sellerWallet().availableBalance = 50;
    await fin.applyShiprocketShippingCharge(id, { charge: 95 }); // 50 wallet + 45 outstanding
    expect(pb(id).sellerShippingDueOutstanding).toBe(45);
    await ship.reconcileFinalShippingCharge(id, { finalAmount: 0, reference: "INV-ZERO" });
    expect(pb(id).sellerShippingDueOutstanding).toBe(0);
    expect(sellerWallet().availableBalance).toBe(50);
    expect(pb(id).shiprocketShippingCharge).toBe(0);
  });

  test("final bill with no prior charge posts the base charge (rate lookup had failed)", async () => {
    const id = seedOrder();
    const r = await ship.reconcileFinalShippingCharge(id, { finalAmount: 120, reference: "INV-9" });
    expect(r.applied).toBe(true);
    expect(pb(id).shippingCharges[0].kind).toBe(K.FORWARD);
    expect(pb(id).sellerPayoutTotal).toBe(920);
  });

  test("rejects negative final amounts and adjustment kinds", async () => {
    const id = seedOrder();
    await expect(ship.reconcileFinalShippingCharge(id, { finalAmount: -1 })).rejects.toThrow();
    await expect(ship.reconcileFinalShippingCharge(id, { kind: K.FORWARD_ADJUSTMENT, finalAmount: 5 })).rejects.toThrow();
  });
});

// ================================================================ RTO
describe("RTO", () => {
  test("forward charge is re-homed to wallet and RTO freight charged; duplicates ignored", async () => {
    const id = seedOrder({ paymentMode: "COD" });
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    // Order is cancelled by RTO → payout will never happen
    Object.assign(get(id), { status: "cancelled", orderStatus: "cancelled" });
    sellerWallet().availableBalance = 1000;

    await fin.recoverShippingChargeOnRto(id, { rtoStatus: "RTO INITIATED" });
    await fin.recoverShippingChargeOnRto(id, { rtoStatus: "RTO DELIVERED" });
    await fin.recoverShippingChargeOnRto(id, { rtoStatus: "RTO DELIVERED" });

    expect(sellerWallet().availableBalance).toBe(1000 - 95 - 95);
    expect(pb(id).shiprocketRtoCharge).toBe(95);
    expect(pb(id).sellerShippingChargesTotal).toBe(190);
    expect(pb(id).sellerShippingDueOutstanding).toBe(0);
  });

  test("seller with empty wallet ends with the full amount outstanding (never lost)", async () => {
    const id = seedOrder();
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    Object.assign(get(id), { status: "cancelled", orderStatus: "cancelled" });
    await fin.recoverShippingChargeOnRto(id, { rtoStatus: "RTO INITIATED" });
    expect(sellerWallet().availableBalance).toBe(0);
    expect(pb(id).sellerShippingDueOutstanding).toBe(190);
  });

  test("RTO final bill corrects the estimate", async () => {
    const id = seedOrder();
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    Object.assign(get(id), { status: "cancelled", orderStatus: "cancelled" });
    sellerWallet().availableBalance = 1000;
    await fin.recoverShippingChargeOnRto(id, { rtoStatus: "RTO INITIATED" });
    await ship.reconcileFinalShippingCharge(id, { kind: K.RTO, finalAmount: 70, reference: "RTO-INV" });
    expect(pb(id).shiprocketRtoCharge).toBe(70);
    expect(sellerWallet().availableBalance).toBe(1000 - 95 - 70);
  });

  test("local (instant) orders are never charged", async () => {
    const id = seedOrder({ deliveryType: "instant" });
    await fin.recoverShippingChargeOnRto(id, { rtoStatus: "RTO INITIATED" });
    expect(pb(id).shippingCharges).toHaveLength(0);
  });
});

// ================================================================ RETURN PICKUP
describe("customer return pickup", () => {
  test("policy: seller-fault reasons → seller, preference reasons → platform", () => {
    for (const code of ["ITEM_DAMAGED", "WRONG_ITEM", "MISSING_ITEM", "NOT_AS_DESCRIBED", "QUALITY_NOT_AS_EXPECTED", "PERFORMANCE_NOT_ADEQUATE"]) {
      expect(ship.resolveReturnShippingBearer({ returnReasonCode: code })).toBe(B.SELLER);
    }
    for (const code of ["CHANGED_MY_MIND", "SIZE_NOT_AS_EXPECTED", "DOES_NOT_FIT", "ARRIVED_TOO_LATE", "PARCEL_DAMAGED", "OTHER", "", undefined]) {
      expect(ship.resolveReturnShippingBearer({ returnReasonCode: code })).toBe(B.PLATFORM);
    }
  });

  test("customer-preference return: platform expense, seller untouched", async () => {
    const id = seedOrder({ returnReasonCode: "CHANGED_MY_MIND" });
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    await ship.applyShippingCharge(id, { kind: K.RETURN_PICKUP, amount: 80, key: "RETURN_PICKUP", bearer: ship.resolveReturnShippingBearer(get(id)) });
    expect(pb(id).sellerPayoutTotal).toBe(945);
    expect(pb(id).platformShippingExpenseTotal).toBe(80);
    const adminEntry = ledgerFor(id).find((e) => e.actorType === "ADMIN");
    expect(adminEntry).toMatchObject({ direction: "DEBIT", amount: 80 });
  });

  test("seller-fault return on a held payout: netted, then re-homed when QC cancels the payout", async () => {
    const id = seedOrder({ returnReasonCode: "WRONG_ITEM", status: "delivered", orderStatus: "delivered" });
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    await ship.applyShippingCharge(id, { kind: K.RETURN_PICKUP, amount: 80, key: "RETURN_PICKUP", bearer: B.SELLER });
    expect(pb(id).sellerPayoutTotal).toBe(865);

    sellerWallet().availableBalance = 200;
    const args = { kinds: [K.RETURN_PICKUP, K.RETURN_PICKUP_ADJUSTMENT], key: "RETURN_REHOME_PICKUP", reason: "QC passed" };
    await ship.recoverPayoutNettedCharges(id, args);
    await ship.recoverPayoutNettedCharges(id, args); // duplicate
    expect(sellerWallet().availableBalance).toBe(120);
    expect(pb(id).shippingCharges.find((e) => e.kind === K.RETURN_PICKUP).recoveredVia.payout).toBe(0);
  });

  test("return refund clawback after payout released: wallet then outstanding, idempotent", async () => {
    const id = seedOrder({ financeFlags: { sellerPayoutQueued: true } });
    sellerWallet().availableBalance = 300;
    await ship.recoverSellerDue(id, 500, { key: "RETURN_REFUND_CLAWBACK", reason: "refund" });
    await ship.recoverSellerDue(id, 500, { key: "RETURN_REFUND_CLAWBACK", reason: "refund" });
    expect(sellerWallet().availableBalance).toBe(0);
    expect(pb(id).sellerShippingDueOutstanding).toBe(200);
  });
});

// ================================================================ PAYOUTS & DUES
describe("seller payout, negative balance and outstanding dues", () => {
  const settle = async (id) => {
    const order = await OrderMock.findOne({ _id: id });
    await fin.createPendingSellerPayout(order, {});
    await order.save();
  };

  test("negative payout: no payout created, shortfall recovered, never re-run", async () => {
    // tiny order: payout 40 + delivery share 60, Shiprocket 150 → payout -50
    const id = seedOrder({ status: "delivered", orderStatus: "delivered" });
    Object.assign(pb(id), { productSubtotal: 50, adminProductCommissionTotal: 10, sellerPayoutTotal: 100 });
    await fin.applyShiprocketShippingCharge(id, { charge: 150 });
    expect(pb(id).sellerPayoutTotal).toBe(-50);
    sellerWallet().availableBalance = 20;
    await settle(id);
    await settle(id);
    expect(db.payouts).toHaveLength(0);
    expect(sellerWallet().availableBalance).toBe(0);
    expect(pb(id).sellerShippingDueOutstanding).toBe(30);
    expect(get(id).settlementStatus.sellerPayout).toBe("NOT_APPLICABLE");
  });

  test("outstanding dues are netted from the seller's next payout (oldest first, partial)", async () => {
    const a = seedOrder({ status: "cancelled", orderStatus: "cancelled" });
    pb(a).sellerShippingDueOutstanding = 300;
    const b = seedOrder();
    pb(b).sellerShippingDueOutstanding = 900;
    const c = seedOrder({ status: "delivered", orderStatus: "delivered" }); // payout 1040
    await settle(c);
    // 300 from a, then 740 of b's 900
    expect(pb(a).sellerShippingDueOutstanding).toBe(0);
    expect(pb(b).sellerShippingDueOutstanding).toBe(160);
    expect(pb(c).sellerDuesNettedFromPayout).toBe(1040);
    expect(db.payouts).toHaveLength(0); // whole payout consumed by dues
    expect(get(c).financeFlags.sellerPayoutQueued).toBe(true);
  });

  test("dues smaller than payout: remainder is paid out", async () => {
    const a = seedOrder();
    pb(a).sellerShippingDueOutstanding = 140;
    const c = seedOrder({ status: "delivered", orderStatus: "delivered" });
    await settle(c);
    expect(db.payouts).toHaveLength(1);
    expect(db.payouts[0].amount).toBe(900);
    expect(pb(a).sellerShippingDueOutstanding).toBe(0);
    expect(ledgerFor(a).at(-1)).toMatchObject({ direction: "DEBIT", amount: 140 });
  });

  test("other sellers' dues are never touched", async () => {
    const other = seedOrder({ seller: "seller-2" });
    pb(other).sellerShippingDueOutstanding = 100;
    const c = seedOrder({ status: "delivered", orderStatus: "delivered" });
    await settle(c);
    expect(pb(other).sellerShippingDueOutstanding).toBe(100);
    expect(db.payouts[0].amount).toBe(1040);
  });
});

// ================================================================ COD
describe("Pan-India COD settlement", () => {
  test("courier collection credits admin once with the order value; cash vs wallet recorded", async () => {
    const id = seedOrder({ paymentMode: "COD", payment: { method: "cash" }, status: "delivered", orderStatus: "delivered", deliveredAt: 1, pricing: { walletAmount: 150, total: 1150 } });
    await fin.markCodCollectedByCourier(id);
    await fin.markCodCollectedByCourier(id);
    const admin = wallet("ADMIN", null);
    expect(admin.availableBalance).toBe(1150);
    const entry = db.ledger.filter((e) => e.type === "COD_COLLECTED_BY_COURIER");
    expect(entry).toHaveLength(1);
    expect(entry[0].metadata).toMatchObject({ cashCollectedByCourier: 1000, customerWalletPortion: 150 });
    expect(get(id).financeFlags).toMatchObject({ codCashRemittedToAdmin: true, codMarkedCollected: true });
    expect(pb(id).codPendingAmount).toBe(0);
  });

  test("not delivered → refuses; local COD order → ignored", async () => {
    const id = seedOrder({ paymentMode: "COD", payment: { method: "cash" } });
    await expect(fin.markCodCollectedByCourier(id)).rejects.toThrow(/delivered/);
    const local = seedOrder({ paymentMode: "COD", deliveryType: "instant", status: "delivered", orderStatus: "delivered" });
    expect(await fin.markCodCollectedByCourier(local)).toBeNull();
    expect(wallet("ADMIN", null).availableBalance).toBe(0);
  });

  test("strict mode holds the seller payout until Shiprocket remittance is confirmed", async () => {
    process.env.SHIPROCKET_COD_HOLD_UNTIL_REMITTED = "true";
    const id = seedOrder({ paymentMode: "COD", payment: { method: "cash" }, status: "delivered", orderStatus: "delivered", deliveredAt: 1 });
    await fin.markCodCollectedByCourier(id);
    let order = await OrderMock.findOne({ _id: id });
    await fin.createPendingSellerPayout(order, {});
    await order.save();
    expect(db.payouts).toHaveLength(0);
    expect(get(id).settlementStatus.sellerPayout).toBe("HOLD");

    const res = await ship.markShiprocketCodRemitted([id, id], { utr: "UTR123" });
    expect(res[0].applied).toBe(true);
    expect(res[1].duplicate).toBe(true);
    order = await OrderMock.findOne({ _id: id });
    await fin.createPendingSellerPayout(order, {});
    expect(db.payouts).toHaveLength(1);
    expect(db.payouts[0].amount).toBe(1040);
  });

  test("remittance can't be confirmed before the courier collected the COD", async () => {
    const id = seedOrder({ paymentMode: "COD" });
    const [r] = await ship.markShiprocketCodRemitted([id], { utr: "X" });
    expect(r.applied).toBe(false);
    expect(r.error).toMatch(/not yet collected/);
    expect(pb(id).shippingChargeKeys).toEqual([]); // key not burned
  });
});

// ================================================================ CONSERVATION
describe("money conservation (customer paid = seller + platform + Shiprocket − discount)", () => {
  test("delivered order with forward + weight-dispute adjustment", async () => {
    const id = seedOrder();
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    await ship.reconcileFinalShippingCharge(id, { finalAmount: 130, reference: "INV" });
    const p = pb(id);
    const shiprocket = p.shiprocketShippingCharge + p.platformShippingExpenseTotal;
    expect(r2(p.sellerPayoutTotal + p.platformTotalEarning + shiprocket)).toBe(p.grandTotal);
  });

  test("every seller-borne rupee is traceable in the ledger", async () => {
    const id = seedOrder({ financeFlags: { sellerPayoutQueued: true } });
    sellerWallet().availableBalance = 100;
    await fin.applyShiprocketShippingCharge(id, { charge: 95 });
    await ship.reconcileFinalShippingCharge(id, { finalAmount: 140, reference: "INV" });
    const p = pb(id);
    const ledgerDebits = ledgerFor(id).filter((e) => e.direction === "DEBIT").reduce((s, e) => s + e.amount, 0);
    expect(r2(ledgerDebits + p.sellerShippingDueOutstanding)).toBe(p.sellerShippingChargesTotal);
    expect(p.sellerShippingChargesTotal).toBe(140);
    expect(db.audit.filter((a) => idOf(a.orderId) === id).length).toBeGreaterThanOrEqual(2);
  });
});
