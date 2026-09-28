const SOUND_KEY = "stogram_sound";

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== "off";
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
}

let audioCtx: AudioContext | null = null;

/** Synthesizes a short two-note "ping" - no audio file to ship or load. */
export function playNotificationSound() {
  if (!isSoundEnabled()) return;
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // Audio can fail for reasons outside our control (autoplay policy,
    // no audio device, ...) - a missed notification sound isn't worth
    // surfacing an error for.
  }
}
