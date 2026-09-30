import { describe, expect, it } from "vitest";
import { formatPhone, looksLikePhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("accepts international and national Ukrainian formats", () => {
    expect(normalizePhone("+380 67 123 45 67")).toBe("380671234567");
    expect(normalizePhone("067 123 45 67")).toBe("380671234567");
    expect(normalizePhone("(067)1234567")).toBe("380671234567");
  });

  it("rejects things that are not phone numbers", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("1".repeat(20))).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups Ukrainian numbers and prefixes others with +", () => {
    expect(formatPhone("380671234567")).toBe("+380 67 123 45 67");
    expect(formatPhone("14155550123")).toBe("+14155550123");
  });
});

describe("looksLikePhone", () => {
  it("tells phones from usernames and emails", () => {
    expect(looksLikePhone("+380 67 123 45 67")).toBe(true);
    expect(looksLikePhone("anton")).toBe(false);
    expect(looksLikePhone("a@b.com")).toBe(false);
  });
});
