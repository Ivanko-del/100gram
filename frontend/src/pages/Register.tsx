import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(username.trim(), email.trim(), password, displayName.trim() || username.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка реєстрації");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-logo">🥃</div>
        <h1>Реєстрація в 100 ГРАМ</h1>
        <p className="auth-subtitle">Отримай 500 ГРАМів на старт — на подарунки друзям та преміум</p>

        <label>
          Ім'я та прізвище
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Антон Коваль" />
        </label>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="anton" />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anton@mail.com" />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Мінімум 6 символів"
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Реєстрація…" : "Зареєструватися"}
        </button>

        <p className="auth-switch">
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </p>
      </form>
    </div>
  );
}
