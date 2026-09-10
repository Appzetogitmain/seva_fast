/**
 * Centralized Settings and Sound/Vibration utilities for the Delivery module.
 */

export const DEFAULT_DELIVERY_SETTINGS = Object.freeze({
  pushNotifications: true,
  sound: true,
  vibration: true,
  emailAlerts: false,
});

const SETTINGS_KEY = "app_settings";
let vibrationInterval = null;

/**
 * Retrieve current delivery app settings from localStorage.
 */
export function getDeliverySettings() {
  if (typeof window === "undefined") return { ...DEFAULT_DELIVERY_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pushNotifications: parsed.pushNotifications !== false,
        sound: parsed.sound !== false,
        vibration: parsed.vibration !== false,
        emailAlerts: Boolean(parsed.emailAlerts),
      };
    }
  } catch (err) {
    console.warn("[deliverySettings] Error reading settings from localStorage:", err);
  }
  return { ...DEFAULT_DELIVERY_SETTINGS };
}

/**
 * Persist delivery settings to localStorage and notify listeners.
 */
export function saveDeliverySettings(settings) {
  if (typeof window === "undefined") return;
  try {
    const current = getDeliverySettings();
    const updated = {
      ...current,
      ...settings,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("delivery_settings_changed", { detail: updated }),
    );
    return updated;
  } catch (err) {
    console.warn("[deliverySettings] Error saving settings to localStorage:", err);
    return { ...DEFAULT_DELIVERY_SETTINGS, ...settings };
  }
}

/**
 * Trigger vibration if vibration is enabled in delivery settings.
 */
export function startDeliveryVibration(pattern = [400, 200, 400, 200, 400]) {
  stopDeliveryVibration();
  const settings = getDeliverySettings();
  if (!settings.vibration) return;

  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
      // Keep repeating vibration until explicitly stopped
      vibrationInterval = setInterval(() => {
        const activeSettings = getDeliverySettings();
        if (!activeSettings.vibration) {
          stopDeliveryVibration();
          return;
        }
        navigator.vibrate(pattern);
      }, 1500);
    }

    // Support Flutter native wrapper if running in AppZeto webview
    if (typeof window !== "undefined" && window.Flutter) {
      window.Flutter.postMessage("vibrate");
    }
  } catch (err) {
    console.warn("[deliverySettings] Vibration trigger failed:", err);
  }
}

/**
 * Cancel any ongoing device vibration.
 */
export function stopDeliveryVibration() {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(0);
    }
  } catch (err) {
    // ignore
  }
}
