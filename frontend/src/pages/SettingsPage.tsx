import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataError, buyPremium, subscribeTransactions, transferGrams, updateProfile } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { AVATAR_COLORS, PREMIUM_PLANS } from "../constants";
import { PremiumPlan, User, WalletTransaction } from "../types";
import Avatar from "../components/Avatar";

type Tab = "profile" | "wallet" | "premium" | "appearance";

interface TabProps {
  user: User;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  if (!user) return null;

  return (
    <div className="settings-layout">
      <aside className="settings-nav">
        <button className="icon-btn back-btn" onClick={() => navigate("/")}>
          ← Назад до чатів
        </button>
        <div className="settings-profile-preview">
          <Avatar name={user.displayName} color={user.avatarColor} size={72} isPremium={user.isPremium} />
          <div className="settings-profile-name">{user.displayName}</div>
          <div className="settings-profile-username">@{user.username}</div>
          {user.isPremium && <div className="premium-chip">⭐ Преміум активний</div>}
        </div>
        <nav>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
            👤 Профіль
          </button>
          <button className={tab === "appearance" ? "active" : ""} onClick={() => setTab("appearance")}>
            🎨 Вигляд
          </button>
          <button className={tab === "wallet" ? "active" : ""} onClick={() => setTab("wallet")}>
            🥃 Гаманець · {user.grams} ГРАМ
          </button>
          <button className={tab === "premium" ? "active" : ""} onClick={() => setTab("premium")}>
            ⭐ Преміум
          </button>
        </nav>
        <button className="logout-btn" onClick={() => logout()}>
          Вийти
        </button>
      </aside>

      <main className="settings-content">
        {tab === "profile" && <ProfileTab user={user} />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "wallet" && <WalletTab user={user} />}
        {tab === "premium" && <PremiumTab user={user} />}
      </main>
    </div>
  );
}

function ProfileTab({ user }: TabProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(user.id, { displayName, bio, avatarColor });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-panel" onSubmit={onSave}>
      <h2>Профіль</h2>
      <label>
        Ім'я
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={48} />
      </label>
      <label>
        Про себе
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} />
      </label>
      <label>Колір аватара</label>
      <div className="color-swatches">
        {AVATAR_COLORS.map((c) => (
          <button
            type="button"
            key={c}
            className={`swatch ${avatarColor === c ? "selected" : ""}`}
            style={{ backgroundColor: c }}
            onClick={() => setAvatarColor(c)}
          />
        ))}
      </div>
      {error && <div className="auth-error">{error}</div>}
      <button className="btn-primary" type="submit" disabled={saving}>
        {saving ? "Збереження…" : saved ? "Збережено ✓" : "Зберегти"}
      </button>
    </form>
  );
}

function AppearanceTab() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("stogram_theme") ?? "dark");
  const { installed, canPromptInstall, promptInstall, isIos } = useInstallPrompt();

  function applyTheme(next: string) {
    setTheme(next);
    localStorage.setItem("stogram_theme", next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <div className="settings-panel">
      <h2>Вигляд</h2>
      <p className="settings-hint">Оберіть тему оформлення чату</p>
      <div className="theme-options">
        <button className={`theme-card dark ${theme === "dark" ? "selected" : ""}`} onClick={() => applyTheme("dark")}>
          🌙 Темна
        </button>
        <button className={`theme-card light ${theme === "light" ? "selected" : ""}`} onClick={() => applyTheme("light")}>
          ☀️ Світла
        </button>
      </div>

      <h3>Застосунок на телефон і ПК</h3>
      {installed ? (
        <p className="settings-hint">✓ Уже встановлено як застосунок на цьому пристрої</p>
      ) : canPromptInstall ? (
        <>
          <p className="settings-hint">
            Постав 100 ГРАМ як застосунок — окрема іконка, вікно без адресного рядка, працює офлайн.
          </p>
          <button className="btn-primary" style={{ width: "fit-content" }} onClick={promptInstall}>
            📲 Встановити застосунок
          </button>
        </>
      ) : isIos ? (
        <p className="settings-hint">
          На iPhone/iPad: натисни кнопку "Поділитися" внизу Safari → «На екран «Домій»».
        </p>
      ) : (
        <p className="settings-hint">
          Відкрий цю сторінку в Chrome/Edge — з'явиться іконка встановлення в адресному рядку,
          або цей пристрій уже не пропонує встановлення.
        </p>
      )}
    </div>
  );
}

function WalletTab({ user }: TabProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [toUsername, setToUsername] = useState("");
  const [amount, setAmount] = useState(50);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeTransactions(user.id, setTransactions);
    return unsub;
  }, [user.id]);

  async function onTransfer(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await transferGrams(user.id, user.username, toUsername.trim(), amount, note.trim() || null);
      setToUsername("");
      setNote("");
      setAmount(50);
    } catch (e2) {
      setError(e2 instanceof DataError ? e2.message : "Не вдалося переказати");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="settings-panel">
      <h2>Гаманець</h2>
      <div className="wallet-balance">
        <span className="wallet-balance-amount">{user.grams}</span>
        <span className="wallet-balance-label">ГРАМ 🥃</span>
      </div>

      <form className="transfer-form" onSubmit={onTransfer}>
        <h3>Переказати другу</h3>
        <label>
          Username отримувача
          <input value={toUsername} onChange={(e) => setToUsername(e.target.value)} placeholder="olha" />
        </label>
        <label>
          Сума
          <input
            type="number"
            min={1}
            max={1_000_000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <label>
          Повідомлення (необов'язково)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="За каву ☕" maxLength={120} />
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button className="btn-primary" type="submit" disabled={sending || !toUsername.trim()}>
          {sending ? "Надсилання…" : "Переказати"}
        </button>
      </form>

      <h3>Історія</h3>
      <div className="tx-list">
        {transactions.length === 0 && <div className="empty-hint">Ще немає транзакцій</div>}
        {transactions.map((t) => (
          <div key={t.id} className="tx-row">
            <div className="tx-icon">
              {t.type === "premium_purchase" ? "⭐" : t.type === "welcome_bonus" ? "🎁" : t.direction === "in" ? "⬇️" : "⬆️"}
            </div>
            <div className="tx-body">
              <div className="tx-title">
                {t.type === "welcome_bonus"
                  ? "Вітальний бонус"
                  : t.type === "premium_purchase"
                    ? t.note ?? "Покупка преміум"
                    : t.direction === "in"
                      ? `Від @${t.counterparty.username}`
                      : `Для @${t.counterparty.username}`}
              </div>
              <div className="tx-date">{new Date(t.createdAt).toLocaleString("uk-UA")}</div>
            </div>
            <div className={`tx-amount ${t.amount >= 0 ? "positive" : "negative"}`}>
              {t.amount >= 0 ? "+" : ""}
              {t.amount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PremiumTab({ user }: TabProps) {
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function buy(plan: PremiumPlan) {
    setBuying(plan.id);
    setError(null);
    setSuccess(null);
    try {
      await buyPremium(user.id, plan);
      setSuccess(`Преміум активовано: ${plan.label} ✓`);
    } catch (e2) {
      setError(e2 instanceof DataError ? e2.message : "Не вдалося оформити преміум");
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="settings-panel">
      <h2>100 ГРАМ Преміум ⭐</h2>
      <ul className="premium-features">
        <li>🚀 Швидша доставка повідомлень</li>
        <li>⭐ Значок преміум біля імені</li>
        <li>🎨 Ексклюзивні кольори аватара</li>
        <li>📎 Більший ліміт повідомлень</li>
        <li>🥃 +10% бонус до подарункових ГРАМів</li>
      </ul>
      {user.isPremium && user.premiumUntil && (
        <div className="premium-chip">Активний до {new Date(user.premiumUntil).toLocaleDateString("uk-UA")}</div>
      )}
      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}
      <div className="premium-plans">
        {PREMIUM_PLANS.map((plan) => (
          <div className="plan-card" key={plan.id}>
            <div className="plan-label">{plan.label}</div>
            <div className="plan-price">{plan.price} 🥃</div>
            <button className="btn-primary" disabled={buying === plan.id} onClick={() => buy(plan)}>
              {buying === plan.id ? "Оформлення…" : "Оформити"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
