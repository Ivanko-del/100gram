import { describe, expect, it } from "vitest";
import { isSiteAdmin, SITE_ADMIN_USERNAME } from "./constants";

describe("isSiteAdmin", () => {
  it("matches the site admin username case-insensitively", () => {
    expect(isSiteAdmin(SITE_ADMIN_USERNAME)).toBe(true);
    expect(isSiteAdmin(SITE_ADMIN_USERNAME.toUpperCase())).toBe(true);
  });

  it("rejects every other username", () => {
    expect(isSiteAdmin("someoneelse")).toBe(false);
  });

  it("rejects missing input instead of throwing", () => {
    expect(isSiteAdmin(undefined)).toBe(false);
    expect(isSiteAdmin(null)).toBe(false);
    expect(isSiteAdmin("")).toBe(false);
  });
});
