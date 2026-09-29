import { PremiumPlan } from "./types";

export const WELCOME_BONUS = 500;

export const PREMIUM_PLANS: PremiumPlan[] = [
  { id: "1m", label: "1 місяць", days: 30, price: 500 },
  { id: "6m", label: "6 місяців", days: 180, price: 2400 },
  { id: "12m", label: "12 місяців", days: 365, price: 4200 },
];

/** What premium actually unlocks (keep the perks list in Settings honest). */
export const FREE_PIN_LIMIT = 3;
export const PREMIUM_PIN_LIMIT = 10;
export const FREE_BIO_LIMIT = 160;
export const PREMIUM_BIO_LIMIT = 500;

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
