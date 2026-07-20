/**
 * Project-wide display date helpers.
 * Canonical date format: DD/MM/YYYY
 */

function parseDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** @returns {string} DD/MM/YYYY */
export function formatDate(value, fallback = "—") {
  const d = parseDate(value);
  if (!d) return fallback;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** @returns {string} HH:mm (24h) */
export function formatTime(value, fallback = "—") {
  const d = parseDate(value);
  if (!d) return fallback;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** @returns {string} DD/MM/YYYY HH:mm */
export function formatDateTime(value, fallback = "—") {
  const d = parseDate(value);
  if (!d) return fallback;
  return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * Same calendar day in local time (for "today" filters).
 */
export function isSameCalendarDay(a, b = new Date()) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export default formatDate;
