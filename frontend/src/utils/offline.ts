/** Helpers for the "no internet" cases: transactions and server-side counts
 * cannot run offline, so callers turn those failures into a clear message
 * instead of an unhandled error. */

export const OFFLINE_MESSAGE = "Потрібен інтернет";

export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** True for Firestore/network errors that just mean "cannot reach the server". */
export function isOfflineError(err: unknown): boolean {
  const code = typeof (err as { code?: unknown })?.code === "string" ? (err as { code: string }).code : "";
  if (code === "unavailable" || code === "deadline-exceeded" || code === "network-request-failed" || code === "auth/network-request-failed") {
    return true;
  }
  const msg = err instanceof Error ? err.message : "";
  return /client is offline|network error|failed to fetch/i.test(msg);
}
