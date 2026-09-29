import { useEffect, useRef, useState } from "react";
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

type ChatFilter = "all" | "dm" | "group" | "channel";

const FILTERS: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "Усі чати" },
  { id: "dm", label: "Приватні" },
  { id: "group", label: "Групи" },
  { id: "channel", label: "Канали" },
];

function chatKind(c: ChatSummary): ChatFilter {
  return c.isChannel ? "channel" : c.isGroup ? "group" : "dm";
}

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const SearchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<ChatFilter>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("stogram_theme") ?? "dark");

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("stogram_theme", next);
    document.documentElement.dataset.theme = next;
  }

  function goSettings(tab?: string) {
    setDrawerOpen(false);
    navigate("/settings", { state: tab ? { tab } : undefined });
  }

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

  const counts: Record<ChatFilter, number> = {
    all: chats.length,
    dm: chats.filter((c) => chatKind(c) === "dm").length,
    group: chats.filter((c) => chatKind(c) === "group").length,
    channel: chats.filter((c) => chatKind(c) === "channel").length,
  };
  const filteredChats = chats.filter(
    (c) => (filter === "all" || chatKind(c) === filter) && c.name.toLowerCase().includes(query.trim().toLowerCase())
  );

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
        {searchOpen ? (
          <>
            <input
              ref={searchRef}
              className="sidebar-search"
              placeholder="Пошук чатів або @username"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="header-icon-btn" onClick={closeSearch} aria-label="Закрити пошук">
              <CloseIcon />
            </button>
          </>
        ) : (
          <>
            <button className="header-icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Меню">
              <MenuIcon />
            </button>
            <h1 className="sidebar-title">{user?.displayName ?? "100 ГРАМ"}</h1>
            <button className="header-icon-btn" onClick={() => setSearchOpen(true)} aria-label="Пошук">
              <SearchIcon />
            </button>
          </>
        )}
      </div>

      <div className="chat-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={`chat-filter ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {counts[f.id] > 0 && <span className="chat-filter-count">{counts[f.id]}</span>}
          </button>
        ))}
      </div>

      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-top">
              <Avatar
                name={user?.displayName ?? "?"}
                color={user?.avatarColor ?? "#999"}
                photoUrl={user?.avatarUrl}
                size={72}
                isPremium={user?.isPremium}
              />
              <button className="header-icon-btn drawer-theme-btn" onClick={toggleTheme} aria-label="Змінити тему">
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
            <div className="drawer-name">{user?.displayName}</div>
            <div className="drawer-username">@{user?.username}</div>

            <div className="drawer-menu">
              <button
                className="drawer-item"
                onClick={() => {
                  setDrawerOpen(false);
                  setShowNewChatModal(true);
                }}
              >
                <span className="drawer-item-icon">👥</span>Нова група або канал
              </button>
              <button className="drawer-item" onClick={() => goSettings("wallet")}>
                <span className="drawer-item-icon">🥃</span>Гаманець
                <span className="drawer-item-badge">{user?.grams ?? 0}</span>
              </button>
              <button className="drawer-item" onClick={() => goSettings("premium")}>
                <span className="drawer-item-icon">👑</span>Преміум
              </button>
              <button className="drawer-item" onClick={() => goSettings()}>
                <span className="drawer-item-icon">⚙️</span>Налаштування
              </button>
              <button className="drawer-item drawer-item-danger" onClick={logout}>
                <span className="drawer-item-icon">🚪</span>Вийти
              </button>
            </div>
          </nav>
        </div>
      )}

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
              <Avatar name={u.displayName} color={u.avatarColor} photoUrl={u.avatarUrl} isPremium={u.isPremium} />
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
            <Avatar name={chat.name} color={chat.avatarColor} photoUrl={chat.avatarUrl} size={54} />
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

      <button
        className="fab-new-chat"
        onClick={() => setShowNewChatModal(true)}
        title="Нова група або канал"
        aria-label="Нова група або канал"
      >
        ＋
      </button>

    </aside>
  );
}
