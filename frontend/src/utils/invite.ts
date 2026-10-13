import type { ChatSummary } from "../types";

/** Link that opens the "join" screen for a group/channel. Public chats need
 * no code; a private one carries its secret invite code, or null when the
 * chat has none yet (an admin has to create it first). */
export function buildInviteLink(
  chat: Pick<ChatSummary, "id" | "isPublic" | "inviteCode">,
  origin: string
): string | null {
  const base = `${origin}/join/${encodeURIComponent(chat.id)}`;
  if (chat.isPublic) return base;
  return chat.inviteCode ? `${base}?k=${encodeURIComponent(chat.inviteCode)}` : null;
}
