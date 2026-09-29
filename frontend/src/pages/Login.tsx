import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigured } from "../firebase";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
          Email або номер телефону
          <input
            autoFocus
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="anton@mail.com або +380…"
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
          Немає акаунта? <Link to="/register">Зареєструватися</Link>
        </p>
      </form>
    </div>
  );
}
