import { FormEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ConfirmationResult } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigured } from "../firebase";
import { requestPasswordReset, requireProfileAfterPhoneLogin } from "../data/firestore-api";
import { phoneAuthError, sendSignInCode } from "../data/phone-auth";
import { normalizePhone } from "../utils/phone";
import SmsCodeStep from "../components/SmsCodeStep";

type Mode = "email" | "phone" | "reset";

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const phoneDigits = normalizePhone(phone);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNote(null);
    setCodeSent(false);
  }

  async function onEmailSubmit(e: FormEvent) {
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

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError("Вкажи email акаунта");
    setError(null);
    setNote(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setNote("Готово. Якщо акаунт із такою поштою існує, ми надіслали лист із посиланням для нового пароля (перевір і «Спам»).");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(
        code === "auth/invalid-email"
          ? "Некоректний email"
          : code === "auth/too-many-requests"
            ? "Забагато спроб. Спробуй пізніше"
            : "Не вдалося надіслати лист"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function sendCode() {
    if (!phoneDigits) return setError("Вкажи номер телефону, наприклад +380 67 123 45 67");
    setError(null);
    setSubmitting(true);
    try {
      confirmation.current = await sendSignInCode(phoneDigits, recaptchaRef.current!);
      setCodeSent(true);
    } catch (err) {
      setError(phoneAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onPhoneSubmit(e: FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function onCode(code: string) {
    if (!confirmation.current) return;
    setError(null);
    setSubmitting(true);
    try {
      await confirmation.current.confirm(code);
      await requireProfileAfterPhoneLogin();
      // signed in: the auth listener moves us into the app
    } catch (err) {
      setError(phoneAuthError(err, "Невірний код"));
      // a wiped bare account means the number was never registered
      if (err instanceof Error && !(err as { code?: string }).code) setCodeSent(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">🥃</div>
        <h1>100 ГРАМ</h1>
        <p className="auth-subtitle">Месенджер, де кожне повідомлення — як добрий тост</p>

        {!firebaseConfigured && <div className="auth-error">Firebase ще не налаштований — see firebase.ts</div>}

        {mode !== "reset" && (
        <div className="auth-tabs modal-tabs">
          <button type="button" className={mode === "email" ? "active" : ""} onClick={() => switchMode("email")}>
            ✉️ Email
          </button>
          <button type="button" className={mode === "phone" ? "active" : ""} onClick={() => switchMode("phone")}>
            📱 Телефон
          </button>
        </div>
        )}

        {mode === "reset" ? (
          <form className="auth-form" onSubmit={onReset}>
            <p className="settings-hint">Введи email акаунта, і ми надішлемо лист для скидання пароля.</p>
            <label>
              Email
              <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anton@mail.com" />
            </label>
            {note && <div className="auth-success">{note}</div>}
            {error && <div className="auth-error">{error}</div>}
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Надсилаємо…" : "Надіслати лист"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => switchMode("email")}>
              ← Назад до входу
            </button>
          </form>
        ) : mode === "email" ? (
          <form className="auth-form" onSubmit={onEmailSubmit}>
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
            <button type="button" className="btn-link" onClick={() => switchMode("reset")}>
              Забув пароль?
            </button>
          </form>
        ) : codeSent && phoneDigits ? (
          <SmsCodeStep
            phone={phoneDigits}
            busy={submitting}
            error={error}
            onSubmit={onCode}
            onResend={sendCode}
            onBack={() => {
              setCodeSent(false);
              setError(null);
            }}
          />
        ) : (
          <form className="auth-form" onSubmit={onPhoneSubmit}>
            <label>
              Номер телефону
              <input
                autoFocus
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380 67 123 45 67"
              />
            </label>
            <p className="settings-hint">
              Ми надішлемо SMS з кодом. Працює лише для підтвердженого номера — якщо SMS не приходять, увійди через Email.
            </p>

            {error && <div className="auth-error">{error}</div>}

            <button className="btn-primary" type="submit" disabled={submitting || !firebaseConfigured}>
              {submitting ? "Надсилаємо код…" : "Отримати код"}
            </button>
          </form>
        )}

        <div ref={recaptchaRef} />

        <p className="auth-switch">
          Немає акаунта? <Link to="/register">Зареєструватися</Link>
        </p>
      </div>
    </div>
  );
}
