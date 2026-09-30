import { ChatSummary } from "../types";

/** A chat is unread when its last message is someone else's and newer than
 * the moment this user last read it. Chats never opened before (no readBy
 * entry) are treated as read - ChatPage initialises them silently. */
export function isUnread(chat: ChatSummary, myUid: string): boolean {
  const last = chat.lastMessage;
  if (!last || last.senderId === myUid) return false;
  const readAt = chat.readBy[myUid];
  if (!readAt) return false;
  return new Date(last.createdAt).getTime() > new Date(readAt).getTime();
}
