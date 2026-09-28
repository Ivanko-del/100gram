import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { subscribeChats } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { playNotificationSound } from "../utils/sound";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import { ChatSummary } from "../types";

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSeenRef = useRef<Map<string, string> | null>(null);
  const openChatIdRef = useRef(chatId);
  openChatIdRef.current = chatId;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    lastSeenRef.current = null;
    const unsub = subscribeChats(user.id, (data) => {
      const previous = lastSeenRef.current;
      if (previous) {
        for (const chat of data) {
          const last = chat.lastMessage;
          if (!last || last.senderId === user.id) continue;
          if (chat.id === openChatIdRef.current) continue;
          const seenAt = previous.get(chat.id);
          if (seenAt !== last.createdAt) playNotificationSound();
        }
      }
      lastSeenRef.current = new Map(data.map((c) => [c.id, c.lastMessage?.createdAt ?? ""]));
      setChats(data);
      setLoading(false);
    });
    return unsub;
  }, [user?.id]);

  const activeChat = chats.find((c) => c.id === chatId);

  function handleChatCreated(id: string) {
    navigate(`/chat/${id}`);
  }

  return (
    <div className={`app-layout ${chatId ? "mobile-show-detail" : ""}`}>
      <Sidebar chats={chats} activeChatId={chatId} onChatCreated={handleChatCreated} />
      {activeChat ? (
        <ChatWindow chat={activeChat} />
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
