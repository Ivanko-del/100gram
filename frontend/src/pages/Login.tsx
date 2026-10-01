import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigured } from "../firebase";

export default function Login() {
  const { login, resetPassword } = useAuth();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка входу");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResetSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося надіслати лист");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: "login" | "reset") {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  if (mode === "reset") {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={onResetSubmit}>
          <div className="auth-logo">🔑</div>
          <h1>Відновлення пароля</h1>
          <p className="auth-subtitle">Введи email свого акаунта — надішлемо лист з посиланням для скидання пароля</p>

          {resetSent ? (
            <div className="auth-reset-sent">
              Якщо такий email зареєстрований, лист уже в дорозі. Перевір теку "Спам", якщо не бачиш його за кілька хвилин.
            </div>
          ) : (
            <>
              <label>
                Email
                <input
                  autoFocus
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="anton@mail.com"
                />
              </label>

              {error && <div className="auth-error">{error}</div>}

              <button className="btn-primary" type="submit" disabled={submitting || !firebaseConfigured || !email.trim()}>
                {submitting ? "Надсилання…" : "Надіслати лист"}
              </button>
            </>
          )}

          <p className="auth-switch">
            <button type="button" className="auth-link-btn" onClick={() => switchMode("login")}>
              ← Назад до входу
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-logo">🥃</div>
        <h1>100 ГРАМ</h1>
        <p className="auth-subtitle">Месенджер, де кожне повідомлення — як добрий тост</p>

        {!firebaseConfigured && (
          <div className="auth-error">Firebase ще не налаштований — see firebase.ts</div>
        )}

        <label>
          Email
          <input
            autoFocus
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="anton@mail.com"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting || !firebaseConfigured}>
          {submitting ? "Вхід…" : "Увійти"}
        </button>

        <p className="auth-switch">
          <button type="button" className="auth-link-btn" onClick={() => switchMode("reset")}>
            Забули пароль?
          </button>
        </p>
        <p className="auth-switch">
          Немає акаунта? <Link to="/register">Зареєструватися</Link>
        </p>
      </form>
    </div>
  );
}
