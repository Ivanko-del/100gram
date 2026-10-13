import { describe, expect, it } from "vitest";
import { isOfflineError } from "./offline";

describe("isOfflineError", () => {
  it("recognises Firestore 'unavailable'", () => {
    expect(isOfflineError({ code: "unavailable", message: "x" })).toBe(true);
  });

  it("recognises the Auth network failure", () => {
    expect(isOfflineError({ code: "auth/network-request-failed" })).toBe(true);
  });

  it("recognises the 'client is offline' message", () => {
    expect(isOfflineError(new Error("Failed to get document because the client is offline."))).toBe(true);
  });

  it("does not treat permission-denied as offline", () => {
    expect(isOfflineError({ code: "permission-denied" })).toBe(false);
  });

  it("ignores non-errors", () => {
    expect(isOfflineError(null)).toBe(false);
    expect(isOfflineError("boom")).toBe(false);
  });
});
