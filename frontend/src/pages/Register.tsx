import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigured } from "../firebase";
import { createAuthAccount, discardUnfinishedAccount, finishRegistration } from "../data/firestore-api";
import { normalizePhone } from "../utils/phone";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function registerError(e: unknown): string {
  switch ((e as { code?: string })?.code) {
    case "auth/email-already-in-use":
      return "Ця пошта вже зареєстрована";
    case "auth/weak-password":
      return "Пароль — мінімум 6 символів";
    case "auth/invalid-email":
      return "Некоректний email";
    case "auth/network-request-failed":
      return "Немає з'єднання з мережею";
    default:
      return e instanceof Error && e.message ? e.message : "Помилка реєстрації";
  }
}

export default function Register() {
  const { uid, user } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  // An auth account with no profile is a sign-up that was cut off halfway.
  // Clear it so the same email can be used again.
  useEffect(() => {
    if (uid && !user && !busy.current) discardUnfinishedAccount();
  }, [uid, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const phoneDigits = normalizePhone(phone);
    if (!displayName.trim()) return setError("Вкажи ім'я");
    if (!USERNAME_RE.test(username.trim())) return setError("Username: 3-24 символи, латиниця/цифри/підкреслення");
    if (!phoneDigits) return setError("Вкажи номер телефону, наприклад +380 67 123 45 67");
    if (password.length < 6) return setError("Пароль — мінімум 6 символів");
    if (birthDate && (birthDate > todayIso() || birthDate < "1900-01-01")) return setError("Некоректна дата народження");

    setSubmitting(true);
    busy.current = true;
    try {
      await createAuthAccount(email.trim(), password);
      // profile is created right away; the number can be confirmed by SMS
      // later in Settings (finishRegistration removes the account on failure)
      await finishRegistration(username.trim(), displayName.trim(), birthDate || null, phoneDigits);
    } catch (err) {
      await discardUnfinishedAccount();
      setError(registerError(err));
    } finally {
      setSubmitting(false);
      busy.current = false;
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">🥃</div>
        <h1>Реєстрація в 100 ГРАМ</h1>
        <p className="auth-subtitle">Отримай 500 ГРАМів на старт — на подарунки друзям та преміум</p>

        {!firebaseConfigured && <div className="auth-error">Firebase ще не налаштований — see firebase.ts</div>}

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Ім'я та прізвище
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Антон Коваль" />
          </label>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="anton" autoCapitalize="none" />
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
            <span className="auth-optional">Підтвердити SMS-кодом можна пізніше в Налаштуваннях</span>
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
        </form>

        <p className="auth-switch">
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </p>
      </div>
    </div>
  );
}
