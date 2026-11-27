/**
 * Admin Commission Sharing Model.
 *
 * Every split below is a percentage OF THE ADMIN COMMISSION earned on an
 * order (not of the product value). Together they may not exceed 100%; the
 * remainder is what the platform keeps.
 */
export const SPLIT_PERCENT_KEYS = [
  "technicalChargePercent",
  "otherMaintenancePercent",
  "subAdminCommissionPercent",
  "fieldWorkerCommissionPercent",
  "affiliateMarketingPercent",
  "advertiseChargePercent",
  "siteCashbackPercent",
  "directSlabCommissionPercent",
];

/**
 * Validate the split percentages after applying `incoming` on top of `current`.
 * Returns an error message, or null when valid.
 */
export function validateSplitPercents(current = {}, incoming = {}) {
  const touched = SPLIT_PERCENT_KEYS.some((k) => incoming[k] !== undefined);
  if (!touched) return null;

  let total = 0;
  for (const key of SPLIT_PERCENT_KEYS) {
    const raw = incoming[key] !== undefined ? incoming[key] : current[key];
    const value = Number(raw ?? 0);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return `${key} must be between 0 and 100`;
    }
    total += value;
  }
  total = Math.round(total * 100) / 100;
  if (total > 100) {
    return `Commission splits add up to ${total}% of the admin commission. They must total 100% or less (the remainder is kept by the platform).`;
  }
  return null;
}
