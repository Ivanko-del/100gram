import { useState } from "react";
import { Bell, BellOff, Eye, Volume2 } from "lucide-react";
import { setChatMutedForMe } from "../../data/firestore-api";
import { useMyChats } from "../../hooks/useMyChats";
import { User } from "../../types";
import {
  isBrowserNotifyEnabled,
  isNotifyPreviewEnabled,
  notificationPermission,
  setBrowserNotify,
  setNotifyPreview,
} from "../../utils/notify";
import { isSoundEnabled, playNotificationSound, setSoundEnabled } from "../../utils/sound";

export default function NotificationsTab({ user }: { user: User }) {
  const chats = useMyChats(user.id);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [browserOn, setBrowserOn] = useState(isBrowserNotifyEnabled);
  const [preview, setPreview] = useState(isNotifyPreviewEnabled);
  const [error, setError] = useState<string | null>(null);
  const permission = notificationPermission();

  const muted = (user.mutedChats ?? []).map((id) => ({ id, name: chats.find((c) => c.id === id)?.name }));

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playNotificationSound();
  }

  async function toggleBrowser(next: boolean) {
    setError(null);
    const on = await setBrowserNotify(next);
    setBrowserOn(on);
    if (next && !on) {
      setError(
        permission === "unsupported"
          ? "Цей браузер не підтримує сповіщення"
          : "Сповіщення заблоковано в браузері — дозволь їх у налаштуваннях сайту"
      );
    }
  }

  return (
    <div className="settings-panel">
      <h2>Сповіщення</h2>

      <label className="switch-row">
        <span><Volume2 size={16} className="inline-icon" /> Звук при новому повідомленні</span>
        <input type="checkbox" checked={soundOn} onChange={toggleSound} />
      </label>

      <h3>Поки застосунок у фоні</h3>
      <label className="switch-row">
        <span><Bell size={16} className="inline-icon" /> Сповіщення в браузері</span>
        <input type="checkbox" checked={browserOn} disabled={permission === "unsupported"} onChange={(e) => toggleBrowser(e.target.checked)} />
      </label>
      <label className="switch-row">
        <span><Eye size={16} className="inline-icon" /> Показувати текст повідомлення</span>
        <input
          type="checkbox"
          checked={preview}
          disabled={!browserOn}
          onChange={(e) => {
            setPreview(e.target.checked);
            setNotifyPreview(e.target.checked);
          }}
        />
      </label>
      <p className="settings-hint">
        Сповіщення приходять, поки 100 ГРАМ відкритий у вкладці чи встановлений застосунок працює у фоні. Повністю
        закритий застосунок сповіщень не отримає. Для заблокованих і прихованих чатів текст ніколи не показується.
      </p>
      {error && <div className="auth-error">{error}</div>}

      <h3>Вимкнені чати</h3>
      {muted.length === 0 ? (
        <p className="settings-hint">Усі чати зі звуком. Вимкнути звук можна, утримуючи чат у списку.</p>
      ) : (
        muted.map((m) => (
          <div key={m.id} className="switch-row">
            <span><BellOff size={16} className="inline-icon" /> {m.name ?? "Чат"}</span>
            <button type="button" className="btn-ghost" onClick={() => setChatMutedForMe(user.id, m.id, false)}>
              Увімкнути
            </button>
          </div>
        ))
      )}
    </div>
  );
}
