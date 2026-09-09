import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { signToken } from "../utils/jwt";

const router = Router();

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Тільки латиниця, цифри та підкреслення"),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  displayName: z.string().min(1).max(48),
});

const WELCOME_BONUS = 500;

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  }
  const { username, email, password, displayName } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    return res.status(409).json({
      error: existing.username === username ? "Це ім'я користувача вже зайняте" : "Ця пошта вже зареєстрована",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      displayName,
      grams: WELCOME_BONUS,
    },
  });

  await prisma.transaction.create({
    data: {
      toUserId: user.id,
      amount: WELCOME_BONUS,
      type: "welcome_bonus",
      note: "Вітальний бонус 100 ГРАМ",
    },
  });

  const token = signToken({ userId: user.id, username: user.username });
  return res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      bio: user.bio,
      avatarColor: user.avatarColor,
      isPremium: user.isPremium,
      grams: user.grams,
    },
  });
});

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Введіть логін та пароль" });
  }
  const { usernameOrEmail, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }] },
  });
  if (!user) {
    return res.status(401).json({ error: "Невірний логін або пароль" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Невірний логін або пароль" });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

  const token = signToken({ userId: user.id, username: user.username });
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      bio: user.bio,
      avatarColor: user.avatarColor,
      isPremium: user.isPremium,
      grams: user.grams,
    },
  });
});

export default router;
