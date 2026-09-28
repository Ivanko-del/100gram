import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { DataError, createGroupChat, searchUsers } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { PublicUser } from "../types";
import Avatar from "./Avatar";

interface Props {
  onClose: () => void;
  onCreated: (chatId: string) => void;
}

type Mode = "group" | "channel";

export default function NewChatModal({ onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("group");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const res = await searchUsers(q, user?.id ?? "");
        setResults(res.filter((u) => !selected.some((s) => s.id === u.id)));
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (!name.trim()) {
      setError("Вкажи назву");
      return;
    }
    if (selected.length === 0) {
      setError(mode === "channel" ? "Додай хоча б одного підписника" : "Додай хоча б одного учасника");
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <div className="modal-header">
          <h2>Новий {mode === "channel" ? "канал" : "груповий чат"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        <div className="auth-tabs modal-tabs">
          <button type="button" className={mode === "group" ? "active" : ""} onClick={() => setMode("group")}>
            👥 Група
          </button>
          <button type="button" className={mode === "channel" ? "active" : ""} onClick={() => setMode("channel")}>
            📢 Канал
          </button>
        </div>
        <p className="settings-hint">
          {mode === "channel"
            ? "У каналі писати можеш лише ти (і майбутні адміни) — інші тільки читають."
            : "У групі писати можуть усі учасники."}
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
            placeholder="Пошук за @username"
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

        {query.trim().length >= 2 && (
          <div className="search-results modal-results">
            {searching && <div className="search-results-title">Пошук…</div>}
            {!searching && results.length === 0 && <div className="empty-hint">Нікого не знайдено</div>}
            {results.map((u) => (
              <button type="button" className="chat-list-item" key={u.id} onClick={() => addMember(u)}>
                <Avatar name={u.displayName} color={u.avatarColor} isPremium={u.isPremium} size={36} />
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

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={creating || !name.trim() || selected.length === 0}>
          {creating ? "Створення…" : `Створити ${mode === "channel" ? "канал" : "групу"}`}
        </button>
      </form>
    </div>
  );
}
