import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(usernameOrEmail, password);
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

        <label>
          Логін або пошта
          <input
            autoFocus
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            placeholder="anton або anton@100gram.chat"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Вхід…" : "Увійти"}
        </button>

        <p className="auth-switch">
          Немає акаунта? <Link to="/register">Зареєструватися</Link>
        </p>
        <p className="auth-hint">Демо: anton / password123 або olha / password123</p>
      </form>
    </div>
  );
}
