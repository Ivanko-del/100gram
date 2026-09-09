import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(username: string, displayName: string, avatarColor: string) {
  const passwordHash = await bcrypt.hash("password123", 10);
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      email: `${username}@100gram.chat`,
      passwordHash,
      displayName,
      avatarColor,
      bio: "Демо-акаунт 100 ГРАМ 🥃",
      grams: 1000,
    },
  });
}

async function main() {
  const anton = await upsertUser("anton", "Антон Коваль", "#6ab2f2");
  const olha = await upsertUser("olha", "Ольга Сидоренко", "#e17076");
  const bot = await upsertUser("stogram_bot", "100 ГРАМ Bot", "#8774e1");

  const existingChat = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      AND: [{ members: { some: { userId: anton.id } } }, { members: { some: { userId: olha.id } } }],
    },
  });

  const chat =
    existingChat ??
    (await prisma.chat.create({
      data: {
        isGroup: false,
        members: { create: [{ userId: anton.id }, { userId: olha.id }] },
      },
    }));

  const messageCount = await prisma.message.count({ where: { chatId: chat.id } });
  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        { chatId: chat.id, senderId: anton.id, content: "Привіт! Як тобі новий чат 100 ГРАМ? 🥃" },
        { chatId: chat.id, senderId: olha.id, content: "Дуже круто! Навіть є своя валюта 😄" },
        { chatId: chat.id, senderId: anton.id, content: "Так, можу тобі закинути пару ГРАМів на каву" },
      ],
    });
  }

  console.log("Seed complete:", { anton: anton.username, olha: olha.username, bot: bot.username });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
