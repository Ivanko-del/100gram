import { FormEvent, useState } from "react";
import { setLockPassword } from "../data/chat-lock";
import { useAuth } from "../context/AuthContext";

interface Props {
  onClose: () => void;
  /** called after the password is saved */
  onDone: () => void;
}

/** Creates (or replaces) the password that protects locked/hidden chats. */
export default function LockSetupModal({ onClose, onDone }: Props) {
  const { uid } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;
    if (pw.length < 4) return setError("Пароль — мінімум 4 символи");
    if (pw !== pw2) return setError("Паролі не збігаються");
    setBusy(true);
    setError(null);
    try {
      await setLockPassword(uid, pw);
      onDone();
    } catch {
      setError("Не вдалося зберегти пароль");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <h2>Пароль на чати</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>
        <p className="settings-hint">
          Цей пароль відкриває заблоковані й приховані чати. Якщо забудеш — його можна скинути паролем акаунта в
          Налаштуваннях, але всі блокування зникнуть.
        </p>
        <label>
          Новий пароль
          <input type="password" autoFocus autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label>
          Повтори пароль
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Збереження…" : "Зберегти пароль"}
        </button>
      </form>
    </div>
  );
}
