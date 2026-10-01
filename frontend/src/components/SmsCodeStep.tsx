import { FormEvent, useEffect, useState } from "react";
import { formatPhone } from "../utils/phone";

interface Props {
  phone: string;
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
}

const RESEND_SECONDS = 45;

/** "Enter the 6-digit code we texted you" step, shared by sign-up, phone
 * sign-in and adding a number in settings. */
export default function SmsCodeStep({ phone, busy, error, onSubmit, onResend, onBack }: Props) {
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length >= 6) onSubmit(code.trim());
  }

  return (
    <form className="sms-step" onSubmit={submit}>
      <p className="settings-hint">
        Ми надіслали SMS з кодом на <b>{formatPhone(phone)}</b>. Введи його нижче.
      </p>
      <input
        className="sms-code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="••••••"
      />
      {error && <div className="auth-error">{error}</div>}
      <button className="btn-primary" type="submit" disabled={busy || code.length < 6}>
        {busy ? "Перевірка…" : "Підтвердити"}
      </button>
      <div className="sms-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || wait > 0}
          onClick={() => {
            setWait(RESEND_SECONDS);
            onResend();
          }}
        >
          {wait > 0 ? `Надіслати ще раз (${wait} с)` : "Надіслати код ще раз"}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onBack}>
          ← Назад
        </button>
      </div>
    </form>
  );
}
