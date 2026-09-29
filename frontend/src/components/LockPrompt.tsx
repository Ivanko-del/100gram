import { FormEvent, useState } from "react";
import { useChatLock } from "../context/ChatLockContext";

interface Props {
  title?: string;
  onCancel?: () => void;
}

/** Asks for the chat password and unlocks locked chats on success. */
export default function LockPrompt({ title = "Введи пароль", onCancel }: Props) {
  const { tryUnlock } = useChatLock();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await tryUnlock(password).catch(() => false);
    setBusy(false);
    if (!ok) {
      setError("Невірний пароль");
      setPassword("");
    }
  }

  return (
    <form className="lock-prompt" onSubmit={submit}>
      <div className="lock-prompt-icon">🔒</div>
      <h2>{title}</h2>
      <input
        type="password"
        autoFocus
        autoComplete="off"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль на чати"
      />
      {error && <div className="auth-error">{error}</div>}
      <button className="btn-primary" type="submit" disabled={busy || !password}>
        {busy ? "Перевірка…" : "Відкрити"}
      </button>
      {onCancel && (
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Назад
        </button>
      )}
    </form>
  );
}
