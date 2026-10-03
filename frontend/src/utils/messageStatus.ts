import { ChatSummary } from "../types";

export type MessageStatus = "pending" | "sent" | "delivered" | "read";

function atLeast(a: string | null | undefined, b: string): boolean {
  return !!a && new Date(a).getTime() >= new Date(b).getTime();
}

/** Status of MY message in a direct chat. Read implies delivered, so a
 * peer who has opened the chat needs no separate deliveredTo entry. */
export function messageStatus(opts: {
  pending: boolean;
  createdAt: string;
  peerReadAt?: string | null;
  peerDeliveredAt?: string | null;
}): MessageStatus {
  if (opts.pending) return "pending";
  if (atLeast(opts.peerReadAt, opts.createdAt)) return "read";
  if (atLeast(opts.peerDeliveredAt, opts.createdAt)) return "delivered";
  return "sent";
}

/** Should this client record "delivered" for the chat's last message? Only
 * direct chats, only someone else's message, only when newer than my
 * previous receipt - and not while the chat is open and visible (reading
 * it already counts as delivered). */
export function needsDeliveryReceipt(chat: ChatSummary, myUid: string, chatOpenAndVisible: boolean): boolean {
  if (chat.isGroup || chat.isSaved || chatOpenAndVisible) return false;
  const last = chat.lastMessage;
  if (!last || last.senderId === myUid) return false;
  const mine = chat.deliveredTo?.[myUid];
  return !mine || new Date(last.createdAt).getTime() > new Date(mine).getTime();
}
