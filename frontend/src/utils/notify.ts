/** Desktop/phone notifications while the tab is in the background. Works only
 * while the app is open - real push when it is closed needs a server (FCM). */

const KEYS = { enabled: "stogram_notify", preview: "stogram_notify_preview" } as const;

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
    /* storage blocked - the pref just won't persist */
  }
}

export function notificationsSupported(): boolean {
  return typeof Notification !== "undefined";
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export function isBrowserNotifyEnabled(): boolean {
  return read(KEYS.enabled) === "1" && notificationPermission() === "granted";
}

/** Turning on asks the browser for permission; resolves to whether it is on now. */
export async function setBrowserNotify(on: boolean): Promise<boolean> {
  if (!on) {
    write(KEYS.enabled, "0");
    return false;
  }
  if (!notificationsSupported()) return false;
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  const granted = permission === "granted";
  write(KEYS.enabled, granted ? "1" : "0");
  return granted;
}

export function isNotifyPreviewEnabled(): boolean {
  return read(KEYS.preview) !== "0";
}

export function setNotifyPreview(on: boolean) {
  write(KEYS.preview, on ? "1" : "0");
}

/** Shows a notification for a new message, only when the app is not in focus. */
export function showMessageNotification(title: string, body: string, tag: string) {
  if (!isBrowserNotifyEnabled() || !document.hidden) return;
  try {
    new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
  } catch {
    /* some mobile browsers only allow notifications through a service worker */
  }
}
