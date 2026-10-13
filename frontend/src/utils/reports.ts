export const REPORT_REASONS = ["spam", "abuse", "scam", "illegal", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Спам",
  abuse: "Образи / цькування",
  scam: "Шахрайство",
  illegal: "Незаконний контент",
  other: "Інше",
};

export const REPORT_TEXT_LIMIT = 500;

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

/** Deterministic report id - must match the id check in firestore.rules.
 * The same reporter/target/message always maps to the same document, so a
 * repeat report becomes an update, which the rules deny. */
export function reportDocId(reporterUid: string, targetUid: string, messageId?: string | null): string {
  return `${reporterUid}_${targetUid}_${messageId || "user"}`;
}

export function clipReportText(text: string): string {
  return text.slice(0, REPORT_TEXT_LIMIT);
}

/* Reports are write-only for regular users (the rules let only the site
 * admin read them), so "already reported" is remembered locally. */
const storageKey = (uid: string) => `stogram_reported_${uid}`;

export function getReportedIds(uid: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberReported(uid: string, id: string): void {
  try {
    const ids = new Set(getReportedIds(uid));
    ids.add(id);
    localStorage.setItem(storageKey(uid), JSON.stringify([...ids]));
  } catch {
    /* storage unavailable - the rules still block duplicates */
  }
}
