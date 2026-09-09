import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

function publicUser(u: {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  isPremium: boolean;
  lastSeenAt: Date;
}) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarColor: u.avatarColor,
    isPremium: u.isPremium,
    lastSeenAt: u.lastSeenAt,
  };
}

router.get("/me", async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarColor: user.avatarColor,
    isPremium: user.isPremium,
    premiumUntil: user.premiumUntil,
    grams: user.grams,
  });
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(48).optional(),
  bio: z.string().max(160).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

router.patch("/me", async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Некоректні дані" });
  const user = await prisma.user.update({ where: { id: req.userId }, data: parsed.data });
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarColor: user.avatarColor,
    isPremium: user.isPremium,
    grams: user.grams,
  });
});

router.get("/search", async (req: AuthRequest, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json([]);
  const users = await prisma.user.findMany({
    where: {
      username: { contains: q },
      NOT: { id: req.userId },
    },
    take: 20,
  });
  res.json(users.map(publicUser));
});

export default router;
