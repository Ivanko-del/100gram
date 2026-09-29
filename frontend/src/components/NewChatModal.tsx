import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { DataError, createGroupChat, searchUserByPhone, searchUsers, startDirectChat } from "../data/firestore-api";
import { looksLikePhone, normalizePhone } from "../utils/phone";
import { useAuth } from "../context/AuthContext";
import { PublicUser } from "../types";
import Avatar from "./Avatar";

interface Props {
  /** People the user already chats with, shown as a quick-pick list */
  contacts?: PublicUser[];
  onClose: () => void;
  onCreated: (chatId: string) => void;
}

type Mode = "direct" | "group" | "channel";

export default function NewChatModal({ contacts = [], onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("direct");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const phone = looksLikePhone(q) ? normalizePhone(q) : null;
        const res = phone
          ? [await searchUserByPhone(phone, user?.id ?? "")].filter((u): u is PublicUser => !!u)
          : await searchUsers(q, user?.id ?? "");
        setResults(res.filter((u) => !selected.some((s) => s.id === u.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user?.id]);

  function addMember(u: PublicUser) {
    setSelected((prev) => [...prev, u]);
    setResults((prev) => prev.filter((r) => r.id !== u.id));
    setQuery("");
  }

  function removeMember(uid: string) {
    setSelected((prev) => prev.filter((s) => s.id !== uid));
  }

  // On mobile the on-screen keyboard's "Done"/Enter otherwise triggers an
  // implicit form submit before the user gets to tap a search result -
  // treat Enter as "add the top match" instead.
  function onQueryKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (results.length > 0) addMember(results[0]);
  }

  async function openDirect(u: PublicUser) {
    if (!user || opening) return;
    setError(null);
    setOpening(true);
    try {
      onCreated(await startDirectChat(user, u.username));
    } catch (err) {
      setError(err instanceof DataError ? err.message : "Не вдалося відкрити чат");
      setOpening(false);
    }
  }

  const q = query.trim().toLowerCase();
  const matchedContacts = contacts.filter(
    (c) => !q || c.displayName.toLowerCase().includes(q) || c.username.toLowerCase().includes(q.replace(/^@/, ""))
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || mode === "direct") return;
    setError(null);
    if (!name.trim()) {
      setError("Вкажи назву");
      return;
    }
    setCreating(true);
    try {
      const chatId = await createGroupChat(
        user,
        name,
        selected.map((s) => s.username),
        mode === "channel"
      );
      onCreated(chatId);
    } catch (err) {
      setError(err instanceof DataError ? err.message : "Не вдалося створити");
    } finally {
      setCreating(false);
    }
  }

  function ContactRow({ u, onPick }: { u: PublicUser; onPick: (u: PublicUser) => void }) {
    return (
      <button type="button" className="newchat-row" onClick={() => onPick(u)} disabled={opening}>
        <Avatar name={u.displayName} color={u.avatarColor} photoUrl={u.avatarUrl} isPremium={u.isPremium} size={48} />
        <div className="newchat-row-body">
          <div className="newchat-row-name">{u.displayName}</div>
          <div className="newchat-row-sub">@{u.username}</div>
        </div>
      </button>
    );
  }

  return (
    <div className="newchat-screen">
      <header className="newchat-header">
        <button
          type="button"
          className="header-icon-btn"
          onClick={() => (mode === "direct" ? onClose() : setMode("direct"))}
          aria-label="Назад"
        >
          ←
        </button>
        <h2>{mode === "direct" ? "Нове повідомлення" : mode === "channel" ? "Новий канал" : "Нова група"}</h2>
      </header>

      {mode === "direct" ? (
        <div className="newchat-body">
          <div className="newchat-search">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук контактів"
              autoFocus
            />
          </div>

          <div className="newchat-card">
            <button type="button" className="newchat-row" onClick={() => setMode("group")}>
              <span className="newchat-icon" style={{ background: "#2f8fe6" }}>👥</span>
              <span className="newchat-row-name">Нова група</span>
            </button>
            <button type="button" className="newchat-row" onClick={() => setMode("channel")}>
              <span className="newchat-icon" style={{ background: "#2fb457" }}>📢</span>
              <span className="newchat-row-name">Новий канал</span>
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {q.length >= 2 && (
            <>
              <div className="newchat-section-title">{searching ? "Пошук…" : "Знайдено за @username або номером"}</div>
              <div className="newchat-card">
                {!searching && results.length === 0 && <div className="empty-hint">Нікого не знайдено</div>}
                {results.map((u) => (
                  <ContactRow key={u.id} u={u} onPick={openDirect} />
                ))}
              </div>
            </>
          )}

          <div className="newchat-section-title">Контакти</div>
          <div className="newchat-card">
            {matchedContacts.length === 0 && (
              <div className="empty-hint">
                {contacts.length === 0
                  ? "Поки немає контактів. Введи @username або номер телефону, щоб знайти людину."
                  : "Серед контактів немає збігів"}
              </div>
            )}
            {matchedContacts.map((c) => (
              <ContactRow key={c.id} u={c} onPick={openDirect} />
            ))}
          </div>
        </div>
      ) : (
        <form className="newchat-body newchat-form" onSubmit={onSubmit}>
          <p className="settings-hint">
            {mode === "channel"
              ? "У каналі писати можеш лише ти (і майбутні адміни) — інші тільки читають."
              : "У групі писати можуть усі учасники."}{" "}
            Учасників не обов'язково додавати зараз — можна запросити пізніше з профілю чату.
          </p>

          <label>
            Назва
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={mode === "channel" ? "Новини проєкту" : "Друзі 🥃"} maxLength={64} />
          </label>

          <label>
            {mode === "channel" ? "Підписники" : "Учасники"}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onQueryKeyDown}
              placeholder="Пошук за @username або номером"
            />
          </label>

          {selected.length > 0 && (
            <div className="member-chips">
              {selected.map((s) => (
                <span className="member-chip" key={s.id}>
                  {s.displayName}
                  <button type="button" onClick={() => removeMember(s.id)} aria-label={`Прибрати ${s.displayName}`}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {q.length >= 2 && (
            <div className="newchat-card">
              {searching && <div className="search-results-title">Пошук…</div>}
              {!searching && results.length === 0 && <div className="empty-hint">Нікого не знайдено</div>}
              {results.map((u) => (
                <ContactRow key={u.id} u={u} onPick={addMember} />
              ))}
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-primary" type="submit" disabled={creating || !name.trim()}>
            {creating ? "Створення…" : `Створити ${mode === "channel" ? "канал" : "групу"}`}
          </button>
        </form>
      )}
    </div>
  );
}
