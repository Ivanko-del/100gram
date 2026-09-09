import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// List chats for current user with last message + other members
router.get("/", async (req: AuthRequest, res) => {
  const memberships = await prisma.chatMember.findMany({
    where: { userId: req.userId },
    include: {
      chat: {
        include: {
          members: { include: { user: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const chats = memberships
    .map((m) => {
      const chat = m.chat;
      const lastMessage = chat.messages[0] ?? null;
      const otherMembers = chat.members.filter((cm) => cm.userId !== req.userId).map((cm) => cm.user);
      return {
        id: chat.id,
        isGroup: chat.isGroup,
        name: chat.isGroup ? chat.name : otherMembers[0]?.displayName ?? "Видалений користувач",
        avatarColor: chat.isGroup ? "#8774e1" : otherMembers[0]?.avatarColor ?? "#999",
        members: chat.members.map((cm) => ({
          id: cm.user.id,
          username: cm.user.username,
          displayName: cm.user.displayName,
          avatarColor: cm.user.avatarColor,
          isPremium: cm.user.isPremium,
        })),
        lastMessage: lastMessage
          ? { content: lastMessage.content, createdAt: lastMessage.createdAt, senderId: lastMessage.senderId }
          : null,
        updatedAt: lastMessage?.createdAt ?? chat.createdAt,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json(chats);
});

const createChatSchema = z.object({
  username: z.string().min(1),
});

// Start (or get existing) direct chat with a user by username
router.post("/direct", async (req: AuthRequest, res) => {
  const parsed = createChatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Вкажіть username" });

  const target = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!target) return res.status(404).json({ error: "Користувача не знайдено" });
  if (target.id === req.userId) return res.status(400).json({ error: "Не можна писати самому собі" });

  const existing = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      AND: [
        { members: { some: { userId: req.userId } } },
        { members: { some: { userId: target.id } } },
      ],
    },
  });
  if (existing) return res.json({ id: existing.id });

  const chat = await prisma.chat.create({
    data: {
      isGroup: false,
      members: {
        create: [{ userId: req.userId! }, { userId: target.id }],
      },
    },
  });
  res.status(201).json({ id: chat.id });
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(64),
  usernames: z.array(z.string()).min(1),
});

router.post("/group", async (req: AuthRequest, res) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Некоректні дані групи" });

  const members = await prisma.user.findMany({ where: { username: { in: parsed.data.usernames } } });
  const memberIds = new Set(members.map((m) => m.id));
  memberIds.add(req.userId!);

  const chat = await prisma.chat.create({
    data: {
      isGroup: true,
      name: parsed.data.name,
      members: {
        create: Array.from(memberIds).map((userId, idx) => ({
          userId,
          role: userId === req.userId ? "owner" : "member",
        })),
      },
    },
  });
  res.status(201).json({ id: chat.id });
});

router.get("/:chatId/messages", async (req: AuthRequest, res) => {
  const { chatId } = req.params;
  const membership = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId: req.userId! } },
  });
  if (!membership) return res.status(403).json({ error: "Ви не учасник цього чату" });

  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
    include: { sender: true },
    take: 200,
  });

  res.json(
    messages.map((m) => ({
      id: m.id,
      chatId: m.chatId,
      content: m.content,
      type: m.type,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      sender: {
        id: m.sender.id,
        username: m.sender.username,
        displayName: m.sender.displayName,
        avatarColor: m.sender.avatarColor,
      },
    }))
  );
});

export default router;
