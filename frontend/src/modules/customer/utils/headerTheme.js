/** Shift hex color channels by amount (negative = darker). */
export function shiftHex(hex, amount) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return hex;

  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;

  const value = normalized.slice(1);
  if (value.length !== 6) return hex;

  const clamp = (num) => Math.max(0, Math.min(255, num + amount));
  const r = clamp(parseInt(value.slice(0, 2), 16));
  const g = clamp(parseInt(value.slice(2, 4), 16));
  const b = clamp(parseInt(value.slice(4, 6), 16));

  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

const DEFAULT_BASE = "#0e7490";

/** Blend hex toward white (t=0 base, t≈1 near-white). */
export function mixHexWithWhite(hex, t) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) {
    return "#f8fafc";
  }
  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const value = normalized.slice(1);
  if (value.length !== 6) return "#f8fafc";

  const mix = (c) => Math.round(c + (255 - c) * t);
  const r = mix(parseInt(value.slice(0, 2), 16));
  const g = mix(parseInt(value.slice(2, 4), 16));
  const b = mix(parseInt(value.slice(4, 6), 16));
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Check if a string is a valid hex color code. */
export function isValidHex(hex) {
  return typeof hex === "string" && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

/** Calculate perceived relative luminance of a hex color (0 = black, 1 = white). */
export function getLuminance(hex) {
  if (!isValidHex(hex)) return 0.5;
  const clean = hex.replace("#", "");
  const r = parseInt(clean.length === 3 ? clean[0] + clean[0] : clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.length === 3 ? clean[1] + clean[1] : clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.length === 3 ? clean[2] + clean[2] : clean.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 0.5;

  const a = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/** Check if a background color is light/bright (yellow, lime, amber, white, pastel, etc.) */
export function isLightColor(hex) {
  return getLuminance(hex) > 0.42;
}

/** Get best contrasting text/icon color against a background color */
export function getContrastingColor(bgHex, preferredHex) {
  const isBgLight = isLightColor(bgHex);

  if (isValidHex(preferredHex)) {
    const isPreferredLight = isLightColor(preferredHex);
    // If background is light (like yellow) and preferred color is also light (like white), force deep slate
    if (isBgLight && isPreferredLight) {
      return "#0F172A";
    }
    // If background is dark and preferred color is dark, force crisp white
    if (!isBgLight && !isPreferredLight) {
      return "#FFFFFF";
    }
    return preferredHex;
  }

  return isBgLight ? "#0F172A" : "#FFFFFF";
}

/** Search field surface: tinted header theme, a bit darker than near-white. */
export function buildSearchBarBackgroundColor(baseHeaderColor) {
  const base = baseHeaderColor || DEFAULT_BASE;
  return mixHexWithWhite(base, 0.7);
}

/**
 * Gradient for main location header (category-driven).
 */
export function buildHeaderGradient(baseHeaderColor) {
  const base = baseHeaderColor || DEFAULT_BASE;
  return `linear-gradient(to bottom, ${shiftHex(base, -18)} 0%, ${shiftHex(base, 20)} 54%, ${shiftHex(base, 165)} 100%)`;
}

/** Solid fill for floating cart pill: header mid tone, slightly darker. */
export function buildMiniCartColor(baseHeaderColor) {
  const base = baseHeaderColor || DEFAULT_BASE;
  const mid = shiftHex(base, 20);
  return shiftHex(mid, -26);
}

/** Gradient for floating mini cart pill (same palette as header, horizontal). */
export function buildMiniCartGradient(baseHeaderColor) {
  const base = baseHeaderColor || DEFAULT_BASE;
  const top = shiftHex(base, -12);
  const mid = shiftHex(base, 20);
  const deep = shiftHex(mid, -32);
  return `linear-gradient(135deg, ${top} 0%, ${mid} 48%, ${deep} 100%)`;
}
