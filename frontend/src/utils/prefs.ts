/** Device-local UI preferences (localStorage). Applied to <html> as data
 * attributes so plain CSS can react to them, no re-render plumbing needed. */

export type FontSize = "s" | "m" | "l";
export type ChatBackground = "plain" | "aurora" | "dots" | "sunset" | "ocean" | "forest";
export type Accent = "purple" | "blue" | "green" | "orange" | "pink" | "red";

/** Everything except the default purple accent, and the gradient chat
 * backgrounds below, is a premium perk. */
export const PREMIUM_ACCENTS: Accent[] = ["blue", "green", "orange", "pink", "red"];
export const PREMIUM_BACKGROUNDS: ChatBackground[] = ["sunset", "ocean", "forest"];

const KEYS = {
  font: "stogram_font",
  background: "stogram_chat_bg",
  compact: "stogram_compact",
  enterSends: "stogram_enter_sends",
  accent: "stogram_accent",
  power: "stogram_power",
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked (private mode) - the pref just won't persist */
  }
}

export function getFontSize(): FontSize {
  const v = read(KEYS.font);
  return v === "s" || v === "l" ? v : "m";
}

export function getChatBackground(): ChatBackground {
  const v = read(KEYS.background);
  return v === "plain" || v === "dots" || v === "sunset" || v === "ocean" || v === "forest" ? v : "aurora";
}

export function getAccent(): Accent {
  const v = read(KEYS.accent);
  return v === "blue" || v === "green" || v === "orange" || v === "pink" || v === "red" ? v : "purple";
}

export function setAccent(v: Accent) {
  write(KEYS.accent, v);
  applyPrefs();
}

/** When premium is missing or has run out, fall back to the free look. */
export function enforceFreeTier() {
  if (PREMIUM_ACCENTS.includes(getAccent())) write(KEYS.accent, "purple");
  if (PREMIUM_BACKGROUNDS.includes(getChatBackground())) write(KEYS.background, "aurora");
  applyPrefs();
}

export function isCompactList(): boolean {
  return read(KEYS.compact) === "1";
}

/** Enter sends the message (Shift+Enter = new line). Off = Enter adds a
 * line break and only the send button sends. */
export function isEnterSends(): boolean {
  return read(KEYS.enterSends) !== "0";
}

export function setFontSize(v: FontSize) {
  write(KEYS.font, v);
  applyPrefs();
}

export function setChatBackground(v: ChatBackground) {
  write(KEYS.background, v);
  applyPrefs();
}

export function setCompactList(v: boolean) {
  write(KEYS.compact, v ? "1" : "0");
  applyPrefs();
}

export function setEnterSends(v: boolean) {
  write(KEYS.enterSends, v ? "1" : "0");
}

/** Power saving: "on" always, "auto" only while the battery is low. */
export type PowerSaving = "off" | "on" | "auto";

export function getPowerSaving(): PowerSaving {
  const v = read(KEYS.power);
  return v === "on" || v === "auto" ? v : "off";
}

export function setPowerSaving(v: PowerSaving) {
  write(KEYS.power, v);
  applyPrefs();
}

const LOW_BATTERY_LEVEL = 0.2;
let batteryLow = false;

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

/** The Battery Status API only exists in Chromium browsers. */
export function canWatchBattery(): boolean {
  return typeof navigator !== "undefined" && "getBattery" in navigator;
}

/** Keeps "auto" power saving in step with the battery (no-op where unsupported). */
export function watchBattery() {
  if (!canWatchBattery()) return;
  (navigator as Navigator & { getBattery: () => Promise<BatteryManager> })
    .getBattery()
    .then((battery) => {
      const update = () => {
        batteryLow = !battery.charging && battery.level <= LOW_BATTERY_LEVEL;
        applyPrefs();
      };
      battery.addEventListener("levelchange", update);
      battery.addEventListener("chargingchange", update);
      update();
    })
    .catch(() => {
      /* battery info denied - "auto" simply never switches on */
    });
}

export function isPowerSavingActive(): boolean {
  const mode = getPowerSaving();
  return mode === "on" || (mode === "auto" && batteryLow);
}

export function applyPrefs() {
  const root = document.documentElement;
  root.dataset.powersave = isPowerSavingActive() ? "1" : "0";
  root.dataset.font = getFontSize();
  root.dataset.chatBg = getChatBackground();
  root.dataset.accent = getAccent();
  root.dataset.compact = isCompactList() ? "1" : "0";
}
