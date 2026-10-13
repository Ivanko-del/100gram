import { useState } from "react";
import { DataError, setChatFolders } from "../../data/firestore-api";
import { MAX_FOLDER_NAME } from "../../constants";
import { useMyChats } from "../../hooks/useMyChats";
import { ChatFolder, User } from "../../types";
import { folderLimit, makeFolder, toggleChatInFolder } from "../../utils/folders";

export default function FoldersTab({ user }: { user: User }) {
  const chats = useMyChats(user.id);
  const folders = user.chatFolders ?? [];
  const limit = folderLimit(user.isPremium);
  const [draft, setDraft] = useState<ChatFolder | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: ChatFolder[]) {
    setBusy(true);
    setError(null);
    try {
      await setChatFolders(user.id, next);
      return true;
    } catch (e) {
      setError(e instanceof DataError ? e.message : "Не вдалося зберегти папки");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError("Дай папці назву");
    const next = isNew ? [...folders, { ...draft, name }] : folders.map((f) => (f.id === draft.id ? { ...draft, name } : f));
    if (await persist(next)) setDraft(null);
  }

  async function remove(folder: ChatFolder) {
    if (!window.confirm(`Видалити папку «${folder.name}»? Самі чати лишаться.`)) return;
    await persist(folders.filter((f) => f.id !== folder.id));
  }

  return (
    <div className="settings-panel">
      <h2>Папки для чатів</h2>
      <p className="settings-hint">
        Збери чати в окремі вкладки над списком — наприклад «Робота» чи «Друзі». Один чат може бути в кількох папках.
      </p>

      {folders.length === 0 && !draft && <p className="settings-hint">Папок ще немає.</p>}
      {folders.map((f) => (
        <div key={f.id} className="switch-row">
          <span>
            📁 {f.name} <span className="settings-hint">· чатів: {f.chatIds.length}</span>
          </span>
          <span className="folder-actions">
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                setDraft(f);
                setIsNew(false);
                setError(null);
              }}
            >
              Змінити
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => remove(f)}>
              Видалити
            </button>
          </span>
        </div>
      ))}

      {draft ? (
        <div className="chat-settings-block folder-editor">
          <label>
            Назва папки
            <input value={draft.name} maxLength={MAX_FOLDER_NAME} autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Робота" />
          </label>
          <div className="settings-hint">Чати в папці</div>
          <div className="folder-chat-list">
            {chats.length === 0 && <p className="settings-hint">У тебе ще немає чатів.</p>}
            {chats.map((c) => (
              <label key={c.id} className="switch-row">
                <span>{c.name}</span>
                <input type="checkbox" checked={draft.chatIds.includes(c.id)} onChange={() => setDraft(toggleChatInFolder(draft, c.id))} />
              </label>
            ))}
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="phone-section-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={save}>
              {busy ? "Збереження…" : "Зберегти"}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => setDraft(null)}>
              Скасувати
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && <div className="auth-error">{error}</div>}
          <button
            type="button"
            className="btn-primary"
            style={{ width: "fit-content" }}
            disabled={busy || folders.length >= limit}
            onClick={() => {
              setDraft(makeFolder(""));
              setIsNew(true);
              setError(null);
            }}
          >
            ➕ Нова папка
          </button>
          <p className="settings-hint">
            {folders.length}/{limit} папок{!user.isPremium && ` · з преміумом — до ${folderLimit(true)}`}
          </p>
        </>
      )}
    </div>
  );
}
