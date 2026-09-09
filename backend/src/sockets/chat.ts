import { Server, Socket } from "socket.io";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../db";

interface AuthedSocket extends Socket {
  userId?: string;
  username?: string;
}

const onlineUsers = new Map<string, number>(); // userId -> connection count

export function registerChatSockets(io: Server) {
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("No token"));
    try {
      const payload = verifyToken(token);
      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket: AuthedSocket) => {
    const userId = socket.userId!;
    onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
    io.emit("presence:update", { userId, online: true });

    const memberships = await prisma.chatMember.findMany({ where: { userId } });
    memberships.forEach((m) => socket.join(`chat:${m.chatId}`));

    socket.on("chat:join", async (chatId: string) => {
      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (membership) socket.join(`chat:${chatId}`);
    });

    socket.on("message:send", async (data: { chatId: string; content: string }, ack?: (res: unknown) => void) => {
      const content = (data?.content ?? "").trim();
      if (!content || content.length > 4000 || !data?.chatId) {
        return ack?.({ error: "Порожнє повідомлення" });
      }
      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: data.chatId, userId } },
      });
      if (!membership) return ack?.({ error: "Немає доступу до чату" });

      const message = await prisma.message.create({
        data: { chatId: data.chatId, senderId: userId, content },
        include: { sender: true },
      });

      const payload = {
        id: message.id,
        chatId: message.chatId,
        content: message.content,
        type: message.type,
        createdAt: message.createdAt,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          displayName: message.sender.displayName,
          avatarColor: message.sender.avatarColor,
        },
      };
      io.to(`chat:${data.chatId}`).emit("message:new", payload);
      ack?.({ message: payload });
    });

    socket.on("typing", (data: { chatId: string; isTyping: boolean }) => {
      if (!data?.chatId) return;
      socket.to(`chat:${data.chatId}`).emit("typing", {
        chatId: data.chatId,
        userId,
        username: socket.username,
        isTyping: !!data.isTyping,
      });
    });

    socket.on("disconnect", async () => {
      const count = (onlineUsers.get(userId) ?? 1) - 1;
      if (count <= 0) {
        onlineUsers.delete(userId);
        await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});
        io.emit("presence:update", { userId, online: false });
      } else {
        onlineUsers.set(userId, count);
      }
    });
  });
}
