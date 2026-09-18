export const RETURN_REASON_CODES = {
  ITEM_DAMAGED: "ITEM_DAMAGED",
  WRONG_ITEM: "WRONG_ITEM",
  PARCEL_DAMAGED: "PARCEL_DAMAGED",
  QUALITY_NOT_AS_EXPECTED: "QUALITY_NOT_AS_EXPECTED",
  MISSING_ITEM: "MISSING_ITEM",
  PERFORMANCE_NOT_ADEQUATE: "PERFORMANCE_NOT_ADEQUATE",
  SIZE_NOT_AS_EXPECTED: "SIZE_NOT_AS_EXPECTED",
  DOES_NOT_FIT: "DOES_NOT_FIT",
  NOT_AS_DESCRIBED: "NOT_AS_DESCRIBED",
  ARRIVED_TOO_LATE: "ARRIVED_TOO_LATE",
  CHANGED_MY_MIND: "CHANGED_MY_MIND",
  OTHER: "OTHER",
};

export const ALL_RETURN_REASON_CODES = Object.values(RETURN_REASON_CODES);

export const RETURN_REASON_LABELS = {
  ITEM_DAMAGED: "Item damaged",
  WRONG_ITEM: "Wrong item delivered",
  PARCEL_DAMAGED: "Parcel damaged in transit",
  QUALITY_NOT_AS_EXPECTED: "Quality not as expected",
  MISSING_ITEM: "Missing item(s) in the order",
  PERFORMANCE_NOT_ADEQUATE: "Product performance not adequate",
  SIZE_NOT_AS_EXPECTED: "Size not as expected",
  DOES_NOT_FIT: "Does not fit",
  NOT_AS_DESCRIBED: "Not as described",
  ARRIVED_TOO_LATE: "Arrived too late",
  CHANGED_MY_MIND: "Changed my mind",
  OTHER: "Other",
};

export function normalizeReturnReasonCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return ALL_RETURN_REASON_CODES.includes(code) ? code : RETURN_REASON_CODES.OTHER;
}
