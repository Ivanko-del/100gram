import { FormEvent, useState } from "react";
import { hasReported, submitReport } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { REPORT_REASONS, REPORT_REASON_LABELS, REPORT_TEXT_LIMIT, ReportReason } from "../utils/reports";

interface Props {
  targetUid: string;
  targetName: string;
  /** set when reporting a specific message */
  message?: { chatId: string; messageId: string; text: string };
  onClose: () => void;
}

export default function ReportModal({ targetUid, targetName, message, onClose }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const me = user.id;
  const already = done ? false : hasReported(me, targetUid, message?.messageId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await submitReport({
        reporterUid: me,
        targetUid,
        reason,
        comment,
        chatId: message?.chatId,
        messageId: message?.messageId,
        messageText: message?.text,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося надіслати скаргу");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🚩 Скарга</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>
        {done ? (
          <>
            <p className="settings-hint">Скаргу надіслано. Дякуємо! ✓</p>
            <button type="button" className="btn-primary" onClick={onClose}>Готово</button>
          </>
        ) : already ? (
          <>
            <p className="settings-hint">Ви вже скаржились{message ? " на це повідомлення" : " на цього користувача"}.</p>
            <button type="button" className="btn-ghost" onClick={onClose}>Закрити</button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="report-form">
            <p className="settings-hint">
              {message ? "Скарга на повідомлення від" : "Скарга на користувача"} <b>{targetName}</b>
            </p>
            {message?.text && <blockquote className="report-snapshot">{message.text.slice(0, 200)}</blockquote>}
            <div className="report-reasons">
              {REPORT_REASONS.map((r) => (
                <label key={r}>
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {REPORT_REASON_LABELS[r]}
                </label>
              ))}
            </div>
            <label>
              Коментар (необов'язково)
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={REPORT_TEXT_LIMIT} rows={3} />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn-primary" type="submit" disabled={sending}>
              {sending ? "Надсилання…" : "Надіслати скаргу"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
