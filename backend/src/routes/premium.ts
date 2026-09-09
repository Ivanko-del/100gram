import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

export const PREMIUM_PLANS = [
  { id: "1m", label: "1 місяць", days: 30, price: 100 },
  { id: "6m", label: "6 місяців", days: 180, price: 500 },
  { id: "12m", label: "12 місяців", days: 365, price: 900 },
] as const;

router.get("/plans", (_req, res) => {
  res.json(PREMIUM_PLANS);
});

router.post("/subscribe", async (req: AuthRequest, res) => {
  const planId = String(req.body?.planId ?? "");
  const plan = PREMIUM_PLANS.find((p) => p.id === planId);
  if (!plan) return res.status(400).json({ error: "Невірний план" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.grams < plan.price) return res.status(400).json({ error: "Недостатньо ГРАМів для підписки" });

  const now = new Date();
  const base = user.premiumUntil && user.premiumUntil > now ? user.premiumUntil : now;
  const premiumUntil = new Date(base.getTime() + plan.days * 24 * 60 * 60 * 1000);

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { grams: { decrement: plan.price }, isPremium: true, premiumUntil },
    }),
    prisma.transaction.create({
      data: {
        toUserId: user.id,
        amount: -plan.price,
        type: "premium_purchase",
        note: `Преміум: ${plan.label}`,
      },
    }),
  ]);

  res.json({ isPremium: updated.isPremium, premiumUntil: updated.premiumUntil, grams: updated.grams });
});

export default router;
