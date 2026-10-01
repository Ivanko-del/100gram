export interface UserBadge {
  text: string;
  color: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  avatarUrl?: string | null;
  isPremium: boolean;
  premiumUntil?: string | null;
  grams: number;
  mutedGlobally?: boolean;
  /** Optional, ISO date (YYYY-MM-DD) */
  birthDate?: string | null;
  /** Digits only, international format (see utils/phone.ts). Unverified. */
  phone?: string | null;
  /** Hide the birth date from other users' view of this profile */
  hideBirthDate?: boolean;
  /** Last time the app was open (heartbeat); hidden from others when hideLastSeen */
  lastSeenAt?: string | null;
  hideLastSeen?: boolean;
  /** Chats the user muted for themselves (no sound), and users they blocked */
  mutedChats?: string[];
  blockedUids?: string[];
  /** Premium cosmetics, shown only while premium is active */
  emojiStatus?: string | null;
  statusText?: string | null;
  nameColor?: string | null;
  profileBanner?: string | null;
  /** Per-user chat list prefs ("Telegram-style" pin / archive / delete-for-me) */
  pinnedChats?: string[];
  archivedChats?: string[];
  /** chatId -> ISO time the user removed it; it comes back on a newer message */
  hiddenChats?: Record<string, string>;
  badge?: UserBadge | null;
  showAdminBadge?: boolean;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  avatarUrl?: string | null;
  isPremium: boolean;
  lastSeenAt?: string;
  emojiStatus?: string | null;
  nameColor?: string | null;
  statusText?: string | null;
}

export interface ChatSummary {
  id: string;
  isGroup: boolean;
  isChannel: boolean;
  name: string;
  avatarColor: string;
  avatarUrl?: string | null;
  members: PublicUser[];
  adminUids: string[];
  mutedUids: string[];
  /** The per-user "Saved messages" chat (only member is its owner) */
  isSaved?: boolean;
  /** Groups/channels: text shown in the members panel */
  description?: string | null;
  /** Direct chats: the other person's last-seen time (null when hidden/unknown) */
  peerLastSeenAt?: string | null;
  peerId?: string | null;
  /** Direct chats: the other person's premium cosmetics */
  emojiStatus?: string | null;
  nameColor?: string | null;
  statusText?: string | null;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  /** uid -> when that member last read the chat (drives unread badges and ✓✓) */
  readBy: Record<string, string>;
  updatedAt: string;
  /** id of the message shown in the pinned banner at the top of the chat */
  pinnedMessageId?: string | null;
}

export interface PollData {
  question: string;
  options: string[];
  /** optionIndex (as string) -> uids who voted for it */
  votes: Record<string, string[]>;
}

export interface MessageSender {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  emojiStatus?: string | null;
  nameColor?: string | null;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  content: string;
  type: "text" | "image" | "poll";
  createdAt: string;
  editedAt?: string | null;
  sender: MessageSender;
  /** emoji -> uids that reacted with it */
  reactions: Record<string, string[]>;
  /** set only when type is "poll" */
  poll?: PollData | null;
  /** set when this message answers another one */
  replyTo?: { id: string; name: string; text: string; type: "text" | "image" | "poll" } | null;
  /** original author's name when the message was forwarded */
  forwardedFrom?: string | null;
}

export interface PremiumPlan {
  id: string;
  label: string;
  days: number;
  price: number;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  note?: string | null;
  createdAt: string;
  direction: "in" | "out";
  counterparty: { username: string; displayName: string };
}
