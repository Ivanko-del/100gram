import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { subscribeChats } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import { ChatSummary } from "../types";

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeChats(user.id, (data) => {
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
    <div className="app-layout">
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
