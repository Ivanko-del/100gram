import { describe, expect, it } from "vitest";
import { isUnread } from "./unread";
import type { ChatSummary } from "../types";

const chat = (over: Partial<ChatSummary>): ChatSummary =>
  ({
    id: "c1",
    isGroup: false,
    isChannel: false,
    name: "x",
    avatarColor: "#fff",
    members: [],
    adminUids: [],
    mutedUids: [],
    lastMessage: { content: "hi", createdAt: "2026-01-02T10:00:00.000Z", senderId: "bob" },
    readBy: {},
    updatedAt: "2026-01-02T10:00:00.000Z",
    ...over,
  }) as ChatSummary;

describe("isUnread", () => {
  it("is read when I sent the last message or there is none", () => {
    expect(isUnread(chat({ lastMessage: { content: "x", createdAt: "2026-01-02T10:00:00.000Z", senderId: "me" } }), "me")).toBe(false);
    expect(isUnread(chat({ lastMessage: null }), "me")).toBe(false);
  });

  it("is unread when the last message is newer than my read time", () => {
    expect(isUnread(chat({ readBy: { me: "2026-01-02T09:00:00.000Z" } }), "me")).toBe(true);
    expect(isUnread(chat({ readBy: { me: "2026-01-02T11:00:00.000Z" } }), "me")).toBe(false);
  });

  it("counts a chat I never read as unread once someone else has read-tracking in it", () => {
    expect(isUnread(chat({ readBy: { bob: "2026-01-02T10:00:00.000Z" } }), "me")).toBe(true);
  });

  it("treats a legacy chat with no read-tracking at all as read", () => {
    expect(isUnread(chat({ readBy: {} }), "me")).toBe(false);
  });
});
