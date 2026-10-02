import { describe, expect, it } from "vitest";
import { buildInviteLink } from "./invite";

const ORIGIN = "https://100gram.example";

describe("buildInviteLink", () => {
  it("gives a public chat a plain join link without any code", () => {
    expect(buildInviteLink({ id: "grp_1", isPublic: true, inviteCode: "secret" }, ORIGIN)).toBe(
      "https://100gram.example/join/grp_1"
    );
  });

  it("puts the invite code into a private chat's link", () => {
    expect(buildInviteLink({ id: "ch_2", isPublic: false, inviteCode: "abc123" }, ORIGIN)).toBe(
      "https://100gram.example/join/ch_2?k=abc123"
    );
  });

  it("has no link for a private chat that was never given a code", () => {
    expect(buildInviteLink({ id: "grp_3", isPublic: false, inviteCode: null }, ORIGIN)).toBeNull();
    expect(buildInviteLink({ id: "grp_3" }, ORIGIN)).toBeNull();
  });
});
