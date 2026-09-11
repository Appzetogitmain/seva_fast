/**
 * Web Audio API + HTML Audio Notification Sound Player
 * Creates multi-frequency chime beeps reliably without needing external audio files.
 * Falls back to HTML Audio element for background/suspended AudioContext scenarios.
 */

/** Order-related FCM event types that should trigger the loud alert */
export const ORDER_ALERT_EVENTS = new Set([
  "NEW_ORDER",
  "NEW_DELIVERY_BROADCAST",
  "NEW_RETURN_BROADCAST",
  "DELIVERY_ASSIGNED",
  "ORDER_READY",
  "SELLER_TIMEOUT_ALERT",
  "NO_RIDER_ALERT",
]);

export function isOrderAlertEvent(eventType) {
  return ORDER_ALERT_EVENTS.has(String(eventType || "").toUpperCase());
}

class NotificationSound {
  constructor() {
    this.audioCtx = null;
    this.loopInterval = null;
    this.audioElement = null;
  }

  init() {
    if (!this.audioCtx && typeof window !== "undefined") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Try to play the WAV file from /order_alert.wav using an HTML Audio element.
   * This works even when AudioContext is suspended (e.g. tab not focused).
   * Returns true if playback started, false otherwise.
   */
  _playAudioFile() {
    try {
      if (!this.audioElement) {
        this.audioElement = new Audio("/order_alert.wav");
        this.audioElement.volume = 1.0;
      }
      // Reset to beginning if already playing
      this.audioElement.currentTime = 0;
      const playPromise = this.audioElement.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Audio file playback failed (autoplay policy), fall through to WebAudio
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  _playWebAudioChime() {
    try {
      this.init();
      if (!this.audioCtx) return false;
      if (this.audioCtx.state === "suspended") return false;

      const now = this.audioCtx.currentTime;

      // Note 1: High pitch chime (880 Hz - A5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: Higher pitch chime (1174.66 Hz - D6)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1174.66, now + 0.15);
      gain2.gain.setValueAtTime(0.5, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);

      // Note 3: Bright triangle sound (1318.51 Hz - E6)
      const osc3 = this.audioCtx.createOscillator();
      const gain3 = this.audioCtx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(1318.51, now + 0.32);
      gain3.gain.setValueAtTime(0.6, now + 0.32);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc3.connect(gain3);
      gain3.connect(this.audioCtx.destination);
      osc3.start(now + 0.32);
      osc3.stop(now + 0.7);

      return true;
    } catch (e) {
      console.warn("[notificationSound] WebAudio playback failed:", e);
      return false;
    }
  }

  playOrderAlertSound() {
    // Try HTML Audio first (works in more background scenarios), then WebAudio
    const audioPlayed = this._playAudioFile();
    if (!audioPlayed) {
      this._playWebAudioChime();
    }
  }

  startRepeatingOrderAlert() {
    this.playOrderAlertSound();
    if (this.loopInterval) clearInterval(this.loopInterval);
    this.loopInterval = setInterval(() => {
      this.playOrderAlertSound();
    }, 1200);
  }

  stopRepeatingAlert() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    // Stop audio element if playing
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }
}

export const notificationSound = new NotificationSound();
