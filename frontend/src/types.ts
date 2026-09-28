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
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  updatedAt: string;
}

export interface MessageSender {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  content: string;
  type: string;
  createdAt: string;
  editedAt?: string | null;
  sender: MessageSender;
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
