/**
 * Web Audio API Notification Sound Player
 * Creates multi-frequency chime beeps reliably without needing external audio files.
 */
class NotificationSound {
  constructor() {
    this.audioCtx = null;
    this.loopInterval = null;
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

  playOrderAlertSound() {
    try {
      this.init();
      if (!this.audioCtx) return;

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
    } catch (e) {
      console.warn("[notificationSound] Audio playback failed:", e);
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
  }
}

export const notificationSound = new NotificationSound();
