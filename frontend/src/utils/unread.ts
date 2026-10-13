import { ChatSummary } from "../types";

/** A chat is unread when its last message is someone else's and newer than
 * the moment this user last read it. A chat this user has never read counts
 * as unread once anyone else has read-tracking in it (it is a new chat they
 * were sent into); only a legacy chat with no read-tracking at all is treated
 * as read - ChatPage initialises those silently. */
export function isUnread(chat: ChatSummary, myUid: string): boolean {
  const last = chat.lastMessage;
  if (!last || last.senderId === myUid) return false;
  const readAt = chat.readBy[myUid];
  if (!readAt) return Object.keys(chat.readBy).length > 0;
  return new Date(last.createdAt).getTime() > new Date(readAt).getTime();
}
