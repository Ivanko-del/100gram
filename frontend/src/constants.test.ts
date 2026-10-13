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

describe("subscription tiers", () => {
  it("each tier unlocks at least as much as the one below", async () => {
    const { TIER_LIMITS } = await import("./constants");
    for (const k of ["pins", "folders", "bio", "reactions"] as const) {
      expect(TIER_LIMITS.premium[k]).toBeGreaterThan(TIER_LIMITS.free[k]);
      expect(TIER_LIMITS.max[k]).toBeGreaterThan(TIER_LIMITS.premium[k]);
    }
  });

  it("falls back to free limits without a tier", async () => {
    const { tierLimits, TIER_LIMITS } = await import("./constants");
    expect(tierLimits(null)).toBe(TIER_LIMITS.free);
    expect(tierLimits(undefined)).toBe(TIER_LIMITS.free);
  });

  it("every plan is tagged with the tier of its list and Max costs more per month", async () => {
    const { PLANS_BY_TIER } = await import("./constants");
    for (const [tier, plans] of Object.entries(PLANS_BY_TIER)) {
      for (const p of plans) expect(p.tier).toBe(tier);
    }
    PLANS_BY_TIER.max.forEach((p, i) => expect(p.price).toBeGreaterThan(PLANS_BY_TIER.premium[i].price));
  });
});
