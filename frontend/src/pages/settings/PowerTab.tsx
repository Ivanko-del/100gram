import { useState } from "react";
import { PowerSaving, canWatchBattery, getPowerSaving, setPowerSaving } from "../../utils/prefs";

const OPTIONS: { id: PowerSaving; label: string }[] = [
  { id: "off", label: "Вимкнено" },
  { id: "auto", label: "Автоматично" },
  { id: "on", label: "Завжди" },
];

export default function PowerTab() {
  const [mode, setMode] = useState<PowerSaving>(getPowerSaving);
  const autoSupported = canWatchBattery();

  function pick(next: PowerSaving) {
    setMode(next);
    setPowerSaving(next);
  }

  return (
    <div className="settings-panel">
      <h2>Економія енергії</h2>
      <p className="settings-hint">
        Вимикає анімації, плавні переходи й розмиття — інтерфейс стає простішим, а телефон довше тримає заряд.
      </p>
      <div className="theme-options" role="radiogroup" aria-label="Економія енергії">
        {OPTIONS.map((o) => {
          const disabled = o.id === "auto" && !autoSupported;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={mode === o.id}
              disabled={disabled}
              className={`theme-card ${mode === o.id ? "selected" : ""} ${disabled ? "theme-card-locked" : ""}`}
              onClick={() => pick(o.id)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="settings-hint">
        «Автоматично» вмикає економію, коли заряд нижче 20% і телефон не заряджається.
        {!autoSupported && " Твій браузер не віддає рівень заряду, тому цей режим недоступний."}
      </p>
    </div>
  );
}
