import { describe, expect, it } from "vitest";
import { REPORT_TEXT_LIMIT, clipReportText, isReportReason, reportDocId } from "./reports";

describe("reportDocId", () => {
  it("builds reporter_target_message", () => {
    expect(reportDocId("a", "b", "m1")).toBe("a_b_m1");
  });
  it("uses 'user' for a report on the profile itself", () => {
    expect(reportDocId("a", "b")).toBe("a_b_user");
    expect(reportDocId("a", "b", null)).toBe("a_b_user");
    expect(reportDocId("a", "b", "")).toBe("a_b_user");
  });
  it("is deterministic", () => {
    expect(reportDocId("a", "b", "m")).toBe(reportDocId("a", "b", "m"));
  });
});

describe("isReportReason", () => {
  it("accepts the five reasons", () => {
    for (const r of ["spam", "abuse", "scam", "illegal", "other"]) expect(isReportReason(r)).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isReportReason("boring")).toBe(false);
    expect(isReportReason("")).toBe(false);
    expect(isReportReason(null)).toBe(false);
    expect(isReportReason(5)).toBe(false);
  });
});

describe("clipReportText", () => {
  it("cuts to the 500-char limit", () => {
    expect(clipReportText("x".repeat(900))).toHaveLength(REPORT_TEXT_LIMIT);
    expect(clipReportText("short")).toBe("short");
  });
});
