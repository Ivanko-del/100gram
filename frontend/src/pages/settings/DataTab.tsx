import { useEffect, useState } from "react";
import { applyPrefs } from "../../utils/prefs";
import { formatBytes } from "../../utils/bytes";

/** Only 100 ГРАМ's own device-local settings live under this prefix. */
const LOCAL_PREFIX = "stogram_";

async function readUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage != null ? { usage: est.usage, quota: est.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

export default function DataTab() {
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    readUsage().then(setUsage);
  }, []);

  async function clearCache() {
    setBusy(true);
    setNote(null);
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      setNote("Кеш очищено. Застосунок підвантажить усе заново при наступному відкритті");
    } catch {
      setNote("Не вдалося очистити кеш у цьому браузері");
    } finally {
      setUsage(await readUsage());
      setBusy(false);
    }
  }

  function resetLocalSettings() {
    if (!window.confirm("Скинути тему, акцент, фон, розмір тексту та інші налаштування цього пристрою?")) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(LOCAL_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage blocked - nothing to reset */
    }
    document.documentElement.dataset.theme = "dark";
    applyPrefs();
    window.location.reload();
  }

  return (
    <div className="settings-panel">
      <h2>Дані та сховище</h2>

      <div className="wallet-balance">
        <span className="wallet-balance-amount">{usage ? formatBytes(usage.usage) : "—"}</span>
        <span className="wallet-balance-label">
          {usage && usage.quota > 0 ? `з ${formatBytes(usage.quota)} доступних на пристрої` : "використано на цьому пристрої"}
        </span>
      </div>
      <p className="settings-hint">
        Це кеш застосунку (сам код і ресурси, щоб він швидко відкривався й працював без мережі). Повідомлення й фото
        зберігаються не тут, а в акаунті, тому очищення кешу їх не видалить.
      </p>
      <button type="button" className="btn-ghost" disabled={busy} onClick={clearCache}>
        {busy ? "Очищення…" : "Очистити кеш"}
      </button>
      {note && <div className="auth-success">{note}</div>}

      <h3>Налаштування пристрою</h3>
      <p className="settings-hint">
        Тема, акцент, фон чату, розмір тексту й режими з вкладок «Вигляд», «Сповіщення» та «Економія енергії»
        зберігаються лише на цьому пристрої.
      </p>
      <button type="button" className="btn-ghost" onClick={resetLocalSettings}>
        Скинути налаштування пристрою
      </button>
    </div>
  );
}
