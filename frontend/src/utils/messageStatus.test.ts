import { describe, expect, it } from "vitest";
import { messageStatus, needsDeliveryReceipt } from "./messageStatus";
import { ChatSummary } from "../types";

const T1 = "2026-01-01T10:00:00.000Z";
const T2 = "2026-01-01T10:05:00.000Z";

describe("messageStatus", () => {
  it("is pending while the write has not reached the server", () => {
    expect(messageStatus({ pending: true, createdAt: T1, peerReadAt: T2 })).toBe("pending");
  });
  it("is sent when the peer has neither received nor read it", () => {
    expect(messageStatus({ pending: false, createdAt: T2, peerReadAt: T1, peerDeliveredAt: T1 })).toBe("sent");
  });
  it("is delivered once deliveredTo reaches the message", () => {
    expect(messageStatus({ pending: false, createdAt: T1, peerDeliveredAt: T2 })).toBe("delivered");
  });
  it("is read when readBy reaches the message, even without deliveredTo", () => {
    expect(messageStatus({ pending: false, createdAt: T1, peerReadAt: T1 })).toBe("read");
  });
  it("read wins over delivered", () => {
    expect(messageStatus({ pending: false, createdAt: T1, peerReadAt: T2, peerDeliveredAt: T2 })).toBe("read");
  });
});

function chat(over: Partial<ChatSummary>): ChatSummary {
  return {
    id: "c", isGroup: false, isChannel: false, name: "", avatarColor: "", members: [], adminUids: [], mutedUids: [],
    lastMessage: { content: "hi", createdAt: T2, senderId: "peer" },
    readBy: {}, deliveredTo: {}, updatedAt: T2,
    ...over,
  };
}

describe("needsDeliveryReceipt", () => {
  it("writes for a new message from the peer", () => {
    expect(needsDeliveryReceipt(chat({}), "me", false)).toBe(true);
  });
  it("skips my own messages", () => {
    expect(needsDeliveryReceipt(chat({ lastMessage: { content: "x", createdAt: T2, senderId: "me" } }), "me", false)).toBe(false);
  });
  it("skips when the receipt is already newer than the message", () => {
    expect(needsDeliveryReceipt(chat({ deliveredTo: { me: T2 } }), "me", false)).toBe(false);
  });
  it("writes again for a newer message", () => {
    expect(needsDeliveryReceipt(chat({ deliveredTo: { me: T1 } }), "me", false)).toBe(true);
  });
  it("skips while the chat is open and visible", () => {
    expect(needsDeliveryReceipt(chat({}), "me", true)).toBe(false);
  });
  it("skips groups and saved chats", () => {
    expect(needsDeliveryReceipt(chat({ isGroup: true }), "me", false)).toBe(false);
    expect(needsDeliveryReceipt(chat({ isSaved: true }), "me", false)).toBe(false);
  });
});
