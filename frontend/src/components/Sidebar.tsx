import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  Bell,
  BellOff,
  Bookmark,
  Crown,
  EyeOff,
  LifeBuoy,
  Lock,
  LogOut,
  Megaphone,
  Moon,
  Pin,
  Plus,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  Unlock,
  Users,
  Wallet,
} from "lucide-react";
import {
  DataError,
  ensureSavedChat,
  hideChatForMe,
  searchUsers,
  setChatArchived,
  setChatMutedForMe,
  setChatPinned,
  startDirectChat,
} from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { ChatSummary, PublicUser } from "../types";
import Avatar from "./Avatar";
import UserName from "./UserName";
import { useUnreadCounts } from "../hooks/useUnreadCounts";
import { usePublicChatSearch } from "../hooks/usePublicChatSearch";
import LockPrompt from "./LockPrompt";
import LockSetupModal from "./LockSetupModal";
import { setChatHidden, setChatLocked } from "../data/chat-lock";
import { useChatLock } from "../context/ChatLockContext";
import { folderTabId } from "../utils/folders";
import { FREE_PIN_LIMIT, PREMIUM_PIN_LIMIT, SITE_ADMIN_USERNAME, isSiteAdmin } from "../constants";
import NewChatModal from "./NewChatModal";

interface SidebarProps {
  chats: ChatSummary[];
  activeChatId?: string;
  onChatCreated: (chatId: string) => void;
}

/** "all" / "dm" / "group" / "channel", or `f:<id>` for one of the user's folders */
type ChatFilter = string;

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
  const { results: publicChats, searching: searchingChats } = usePublicChatSearch(query, user?.id);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [showArchive, setShowArchive] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const { lock, hasPassword, unlocked, isLocked } = useChatLock();
  const unreadCounts = useUnreadCounts(chats, user?.id);
  const [setupThen, setSetupThen] = useState<(() => void) | null>(null);
  const [unlockThen, setUnlockThen] = useState<(() => void) | null>(null);
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

  // an action that needed the chat password runs as soon as it is entered
  useEffect(() => {
    if (unlocked && unlockThen) {
      unlockThen();
      setUnlockThen(null);
    }
  }, [unlocked, unlockThen]);

  /** run `action` once the chat password exists (asking to create it first) */
  function withPassword(action: () => void) {
    if (hasPassword) action();
    else setSetupThen(() => action);
  }

  /** run `action` once the chat password has been entered */
  function withUnlock(action: () => void) {
    if (!hasPassword || unlocked) action();
    else setUnlockThen(() => action);
  }

  async function openSupport() {
    if (!user) return;
    setDrawerOpen(false);
    try {
      const chatId = await startDirectChat(user, SITE_ADMIN_USERNAME);
      navigate(`/chat/${chatId}`);
    } catch (e) {
      setErrorMsg(e instanceof DataError ? e.message : "Не вдалося відкрити підтримку");
    }
  }

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

  // people we already have a private chat with, for the "new chat" quick-pick
  const contacts: PublicUser[] = chats
    .filter((c) => !c.isGroup && !c.isSaved)
    .flatMap((c) => {
      const peer = c.members.find((m) => m.id !== user?.id);
      return peer
        ? [{ ...peer, displayName: c.name, avatarColor: c.avatarColor, avatarUrl: c.avatarUrl ?? null }]
        : [];
    });

  const pinned = user?.pinnedChats ?? [];
  const archived = user?.archivedChats ?? [];
  const hidden = user?.hiddenChats ?? {};

  // "Deleted for me" chats stay gone until someone writes in them again
  const notHidden = chats.filter((c) => {
    const at = hidden[c.id];
    return !at || new Date(c.updatedAt).getTime() > new Date(at).getTime();
  });
  const vaultChats = notHidden.filter((c) => lock.hidden.includes(c.id));
  const listed = notHidden.filter((c) => !lock.hidden.includes(c.id));
  const archivedChats = listed.filter((c) => archived.includes(c.id));
  const activeChats = listed.filter((c) => !archived.includes(c.id));

  // the user's own folders sit after the built-in tabs
  const folders = user?.chatFolders ?? [];
  const tabs = [...FILTERS, ...folders.map((f) => ({ id: folderTabId(f.id), label: f.name }))];
  const folderOf = (tab: ChatFilter) => folders.find((f) => folderTabId(f.id) === tab);
  const inFilter = (c: ChatSummary, tab: ChatFilter) => {
    if (tab === "all") return true;
    const folder = folderOf(tab);
    return folder ? folder.chatIds.includes(c.id) : chatKind(c) === tab;
  };
  // a folder deleted elsewhere must not leave the list stuck on an empty tab
  const activeFilter = tabs.some((t) => t.id === filter) ? filter : "all";
  const counts: Record<ChatFilter, number> = Object.fromEntries(
    tabs.map((t) => [t.id, activeChats.filter((c) => inFilter(c, t.id)).length])
  );
  const searchText = query.trim().toLowerCase();
  const pool = showVault ? vaultChats : showArchive ? archivedChats : activeChats;
  const filteredChats = pool
    .filter((c) => (showArchive || showVault || inFilter(c, activeFilter)) && c.name.toLowerCase().includes(searchText))
    .sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)));

  // Like Telegram: the archive row sits just above the list and is scrolled
  // out of sight, so pulling the list down reveals it.
  const archiveRowVisible = !showArchive && !showVault && archivedChats.length > 0 && !searchText;
  useEffect(() => {
    if (archiveRowVisible && listRef.current) listRef.current.scrollTop = ARCHIVE_ROW_HEIGHT;
  }, [archiveRowVisible, showArchive, showVault, activeFilter]);

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
        ) : showArchive || showVault ? (
          <>
            <button
              className="header-icon-btn"
              onClick={() => {
                setShowArchive(false);
                setShowVault(false);
              }}
              aria-label="Назад"
            >
              <ArrowLeft size={22} />
            </button>
            <h1 className="sidebar-title">{showVault ? "Приховані чати" : "Архів чатів"}</h1>
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

      {!showArchive && !showVault && (
      <div className="chat-filters" role="tablist">
        {tabs.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={activeFilter === f.id}
            className={`chat-filter ${activeFilter === f.id ? "active" : ""}`}
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
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            <div className="drawer-name">
              <UserName name={user?.displayName ?? ""} emoji={user?.isPremium ? user.emojiStatus : null} color={user?.isPremium ? user.nameColor : null} />
            </div>
            <div className="drawer-username">@{user?.username}</div>

            <div className="drawer-menu">
              <button
                className="drawer-item"
                onClick={() => {
                  setDrawerOpen(false);
                  setShowNewChatModal(true);
                }}
              >
                <span className="drawer-item-icon"><Users size={20} /></span>Нова група або канал
              </button>
              <button className="drawer-item" onClick={openSaved}>
                <span className="drawer-item-icon"><Bookmark size={20} /></span>Збережене
              </button>
              <button
                className="drawer-item"
                onClick={() => {
                  setDrawerOpen(false);
                  setShowArchive(true);
                }}
              >
                <span className="drawer-item-icon"><Archive size={20} /></span>Архів чатів
                {archivedChats.length > 0 && <span className="drawer-item-badge">{archivedChats.length}</span>}
              </button>
              <button
                className="drawer-item"
                onClick={() => {
                  setDrawerOpen(false);
                  setShowVault(true);
                }}
              >
                <span className="drawer-item-icon"><EyeOff size={20} /></span>Приховані чати
                {lock.hidden.length > 0 && <span className="drawer-item-badge">{lock.hidden.length}</span>}
              </button>
              {!isSiteAdmin(user?.username) && (
                <button className="drawer-item" onClick={openSupport}>
                  <span className="drawer-item-icon"><LifeBuoy size={20} /></span>Підтримка
                </button>
              )}
              <button className="drawer-item" onClick={() => goSettings("wallet")}>
                <span className="drawer-item-icon"><Wallet size={20} /></span>Гаманець
                <span className="drawer-item-badge">{user?.grams ?? 0}</span>
              </button>
              <button className="drawer-item" onClick={() => goSettings("premium")}>
                <span className="drawer-item-icon"><Crown size={20} /></span>Преміум
              </button>
              <button className="drawer-item" onClick={() => goSettings()}>
                <span className="drawer-item-icon"><SettingsIcon size={20} /></span>Налаштування
              </button>
              <button className="drawer-item drawer-item-danger" onClick={logout}>
                <span className="drawer-item-icon"><LogOut size={20} /></span>Вийти
              </button>
            </div>
          </nav>
        </div>
      )}

      {showNewChatModal && (
        <NewChatModal
          contacts={contacts}
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
          {(searchingChats || publicChats.length > 0) && (
            <div className="search-results-title">{searchingChats ? "Шукаємо групи й канали…" : "Публічні групи та канали"}</div>
          )}
          {publicChats.map((c) => (
            <button className="chat-list-item" key={c.id} onClick={() => navigate(`/join/${c.id}`)}>
              <Avatar name={c.name} color={c.avatarColor} photoUrl={c.avatarUrl} />
              <div className="chat-list-item-body">
                <div className="chat-list-item-top">
                  <span className="chat-name">{c.name}</span>
                </div>
                <div className="chat-list-item-bottom">
                  {c.isChannel ? "Канал" : "Група"} · {c.members.length} {c.isChannel ? "підписників" : "учасників"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="chat-list" ref={listRef}>
        <div className="chat-list-inner">
          {archiveRowVisible && (
            <button className="chat-list-item archive-row" onClick={() => setShowArchive(true)}>
              <span className="archive-row-icon"><Archive size={22} /></span>
              <span className="archive-row-label">Архів чатів</span>
              <span className="archive-row-count">{archivedChats.length}</span>
            </button>
          )}
          {showVault && hasPassword && !unlocked && (
            <LockPrompt
              title="Приховані чати"
              onCancel={() => setShowVault(false)}
            />
          )}
          {!(showVault && hasPassword && !unlocked) && filteredChats.length === 0 && (
            <div className="empty-hint">
              {showVault
                ? "Немає прихованих чатів. Утримуй чат у списку → «Приховати»."
                : showArchive
                  ? "Архів порожній"
                  : "Немає чатів. Знайдіть друга через пошук ☝️"}
            </div>
          )}
          {!(showVault && hasPassword && !unlocked) && filteredChats.map((chat) => (
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
                    {isLocked(chat.id) && <Lock size={13} className="inline-icon" />}
                    {(user?.mutedChats ?? []).includes(chat.id) && <BellOff size={13} className="inline-icon" />}
                    {chat.isChannel ? <Megaphone size={13} className="inline-icon" /> : chat.isGroup ? <Users size={13} className="inline-icon" /> : null}
                    <UserName name={chat.name} emoji={chat.emojiStatus} color={chat.nameColor} />
                  </span>
                  <span className="chat-time">
                    {pinned.includes(chat.id) && <Pin size={12} className="chat-pin" aria-label="Закріплено" />}
                    {chat.lastMessage && formatTime(chat.lastMessage.createdAt)}
                  </span>
                </div>
                <div className="chat-list-item-row">
                  <div className="chat-list-item-bottom">
                    {isLocked(chat.id) && !unlocked ? (
                      <>
                        <Lock size={13} className="inline-icon" /> Чат заблоковано
                      </>
                    ) : (
                      chat.lastMessage?.content ?? "Немає повідомлень"
                    )}
                  </div>
                  {unreadCounts[chat.id] > 0 && chat.id !== activeChatId && (
                    <span className={`unread-badge ${(user?.mutedChats ?? []).includes(chat.id) ? "muted" : ""}`}>
                      {unreadCounts[chat.id] > 99 ? "99+" : unreadCounts[chat.id]}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {setupThen && (
        <LockSetupModal
          onClose={() => setSetupThen(null)}
          onDone={() => {
            const next = setupThen;
            setSetupThen(null);
            next();
          }}
        />
      )}

      {unlockThen && !unlocked && (
        <div className="modal-overlay" onClick={() => setUnlockThen(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <LockPrompt onCancel={() => setUnlockThen(null)} />
          </div>
        </div>
      )}

      {menuChat && user && (
        <div className="modal-overlay" onClick={() => setMenuChat(null)}>
          <div className="modal-card chat-actions" onClick={(e) => e.stopPropagation()}>
            <div className="chat-actions-title">{menuChat.name}</div>
            {!archived.includes(menuChat.id) && (
              <button
                className="drawer-item"
                onClick={() => {
                  const limit = user.isPremium ? PREMIUM_PIN_LIMIT : FREE_PIN_LIMIT;
                  if (!pinned.includes(menuChat.id) && pinned.length >= limit) {
                    setMenuChat(null);
                    setErrorMsg(
                      user.isPremium
                        ? `Можна закріпити не більше ${limit} чатів`
                        : `Можна закріпити не більше ${limit} чатів. З преміумом — до ${PREMIUM_PIN_LIMIT} ⭐`
                    );
                    return;
                  }
                  runChatAction(() => setChatPinned(user.id, menuChat.id, !pinned.includes(menuChat.id)));
                }}
              >
                <span className="drawer-item-icon"><Pin size={20} /></span>
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
              <span className="drawer-item-icon"><Archive size={20} /></span>
              {archived.includes(menuChat.id) ? "Повернути з архіву" : "В архів"}
            </button>
            <button
              className="drawer-item"
              onClick={() => runChatAction(() => setChatMutedForMe(user.id, menuChat.id, !(user.mutedChats ?? []).includes(menuChat.id)))}
            >
              <span className="drawer-item-icon">{(user.mutedChats ?? []).includes(menuChat.id) ? <Bell size={20} /> : <BellOff size={20} />}</span>
              {(user.mutedChats ?? []).includes(menuChat.id) ? "Увімкнути сповіщення" : "Вимкнути сповіщення"}
            </button>
            <button
              className="drawer-item"
              onClick={() => {
                const c = menuChat;
                if (isLocked(c.id)) withUnlock(() => runChatAction(() => setChatLocked(user.id, c.id, false)));
                else withPassword(() => runChatAction(() => setChatLocked(user.id, c.id, true)));
                setMenuChat(null);
              }}
            >
              <span className="drawer-item-icon">{isLocked(menuChat.id) ? <Unlock size={20} /> : <Lock size={20} />}</span>
              {isLocked(menuChat.id) ? "Зняти блокування" : "Заблокувати паролем"}
            </button>
            <button
              className="drawer-item"
              onClick={() => {
                const c = menuChat;
                if (lock.hidden.includes(c.id)) {
                  withUnlock(() => runChatAction(() => setChatHidden(user.id, c.id, false)));
                } else {
                  withPassword(() => runChatAction(() => setChatHidden(user.id, c.id, true), c.id));
                }
                setMenuChat(null);
              }}
            >
              <span className="drawer-item-icon"><EyeOff size={20} /></span>
              {lock.hidden.includes(menuChat.id) ? "Показати в списку" : "Приховати"}
            </button>
            <button
              className="drawer-item drawer-item-danger"
              onClick={() => {
                setConfirmDelete(menuChat);
                setMenuChat(null);
              }}
            >
              <span className="drawer-item-icon"><Trash2 size={20} /></span>Видалити чат
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
        <Plus size={26} />
      </button>

    </aside>
  );
}
