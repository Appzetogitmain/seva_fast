import {
  splitDeliveryFee,
  computeSellerPayoutTotal,
  recalculateLogisticsEarnings,
  resolveSellerOrderEarning,
} from "../app/services/finance/pricingService.js";

const r2 = (v) => Math.round(v * 100) / 100;

/** customer paid + discount = seller + platform + (rider | Shiprocket) */
function conserve({ products, commission, fee, feeBase = fee, handling = 0, tip = 0, discount = 0, shiprocket = 0, type = "scheduled", rider = 0 }) {
  const l = recalculateLogisticsEarnings({
    deliveryFeeCharged: fee, deliveryFeeBase: feeBase, handlingFeeCharged: handling,
    adminProductCommissionTotal: commission, tipTotal: tip, deliveryType: type, riderPayoutTotal: rider,
  });
  const seller = computeSellerPayoutTotal({
    productSubtotal: products, adminProductCommissionTotal: commission,
    sellerDeliveryFeeShare: l.sellerDeliveryFeeShare, shiprocketShippingCharge: shiprocket,
  });
  const customerPaid = r2(products + fee + handling + tip - discount);
  const out = r2(seller + l.platformTotalEarning + (type === "scheduled" ? shiprocket : rider) - discount);
  return { seller, admin: l.platformTotalEarning, customerPaid, out, l };
}

describe("Pan-India delivery-fee split", () => {
  test("seller gets the full delivery fee; admin keeps commission + handling", () => {
    const r = conserve({ products: 1000, commission: 100, fee: 140, handling: 10, shiprocket: 95 });
    expect(r.seller).toBe(945);
    expect(r.admin).toBe(110);
    expect(r.out).toBe(r.customerPaid);
  });

  test("free delivery: admin funds the waived fee, seller still whole", () => {
    const r = conserve({ products: 1000, commission: 100, fee: 0, feeBase: 140, handling: 10, shiprocket: 95 });
    expect(r.seller).toBe(945);
    expect(r.l.adminDeliveryFeeShare).toBe(-140);
    expect(r.out).toBe(r.customerPaid);
  });

  test("coupon discount and tip are platform-side; split still balances", () => {
    const r = conserve({ products: 799.5, commission: 79.95, fee: 100, handling: 12.25, tip: 20, discount: 50, shiprocket: 88.4 });
    expect(r.out).toBe(r.customerPaid);
  });

  test("Shiprocket charge larger than earning gives a negative payout (recovered at settlement)", () => {
    const r = conserve({ products: 50, commission: 10, fee: 60, shiprocket: 150 });
    expect(r.seller).toBe(-50);
    expect(r.out).toBe(r.customerPaid);
  });

  test("local delivery unchanged: seller 0 of fee, admin = fee − rider", () => {
    expect(splitDeliveryFee(50, 30)).toEqual({ sellerDeliveryFeeShare: 0, adminDeliveryFeeShare: 20 });
    const r = conserve({ products: 500, commission: 50, fee: 50, handling: 5, type: "instant", rider: 30 });
    expect(r.seller).toBe(450);
    expect(r.out).toBe(r.customerPaid);
  });

  test("fee base never below the charged fee (bad snapshot data)", () => {
    expect(splitDeliveryFee(140, 0, { deliveryType: "scheduled", deliveryFeeBase: 100 }).sellerDeliveryFeeShare).toBe(140);
  });

  test("legacy order without stored payout derives the same figure", () => {
    const order = {
      deliveryType: "scheduled",
      pricing: { subtotal: 1000, deliveryFee: 140 },
      paymentBreakdown: { adminProductCommissionTotal: 100, deliveryFeeBase: 140, shiprocketShippingCharge: 95 },
    };
    expect(resolveSellerOrderEarning(order)).toBe(945);
  });
});
