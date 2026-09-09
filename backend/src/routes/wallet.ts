import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Not found" });

  const transactions = await prisma.transaction.findMany({
    where: { OR: [{ fromUserId: req.userId }, { toUserId: req.userId }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { fromUser: true, toUser: true },
  });

  res.json({
    grams: user.grams,
    transactions: transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      note: t.note,
      createdAt: t.createdAt,
      direction: t.toUserId === req.userId ? "in" : "out",
      counterparty:
        t.toUserId === req.userId
          ? t.fromUser
            ? { username: t.fromUser.username, displayName: t.fromUser.displayName }
            : { username: "system", displayName: "100 ГРАМ" }
          : { username: t.toUser.username, displayName: t.toUser.displayName },
    })),
  });
});

const transferSchema = z.object({
  username: z.string().min(1),
  amount: z.number().int().positive().max(1_000_000),
  note: z.string().max(120).optional(),
});

router.post("/transfer", async (req: AuthRequest, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Некоректні дані переказу" });
  const { username, amount, note } = parsed.data;

  const sender = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!sender) return res.status(404).json({ error: "Not found" });
  if (sender.username === username) return res.status(400).json({ error: "Не можна переказати собі" });
  if (sender.grams < amount) return res.status(400).json({ error: "Недостатньо ГРАМів" });

  const recipient = await prisma.user.findUnique({ where: { username } });
  if (!recipient) return res.status(404).json({ error: "Отримувача не знайдено" });

  const [, , tx] = await prisma.$transaction([
    prisma.user.update({ where: { id: sender.id }, data: { grams: { decrement: amount } } }),
    prisma.user.update({ where: { id: recipient.id }, data: { grams: { increment: amount } } }),
    prisma.transaction.create({
      data: { fromUserId: sender.id, toUserId: recipient.id, amount, type: "transfer", note },
    }),
  ]);

  res.status(201).json({ transactionId: tx.id, grams: sender.grams - amount });
});

export default router;
