import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ConfirmationResult } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigured } from "../firebase";
import { createAuthAccount, discardUnfinishedAccount, finishRegistration } from "../data/firestore-api";
import { phoneAuthError, sendLinkCode } from "../data/phone-auth";
import { normalizePhone } from "../utils/phone";
import SmsCodeStep from "../components/SmsCodeStep";

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
    default:
      return phoneAuthError(e, "Помилка реєстрації");
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
  const [step, setStep] = useState<"form" | "code">("form");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  // An auth account with no profile is a sign-up that was abandoned halfway
  // (app closed at the SMS step). Clear it so the same email can be reused.
  useEffect(() => {
    if (uid && !user && step === "form" && !busy.current) discardUnfinishedAccount();
  }, [uid, user, step]);

  const phoneDigits = normalizePhone(phone);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!displayName.trim()) return setError("Вкажи ім'я");
    if (!USERNAME_RE.test(username.trim())) return setError("Username: 3-24 символи, латиниця/цифри/підкреслення");
    if (!phoneDigits) return setError("Вкажи номер телефону, наприклад +380 67 123 45 67");
    if (password.length < 6) return setError("Пароль — мінімум 6 символів");
    if (birthDate && (birthDate > todayIso() || birthDate < "1900-01-01")) return setError("Некоректна дата народження");

    setSubmitting(true);
    busy.current = true;
    let created = false;
    try {
      await createAuthAccount(email.trim(), password);
      created = true;
      confirmation.current = await sendLinkCode(phoneDigits, recaptchaRef.current!);
      setStep("code");
    } catch (err) {
      if (created) await discardUnfinishedAccount();
      setError(registerError(err));
    } finally {
      setSubmitting(false);
      busy.current = false;
    }
  }

  async function onCode(code: string) {
    if (!confirmation.current || !phoneDigits) return;
    setError(null);
    setSubmitting(true);
    busy.current = true;
    try {
      // links the verified phone to the email/password account
      await confirmation.current.confirm(code);
    } catch (err) {
      setError(phoneAuthError(err, "Невірний код"));
      setSubmitting(false);
      busy.current = false;
      return;
    }
    try {
      await finishRegistration(username.trim(), displayName.trim(), birthDate || null, phoneDigits);
      // profile now exists: the auth listener moves us into the app
    } catch (err) {
      // finishRegistration already removed the half-made account
      setStep("form");
      setError(err instanceof Error ? err.message : "Помилка реєстрації");
    } finally {
      setSubmitting(false);
      busy.current = false;
    }
  }

  async function onResend() {
    if (!phoneDigits) return;
    setError(null);
    try {
      confirmation.current = await sendLinkCode(phoneDigits, recaptchaRef.current!);
    } catch (err) {
      setError(phoneAuthError(err));
    }
  }

  async function onBack() {
    busy.current = true;
    await discardUnfinishedAccount();
    busy.current = false;
    setError(null);
    setStep("form");
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">🥃</div>
        <h1>Реєстрація в 100 ГРАМ</h1>
        <p className="auth-subtitle">Отримай 500 ГРАМів на старт — на подарунки друзям та преміум</p>

        {!firebaseConfigured && <div className="auth-error">Firebase ще не налаштований — see firebase.ts</div>}

        {step === "code" && phoneDigits ? (
          <SmsCodeStep phone={phoneDigits} busy={submitting} error={error} onSubmit={onCode} onResend={onResend} onBack={onBack} />
        ) : (
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
              Номер телефону <span className="auth-optional">(отримаєш SMS з кодом)</span>
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
              {submitting ? "Надсилаємо код…" : "Отримати код і зареєструватися"}
            </button>
          </form>
        )}

        <div ref={recaptchaRef} />

        <p className="auth-switch">
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </p>
      </div>
    </div>
  );
}
