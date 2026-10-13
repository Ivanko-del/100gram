import { PremiumPlan, PremiumTier } from "./types";

export const WELCOME_BONUS = 500;

/** Keeps a single text message well under Firestore's 1 MB per-document
 * limit and stops accidental wall-of-text / paste spam. */
export const MAX_MESSAGE_LENGTH = 4000;

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 10;

export const PREMIUM_PLANS: PremiumPlan[] = [
  { id: "1m", tier: "premium", label: "1 місяць", days: 30, price: 500 },
  { id: "6m", tier: "premium", label: "6 місяців", days: 180, price: 2400 },
  { id: "12m", tier: "premium", label: "12 місяців", days: 365, price: 4200 },
];

export const MAX_PLANS: PremiumPlan[] = [
  { id: "max-1m", tier: "max", label: "1 місяць", days: 30, price: 900 },
  { id: "max-6m", tier: "max", label: "6 місяців", days: 180, price: 4500 },
  { id: "max-12m", tier: "max", label: "12 місяців", days: 365, price: 8000 },
];

export const PLANS_BY_TIER: Record<PremiumTier, PremiumPlan[]> = {
  premium: PREMIUM_PLANS,
  max: MAX_PLANS,
};

export const TIER_META: Record<PremiumTier, { label: string; icon: string }> = {
  premium: { label: "Преміум", icon: "⭐" },
  max: { label: "Макс", icon: "💎" },
};

/** Higher rank = higher tier; a lower tier can't be bought over a higher one. */
export const TIER_RANK: Record<PremiumTier, number> = { premium: 1, max: 2 };

/** What premium actually unlocks (keep the perks list in Settings honest). */
export const FREE_PIN_LIMIT = 3;
export const PREMIUM_PIN_LIMIT = 10;
export const FREE_FOLDER_LIMIT = 3;
export const PREMIUM_FOLDER_LIMIT = 10;
export const MAX_FOLDER_NAME = 20;
export const FREE_BIO_LIMIT = 160;
export const PREMIUM_BIO_LIMIT = 500;

/** Emoji shown next to the name (Telegram-style emoji status) */
export const STATUS_EMOJIS = [
  "⭐", "🔥", "💎", "👑", "🚀", "🌈", "🥃", "🍀", "🎧", "🎮", "📚", "💻",
  "☕", "🍕", "🌙", "☀️", "❄️", "🌊", "🎨", "🎸", "⚽", "🏆", "💜", "🖤",
  "😎", "🤖", "👻", "🦊", "🐱", "🐼", "🦄", "🍉", "✈️", "🛠️", "🎯", "🫶",
];

/** Colors for the display name in chats (Discord-style role color) */
export const NAME_COLORS = ["#ff7eb3", "#ffb347", "#ffd76e", "#7ad796", "#00c9a7", "#6ab2f2", "#b388ff", "#ff6f61"];

/** Gradient banners behind the profile card (Telegram/Discord profile theme) */
export const PROFILE_BANNERS: Record<string, string> = {
  sunset: "linear-gradient(135deg, #ff8a5c, #b44fc9)",
  ocean: "linear-gradient(135deg, #3d8fff, #14c8c8)",
  forest: "linear-gradient(135deg, #3cbe6e, #145a46)",
  candy: "linear-gradient(135deg, #ff7eb3, #ffb347)",
  night: "linear-gradient(135deg, #232526, #414345)",
  aurora: "linear-gradient(135deg, #7f5fe0, #14c8c8)",
  ember: "linear-gradient(135deg, #f12711, #f5af19)",
  royal: "linear-gradient(135deg, #1e3c72, #7f5fe0)",
};

/** Message reactions: everyone gets the first row, premium the rest */
export const REACTIONS_FREE = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
export const REACTIONS_PREMIUM = ["🎉", "🤔", "👏", "💯", "🥃", "😍", "🤝", "👀", "🙏", "💀", "🤡", "🫡", "💔", "⚡"];
export const FREE_REACTIONS_PER_MESSAGE = 1;
export const PREMIUM_REACTIONS_PER_MESSAGE = 3;
export const STATUS_TEXT_LIMIT = 60;

/** Avatar colors only premium accounts can pick */
export const PREMIUM_AVATAR_COLORS = ["#ff7eb3", "#00c9a7", "#4d96ff", "#ffb347", "#b388ff", "#ff6f61"];

export const AVATAR_COLORS = ["#6ab2f2", "#e17076", "#8774e1", "#54cb68", "#f0a72a", "#faa774", "#c650a1"];

export const BADGE_COLORS = ["#f0a72a", "#e17076", "#8774e1", "#54cb68", "#6ab2f2", "#c650a1", "#ff9a56"];

/** The one hardcoded site administrator - matched against firestore.rules'
 * own hardcoded check on usernameLower, so this can never be self-granted
 * client-side (see isSiteAdmin() in firestore.rules). */
export const SITE_ADMIN_USERNAME = "theivankoo";

export function isSiteAdmin(username: string | undefined | null): boolean {
  return (username ?? "").toLowerCase() === SITE_ADMIN_USERNAME;
}

/** Site admin (hardcoded) or an appointed moderator. */
export function isStaff(username: string | undefined | null, role?: string | null): boolean {
  return isSiteAdmin(username) || role === "moderator";
}

export interface TierLimits {
  pins: number;
  folders: number;
  bio: number;
  reactions: number;
}

/** Limits per subscription level (null = free). Single source of truth for
 * both the enforcement and the perk lists in Settings. */
export const TIER_LIMITS: Record<"free" | PremiumTier, TierLimits> = {
  free: { pins: FREE_PIN_LIMIT, folders: FREE_FOLDER_LIMIT, bio: FREE_BIO_LIMIT, reactions: FREE_REACTIONS_PER_MESSAGE },
  premium: { pins: PREMIUM_PIN_LIMIT, folders: PREMIUM_FOLDER_LIMIT, bio: PREMIUM_BIO_LIMIT, reactions: PREMIUM_REACTIONS_PER_MESSAGE },
  max: { pins: 20, folders: 20, bio: 1000, reactions: 5 },
};

export function tierLimits(tier: PremiumTier | null | undefined): TierLimits {
  return TIER_LIMITS[tier ?? "free"];
}
