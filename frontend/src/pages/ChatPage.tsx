import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import { ChatMessage, ChatSummary } from "../types";

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChats = useCallback(async () => {
    const data = await api.get<ChatSummary[]>("/chats");
    setChats(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!socket) return;
    function onNewMessage(msg: ChatMessage) {
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.chatId);
        if (idx === -1) {
          loadChats();
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMessage: { content: msg.content, createdAt: msg.createdAt, senderId: msg.sender.id },
          updatedAt: msg.createdAt,
        };
        return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    }
    socket.on("message:new", onNewMessage);
    return () => {
      socket.off("message:new", onNewMessage);
    };
  }, [socket, loadChats]);

  const activeChat = chats.find((c) => c.id === chatId);

  function handleChatCreated(id: string) {
    loadChats();
    navigate(`/chat/${id}`);
  }

  return (
    <div className="app-layout">
      <Sidebar chats={chats} activeChatId={chatId} onChatCreated={handleChatCreated} />
      {activeChat ? (
        <ChatWindow chat={activeChat} onMessageSent={() => {}} />
      ) : (
        <div className="chat-window-empty">
          {loading ? "Завантаження чатів…" : (
            <>
              <div className="empty-illustration">🥃</div>
              <h2>100 ГРАМ</h2>
              <p>Оберіть чат зліва або знайдіть друга через пошук</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
