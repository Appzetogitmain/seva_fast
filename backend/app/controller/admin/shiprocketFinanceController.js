import handleResponse from "../../utils/helper.js";
import {
  SHIPPING_CHARGE_KIND,
  listOutstandingSellerShippingDues,
  markShiprocketCodRemitted,
  reconcileFinalShippingCharge,
} from "../../services/finance/shippingChargeService.js";

const BASE_KINDS = [
  SHIPPING_CHARGE_KIND.FORWARD,
  SHIPPING_CHARGE_KIND.RTO,
  SHIPPING_CHARGE_KIND.RETURN_PICKUP,
];

/**
 * POST /admin/finance/shiprocket/reconcile
 * Body: { items: [{ orderId, kind?: FORWARD|RTO|RETURN_PICKUP, finalAmount, reference?, reason? }] }
 * `finalAmount` = total Shiprocket finally billed for that charge (incl.
 * weight-discrepancy / extra charges). Posts only the difference; safe to
 * re-upload the same billing sheet.
 */
export async function reconcileShiprocketChargesController(req, res) {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    if (!items.length || items.length > 500) {
      return handleResponse(res, 400, "Provide 1–500 items");
    }
    const results = [];
    for (const item of items) {
      const kind = String(item?.kind || SHIPPING_CHARGE_KIND.FORWARD).toUpperCase();
      if (!item?.orderId || !BASE_KINDS.includes(kind) || !Number.isFinite(Number(item.finalAmount))) {
        results.push({ orderId: item?.orderId || null, error: "orderId, finalAmount and a valid kind are required" });
        continue;
      }
      try {
        const r = await reconcileFinalShippingCharge(item.orderId, {
          kind,
          finalAmount: Number(item.finalAmount),
          reference: item.reference ? String(item.reference).slice(0, 120) : "",
          reason: item.reason ? String(item.reason).slice(0, 300) : "",
          actorId: req.user?.id || null,
        });
        results.push({ orderId: item.orderId, kind, ...r, entry: undefined });
      } catch (error) {
        results.push({ orderId: item.orderId, kind, error: error.message });
      }
    }
    return handleResponse(res, 200, "Shiprocket charges reconciled", { results });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
}

/** POST /admin/finance/shiprocket/cod-remitted  Body: { orderIds: [], utr, remittedAt? } */
export async function markShiprocketCodRemittedController(req, res) {
  try {
    const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];
    if (!orderIds.length || orderIds.length > 500) {
      return handleResponse(res, 400, "Provide 1–500 orderIds");
    }
    const results = await markShiprocketCodRemitted(orderIds, {
      utr: String(req.body?.utr || "").slice(0, 80),
      remittedAt: req.body?.remittedAt || null,
      actorId: req.user?.id || null,
    });
    return handleResponse(res, 200, "COD remittance recorded", { results });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
}

/** GET /admin/finance/shiprocket/seller-dues?sellerId= */
export async function getSellerShippingDuesController(req, res) {
  try {
    const dues = await listOutstandingSellerShippingDues({ sellerId: req.query?.sellerId || null });
    return handleResponse(res, 200, "Outstanding seller shipping dues", { dues });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
}
