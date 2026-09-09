import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PremiumPlan, User, WalletTransaction } from "../types";
import Avatar from "../components/Avatar";

type Tab = "profile" | "wallet" | "premium" | "appearance";

const COLORS = ["#6ab2f2", "#e17076", "#8774e1", "#54cb68", "#f0a72a", "#faa774", "#c650a1"];

interface TabProps {
  user: User;
  updateUserLocal: (patch: Partial<User>) => void;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateUserLocal, logout } = useAuth();
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
        <button className="logout-btn" onClick={logout}>
          Вийти
        </button>
      </aside>

      <main className="settings-content">
        {tab === "profile" && <ProfileTab user={user} updateUserLocal={updateUserLocal} />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "wallet" && <WalletTab user={user} updateUserLocal={updateUserLocal} />}
        {tab === "premium" && <PremiumTab user={user} updateUserLocal={updateUserLocal} />}
      </main>
    </div>
  );
}

function ProfileTab({ user, updateUserLocal }: TabProps) {
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
      const updated = await api.patch<User>("/users/me", { displayName, bio, avatarColor });
      updateUserLocal(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Не вдалося зберегти");
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
        {COLORS.map((c) => (
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
    </div>
  );
}

function WalletTab({ user, updateUserLocal }: TabProps) {
  const [data, setData] = useState<{ grams: number; transactions: WalletTransaction[] } | null>(null);
  const [toUsername, setToUsername] = useState("");
  const [amount, setAmount] = useState(50);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    const res = await api.get<{ grams: number; transactions: WalletTransaction[] }>("/wallet");
    setData(res);
    updateUserLocal({ grams: res.grams });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onTransfer(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.post("/wallet/transfer", { username: toUsername.trim(), amount, note: note.trim() || undefined });
      setToUsername("");
      setNote("");
      setAmount(50);
      await load();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Не вдалося переказати");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="settings-panel">
      <h2>Гаманець</h2>
      <div className="wallet-balance">
        <span className="wallet-balance-amount">{data?.grams ?? user.grams}</span>
        <span className="wallet-balance-label">ГРАМ 🥃</span>
      </div>

      <form className="transfer-form" onSubmit={onTransfer}>
        <h3>Переказати друзу</h3>
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
        {(data?.transactions.length ?? 0) === 0 && <div className="empty-hint">Ще немає транзакцій</div>}
        {data?.transactions.map((t) => (
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

function PremiumTab({ user, updateUserLocal }: TabProps) {
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.get<PremiumPlan[]>("/premium/plans").then(setPlans);
  }, []);

  async function buy(plan: PremiumPlan) {
    setBuying(plan.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post<{ isPremium: boolean; premiumUntil: string; grams: number }>(
        "/premium/subscribe",
        { planId: plan.id }
      );
      updateUserLocal({ isPremium: res.isPremium, premiumUntil: res.premiumUntil, grams: res.grams });
      setSuccess(`Преміум активовано до ${new Date(res.premiumUntil).toLocaleDateString("uk-UA")}`);
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Не вдалося оформити преміум");
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
        {plans.map((plan) => (
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
