import { describe, expect, it } from "vitest";
import { formatLastSeen } from "./lastSeen";

const now = new Date(2026, 8, 30, 15, 0, 0);
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("formatLastSeen", () => {
  it("shows online for the last two minutes", () => {
    expect(formatLastSeen(ago(30_000), now)).toBe("в мережі");
  });

  it("handles today, yesterday and older", () => {
    expect(formatLastSeen(ago(3 * 3_600_000), now)).toMatch(/^був\(ла\) сьогодні о \d\d:\d\d$/);
    expect(formatLastSeen(ago(24 * 3_600_000), now)).toMatch(/^був\(ла\) вчора о/);
    expect(formatLastSeen(ago(3 * 86_400_000), now)).toBe("був(ла) 3 дн. тому");
    expect(formatLastSeen(ago(30 * 86_400_000), now)).toMatch(/^був\(ла\) \d\d\.\d\d\.\d{4}$/);
  });

  it("is vague when hidden or unknown", () => {
    expect(formatLastSeen(null, now)).toBe("був(ла) нещодавно");
  });
});
