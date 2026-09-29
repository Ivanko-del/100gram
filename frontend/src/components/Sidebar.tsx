import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DataError,
  ensureSavedChat,
  hideChatForMe,
  searchUsers,
  setChatArchived,
  setChatPinned,
  startDirectChat,
} from "../data/firestore-api";
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

const ARCHIVE_ROW_HEIGHT = 68;

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
  const [showArchive, setShowArchive] = useState(false);
  const [menuChat, setMenuChat] = useState<ChatSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChatSummary | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
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

  const pinned = user?.pinnedChats ?? [];
  const archived = user?.archivedChats ?? [];
  const hidden = user?.hiddenChats ?? {};

  // "Deleted for me" chats stay gone until someone writes in them again
  const notHidden = chats.filter((c) => {
    const at = hidden[c.id];
    return !at || new Date(c.updatedAt).getTime() > new Date(at).getTime();
  });
  const archivedChats = notHidden.filter((c) => archived.includes(c.id));
  const activeChats = notHidden.filter((c) => !archived.includes(c.id));

  const counts: Record<ChatFilter, number> = {
    all: activeChats.length,
    dm: activeChats.filter((c) => chatKind(c) === "dm").length,
    group: activeChats.filter((c) => chatKind(c) === "group").length,
    channel: activeChats.filter((c) => chatKind(c) === "channel").length,
  };
  const searchText = query.trim().toLowerCase();
  const pool = showArchive ? archivedChats : activeChats;
  const filteredChats = pool
    .filter((c) => (showArchive || filter === "all" || chatKind(c) === filter) && c.name.toLowerCase().includes(searchText))
    .sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)));

  // Like Telegram: the archive row sits just above the list and is scrolled
  // out of sight, so pulling the list down reveals it.
  const archiveRowVisible = !showArchive && archivedChats.length > 0 && !searchText;
  useEffect(() => {
    if (archiveRowVisible && listRef.current) listRef.current.scrollTop = ARCHIVE_ROW_HEIGHT;
  }, [archiveRowVisible, showArchive, filter]);

  function pressStart(chat: ChatSummary) {
    longPressed.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setMenuChat(chat);
    }, 450);
  }

  function pressEnd() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  function openChat(chat: ChatSummary) {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    navigate(`/chat/${chat.id}`);
  }

  async function openSaved() {
    if (!user) return;
    setDrawerOpen(false);
    try {
      navigate(`/chat/${await ensureSavedChat(user)}`);
    } catch {
      setErrorMsg("Не вдалося відкрити «Збережене»");
    }
  }

  async function runChatAction(action: () => Promise<void>, leaveChatId?: string) {
    setMenuChat(null);
    setConfirmDelete(null);
    try {
      await action();
      if (leaveChatId && leaveChatId === activeChatId) navigate("/");
    } catch {
      setErrorMsg("Не вдалося виконати дію");
    }
  }

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
        ) : showArchive ? (
          <>
            <button className="header-icon-btn" onClick={() => setShowArchive(false)} aria-label="Назад">
              ←
            </button>
            <h1 className="sidebar-title">Архів чатів</h1>
            <span className="header-icon-spacer" />
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

      {!showArchive && (
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
      )}

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
              <button className="drawer-item" onClick={openSaved}>
                <span className="drawer-item-icon">🔖</span>Збережене
              </button>
              <button
                className="drawer-item"
                onClick={() => {
                  setDrawerOpen(false);
                  setShowArchive(true);
                }}
              >
                <span className="drawer-item-icon">🗄️</span>Архів чатів
                {archivedChats.length > 0 && <span className="drawer-item-badge">{archivedChats.length}</span>}
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

      <div className="chat-list" ref={listRef}>
        <div className="chat-list-inner">
          {archiveRowVisible && (
            <button className="chat-list-item archive-row" onClick={() => setShowArchive(true)}>
              <span className="archive-row-icon">🗄️</span>
              <span className="archive-row-label">Архів чатів</span>
              <span className="archive-row-count">{archivedChats.length}</span>
            </button>
          )}
          {filteredChats.length === 0 && (
            <div className="empty-hint">
              {showArchive ? "Архів порожній" : "Немає чатів. Знайдіть друга через пошук ☝️"}
            </div>
          )}
          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-list-item ${chat.id === activeChatId ? "active" : ""}`}
              onClick={() => openChat(chat)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuChat(chat);
              }}
              onTouchStart={() => pressStart(chat)}
              onTouchEnd={pressEnd}
              onTouchMove={pressEnd}
              onTouchCancel={pressEnd}
            >
              <Avatar
                name={chat.name}
                color={chat.avatarColor}
                photoUrl={chat.avatarUrl}
                size={54}
                icon={chat.isSaved ? "🔖" : undefined}
              />
              <div className="chat-list-item-body">
                <div className="chat-list-item-top">
                  <span className="chat-name">
                    {chat.isChannel ? "📢 " : chat.isGroup ? "👥 " : ""}
                    {chat.name}
                  </span>
                  <span className="chat-time">
                    {pinned.includes(chat.id) && <span className="chat-pin" aria-label="Закріплено">📌</span>}
                    {chat.lastMessage && formatTime(chat.lastMessage.createdAt)}
                  </span>
                </div>
                <div className="chat-list-item-bottom">{chat.lastMessage?.content ?? "Немає повідомлень"}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {menuChat && user && (
        <div className="modal-overlay" onClick={() => setMenuChat(null)}>
          <div className="modal-card chat-actions" onClick={(e) => e.stopPropagation()}>
            <div className="chat-actions-title">{menuChat.name}</div>
            {!archived.includes(menuChat.id) && (
              <button
                className="drawer-item"
                onClick={() => runChatAction(() => setChatPinned(user.id, menuChat.id, !pinned.includes(menuChat.id)))}
              >
                <span className="drawer-item-icon">📌</span>
                {pinned.includes(menuChat.id) ? "Відкріпити" : "Закріпити"}
              </button>
            )}
            <button
              className="drawer-item"
              onClick={() =>
                runChatAction(
                  () => setChatArchived(user.id, menuChat.id, !archived.includes(menuChat.id)),
                  archived.includes(menuChat.id) ? undefined : menuChat.id
                )
              }
            >
              <span className="drawer-item-icon">🗄️</span>
              {archived.includes(menuChat.id) ? "Повернути з архіву" : "В архів"}
            </button>
            <button
              className="drawer-item drawer-item-danger"
              onClick={() => {
                setConfirmDelete(menuChat);
                setMenuChat(null);
              }}
            >
              <span className="drawer-item-icon">🗑️</span>Видалити чат
            </button>
          </div>
        </div>
      )}

      {confirmDelete && user && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-card chat-actions" onClick={(e) => e.stopPropagation()}>
            <div className="chat-actions-title">Видалити «{confirmDelete.name}»?</div>
            <p className="settings-hint">
              Чат зникне лише в тебе. В інших учасників він залишиться, а тобі повернеться, коли там з'явиться нове
              повідомлення.
            </p>
            <div className="chat-actions-buttons">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
                Скасувати
              </button>
              <button
                className="btn-primary btn-danger"
                onClick={() => runChatAction(() => hideChatForMe(user.id, confirmDelete.id), confirmDelete.id)}
              >
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}

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
