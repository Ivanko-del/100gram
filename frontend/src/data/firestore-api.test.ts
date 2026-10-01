import { describe, expect, it } from "vitest";
import { normalizeUsername } from "./firestore-api";

describe("normalizeUsername", () => {
  it("strips a leading @ and lowercases", () => {
    expect(normalizeUsername("@Olha")).toBe("olha");
  });

  it("leaves a bare username lowercased", () => {
    expect(normalizeUsername("Anton")).toBe("anton");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUsername("  @bob  ")).toBe("bob");
  });

  it("treats '@name' and 'name' as the same username", () => {
    expect(normalizeUsername("@ivan")).toBe(normalizeUsername("ivan"));
  });
});
