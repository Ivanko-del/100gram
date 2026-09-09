import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import chatRoutes from "./routes/chats";
import walletRoutes from "./routes/wallet";
import premiumRoutes from "./routes/premium";
import { registerChatSockets } from "./sockets/chat";

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "100 ГРАМ API" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/premium", premiumRoutes);

registerChatSockets(io);

const PORT = Number(process.env.PORT) || 4000;
httpServer.listen(PORT, () => {
  console.log(`🥃 100 ГРАМ API listening on http://localhost:${PORT}`);
});
