import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataError, searchUsers, startDirectChat } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { ChatSummary, PublicUser } from "../types";
import Avatar from "./Avatar";
import NewChatModal from "./NewChatModal";

interface SidebarProps {
  chats: ChatSummary[];
  activeChatId?: string;
  onChatCreated: (chatId: string) => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
}

export default function Sidebar({ chats, activeChatId, onChatCreated }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await searchUsers(q, user?.id ?? "");
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, user?.id]);

  const filteredChats = chats.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function startChat(username: string) {
    if (!user) return;
    setErrorMsg(null);
    try {
      const chatId = await startDirectChat(user, username);
      setQuery("");
      setResults([]);
      onChatCreated(chatId);
      navigate(`/chat/${chatId}`);
    } catch (e) {
      setErrorMsg(e instanceof DataError ? e.message : "Не вдалося створити чат");
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="icon-btn" onClick={() => navigate("/settings")} title="Налаштування">
          <Avatar name={user?.displayName ?? "?"} color={user?.avatarColor ?? "#999"} size={38} isPremium={user?.isPremium} />
        </button>
        <input
          className="sidebar-search"
          placeholder="Пошук чатів або @username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grams-pill" onClick={() => navigate("/settings")} title="Гаманець">
          🥃 {user?.grams ?? 0}
        </div>
        <button className="icon-btn new-chat-btn" onClick={() => setShowNewChatModal(true)} title="Нова група або канал" aria-label="Нова група або канал">
          ＋
        </button>
      </div>

      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onCreated={(chatId) => {
            setShowNewChatModal(false);
            onChatCreated(chatId);
            navigate(`/chat/${chatId}`);
          }}
        />
      )}

      {errorMsg && <div className="sidebar-error">{errorMsg}</div>}

      {query.trim().length >= 2 && (
        <div className="search-results">
          <div className="search-results-title">{searching ? "Пошук…" : "Користувачі"}</div>
          {results.length === 0 && !searching && <div className="empty-hint">Нікого не знайдено</div>}
          {results.map((u) => (
            <button className="chat-list-item" key={u.id} onClick={() => startChat(u.username)}>
              <Avatar name={u.displayName} color={u.avatarColor} isPremium={u.isPremium} />
              <div className="chat-list-item-body">
                <div className="chat-list-item-top">
                  <span className="chat-name">{u.displayName}</span>
                </div>
                <div className="chat-list-item-bottom">@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="chat-list">
        {filteredChats.length === 0 && (
          <div className="empty-hint">Немає чатів. Знайдіть друга через пошук ☝️</div>
        )}
        {filteredChats.map((chat) => (
          <button
            key={chat.id}
            className={`chat-list-item ${chat.id === activeChatId ? "active" : ""}`}
            onClick={() => navigate(`/chat/${chat.id}`)}
          >
            <Avatar name={chat.name} color={chat.avatarColor} />
            <div className="chat-list-item-body">
              <div className="chat-list-item-top">
                <span className="chat-name">
                  {chat.isChannel ? "📢 " : chat.isGroup ? "👥 " : ""}
                  {chat.name}
                </span>
                {chat.lastMessage && <span className="chat-time">{formatTime(chat.lastMessage.createdAt)}</span>}
              </div>
              <div className="chat-list-item-bottom">{chat.lastMessage?.content ?? "Немає повідомлень"}</div>
            </div>
          </button>
        ))}
      </div>

      <button className="logout-btn" onClick={logout}>
        Вийти
      </button>
    </aside>
  );
}
