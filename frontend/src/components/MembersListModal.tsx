import { FormEvent, useEffect, useState } from "react";
import { DataError, addChatMembers, removeChatMember, renameChat, searchUsers, setChatAdmin, setChatMute } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { ChatSummary, PublicUser } from "../types";
import Avatar from "./Avatar";

interface Props {
  chat: ChatSummary;
  onClose: () => void;
  onSelectMember: (uid: string) => void;
}

export default function MembersListModal({ chat, onClose, onSelectMember }: Props) {
  const { user } = useAuth();
  const isAdmin = !!user && chat.adminUids.includes(user.id);
  const canInvite = chat.isChannel ? isAdmin : true;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(chat.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

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
        setResults(res.filter((u) => !chat.members.some((m) => m.id === u.id)));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, user?.id, chat.members]);

  async function invite(u: PublicUser) {
    setError(null);
    setInviting(true);
    try {
      await addChatMembers(chat, [u.username]);
      setQuery("");
      setResults([]);
    } catch (err) {
      setError(err instanceof DataError ? err.message : "Не вдалося додати");
    } finally {
      setInviting(false);
    }
  }

  function onInviteSubmit(e: FormEvent) {
    e.preventDefault();
    if (results.length > 0) invite(results[0]);
  }

  async function kick(uid: string, name: string) {
    if (!window.confirm(`Видалити ${name} з ${chat.isChannel ? "каналу" : "групи"}?`)) return;
    setError(null);
    setBusyUid(uid);
    try {
      await removeChatMember(chat.id, uid);
    } catch {
      setError("Не вдалося видалити");
    } finally {
      setBusyUid(null);
    }
  }

  async function toggleAdmin(uid: string, makeAdmin: boolean) {
    setError(null);
    setBusyUid(uid);
    try {
      await setChatAdmin(chat.id, uid, makeAdmin);
    } catch {
      setError("Не вдалося змінити права");
    } finally {
      setBusyUid(null);
    }
  }

  async function toggleMute(uid: string, muted: boolean) {
    setError(null);
    setBusyUid(uid);
    try {
      await setChatMute(chat.id, uid, muted);
    } catch {
      setError("Не вдалося змінити заглушення");
    } finally {
      setBusyUid(null);
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setNameError(null);
    setSavingName(true);
    try {
      await renameChat(chat.id, nameDraft);
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof DataError ? err.message : "Не вдалося перейменувати");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{chat.isChannel ? "Підписники" : "Учасники"} ({chat.members.length})</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        {isAdmin && (
          <div className="chat-settings-block">
            {editingName ? (
              <form className="chat-rename-form" onSubmit={saveName}>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={64}
                  autoFocus
                />
                <button className="btn-primary" type="submit" disabled={savingName || !nameDraft.trim()}>
                  {savingName ? "…" : "Зберегти"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setEditingName(false);
                    setNameDraft(chat.name);
                    setNameError(null);
                  }}
                >
                  Скасувати
                </button>
              </form>
            ) : (
              <button type="button" className="btn-ghost chat-rename-trigger" onClick={() => setEditingName(true)}>
                ✏️ Перейменувати {chat.isChannel ? "канал" : "групу"}
              </button>
            )}
            {nameError && <div className="auth-error">{nameError}</div>}
          </div>
        )}

        {canInvite && (
          <form onSubmit={onInviteSubmit}>
            <label>
              Запросити
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Пошук за @username" />
            </label>
            {query.trim().length >= 2 && (
              <div className="search-results modal-results">
                {searching && <div className="search-results-title">Пошук…</div>}
                {!searching && results.length === 0 && <div className="empty-hint">Нікого не знайдено</div>}
                {results.map((u) => (
                  <button
                    type="button"
                    className="chat-list-item"
                    key={u.id}
                    disabled={inviting}
                    onClick={() => invite(u)}
                  >
                    <Avatar name={u.displayName} color={u.avatarColor} photoUrl={u.avatarUrl} isPremium={u.isPremium} size={36} />
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
          </form>
        )}

        {error && <div className="auth-error">{error}</div>}

        <div className="member-list">
          {chat.members.map((m) => {
            const memberIsAdmin = chat.adminUids.includes(m.id);
            const memberIsMuted = chat.mutedUids.includes(m.id);
            const isSelf = m.id === user?.id;
            return (
              <div key={m.id} className="member-row">
                <button className="chat-list-item" onClick={() => onSelectMember(m.id)}>
                  <Avatar name={m.displayName} color={m.avatarColor} photoUrl={m.avatarUrl} />
                  <div className="chat-list-item-body">
                    <div className="chat-list-item-top">
                      <span className="chat-name">{m.displayName}</span>
                      {memberIsAdmin && <span className="admin-badge">адмін</span>}
                      {memberIsMuted && <span className="admin-badge muted-inline-badge">заглушено</span>}
                    </div>
                    <div className="chat-list-item-bottom">@{m.username}</div>
                  </div>
                </button>
                {isAdmin && !isSelf && (
                  <div className="member-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busyUid === m.id}
                      onClick={() => toggleAdmin(m.id, !memberIsAdmin)}
                    >
                      {memberIsAdmin ? "Зняти адміна" : "Зробити адміном"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busyUid === m.id}
                      onClick={() => toggleMute(m.id, !memberIsMuted)}
                    >
                      {memberIsMuted ? "Зняти заглушення" : "Заглушити в чаті"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost member-kick"
                      disabled={busyUid === m.id}
                      onClick={() => kick(m.id, m.displayName)}
                    >
                      Видалити
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
