/** Device-local UI preferences (localStorage). Applied to <html> as data
 * attributes so plain CSS can react to them, no re-render plumbing needed. */

export type FontSize = "s" | "m" | "l";
export type ChatBackground = "plain" | "aurora" | "dots";

const KEYS = {
  font: "stogram_font",
  background: "stogram_chat_bg",
  compact: "stogram_compact",
  enterSends: "stogram_enter_sends",
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
  return v === "plain" || v === "dots" ? v : "aurora";
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

export function applyPrefs() {
  const root = document.documentElement;
  root.dataset.font = getFontSize();
  root.dataset.chatBg = getChatBackground();
  root.dataset.compact = isCompactList() ? "1" : "0";
}
