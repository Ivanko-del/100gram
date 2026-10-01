/** Phone numbers are stored and looked up as bare digits in international
 * format, e.g. "380671234567". Accepts "+380 67 123 45 67", "067 123 45 67",
 * "0671234567" and similar. Returns null when it doesn't look like a number. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  // Ukrainian national format: 0XX XXX XX XX -> 380XXXXXXXXX
  if (digits.length === 10 && digits.startsWith("0")) digits = "38" + digits;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

/** "380671234567" -> "+380 67 123 45 67" (Ukrainian grouping; other
 * countries just get a leading "+"). */
export function formatPhone(digits: string): string {
  const m = /^380(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(digits);
  return m ? `+380 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${digits}`;
}

/** True when the text looks like someone typing a phone number rather than a
 * username/email: mostly digits, optional leading + and separators. */
export function looksLikePhone(input: string): boolean {
  const t = input.trim();
  return /^\+?[\d\s()-]{5,}$/.test(t) && !t.includes("@");
}
