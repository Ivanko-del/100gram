import { PremiumPlan } from "./types";

export const WELCOME_BONUS = 500;

export const PREMIUM_PLANS: PremiumPlan[] = [
  { id: "1m", label: "1 місяць", days: 30, price: 100 },
  { id: "6m", label: "6 місяців", days: 180, price: 500 },
  { id: "12m", label: "12 місяців", days: 365, price: 900 },
];

export const AVATAR_COLORS = ["#6ab2f2", "#e17076", "#8774e1", "#54cb68", "#f0a72a", "#faa774", "#c650a1"];
