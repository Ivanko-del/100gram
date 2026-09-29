import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigured } from "../firebase";
import { normalizePhone } from "../utils/phone";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Register() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedUsername = username.trim();
    if (!USERNAME_RE.test(trimmedUsername)) {
      setError("Username: 3-24 символи, латиниця/цифри/підкреслення");
      return;
    }
    if (!displayName.trim()) {
      setError("Вкажи ім'я");
      return;
    }
    const phoneDigits = normalizePhone(phone);
    if (!phoneDigits) {
      setError("Вкажи номер телефону, наприклад +380 67 123 45 67");
      return;
    }
    if (password.length < 6) {
      setError("Пароль — мінімум 6 символів");
      return;
    }
    if (birthDate && (birthDate > todayIso() || birthDate < "1900-01-01")) {
      setError("Некоректна дата народження");
      return;
    }
    setSubmitting(true);
    try {
      await register(trimmedUsername, email.trim(), password, displayName.trim(), birthDate || null, phoneDigits);
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

        {!firebaseConfigured && (
          <div className="auth-error">Firebase ще не налаштований — see firebase.ts</div>
        )}

        <label>
          Ім'я та прізвище
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Антон Коваль" />
        </label>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="anton" />
        </label>
        <label>
          Номер телефону
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+380 67 123 45 67"
          />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anton@mail.com" />
        </label>
        <label>
          <span>
            Дата народження <span className="auth-optional">(необов'язково)</span>
          </span>
          <input type="date" value={birthDate} min="1900-01-01" max={todayIso()} onChange={(e) => setBirthDate(e.target.value)} />
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

        <button className="btn-primary" type="submit" disabled={submitting || !firebaseConfigured}>
          {submitting ? "Реєстрація…" : "Зареєструватися"}
        </button>

        <p className="auth-switch">
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </p>
      </form>
    </div>
  );
}
