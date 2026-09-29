import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DataError,
  buyPremium,
  changePassword,
  deleteAccount,
  getCurrentEmail,
  grantPremiumFromAxioma,
  searchUsers,
  startDirectChat,
  subscribeTransactions,
  transferGrams,
  updateProfile,
} from "../data/firestore-api";
import { AXIOMA_EXCHANGE_RATE, AxiomaError, withdrawFromAxioma } from "../axioma";
import { useAuth } from "../context/AuthContext";
import { useAxioma } from "../hooks/useAxioma";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { compressImageToDataUrl } from "../utils/image";
import { isSoundEnabled, playNotificationSound, setSoundEnabled } from "../utils/sound";
import { AVATAR_COLORS, PREMIUM_PLANS, SITE_ADMIN_USERNAME, isSiteAdmin } from "../constants";
import { PremiumPlan, PublicUser, User, WalletTransaction } from "../types";
import Avatar from "../components/Avatar";
import AxiomaCard from "../components/AxiomaCard";
import UserProfileModal from "../components/UserProfileModal";

type Tab = "profile" | "wallet" | "premium" | "appearance" | "account";

interface TabProps {
  user: User;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [tabOpened, setTabOpened] = useState(false);
  const [showOwnProfile, setShowOwnProfile] = useState(false);

  if (!user) return null;

  function openTab(next: Tab) {
    setTab(next);
    setTabOpened(true);
  }

  return (
    <div className={`settings-layout ${tabOpened ? "mobile-show-detail" : ""}`}>
      <aside className="settings-nav">
        <button className="icon-btn back-btn" onClick={() => navigate("/")}>
          ← Назад до чатів
        </button>
        <button type="button" className="settings-profile-preview" onClick={() => setShowOwnProfile(true)}>
          <Avatar name={user.displayName} color={user.avatarColor} photoUrl={user.avatarUrl} size={72} isPremium={user.isPremium} />
          <div className="settings-profile-name">{user.displayName}</div>
          <div className="settings-profile-username">@{user.username}</div>
          {user.isPremium && <div className="premium-chip">⭐ Преміум активний</div>}
        </button>
        {showOwnProfile && <UserProfileModal uid={user.id} onClose={() => setShowOwnProfile(false)} />}
        <nav>
          <button className={tab === "profile" ? "active" : ""} onClick={() => openTab("profile")}>
            👤 Профіль
          </button>
          <button className={tab === "appearance" ? "active" : ""} onClick={() => openTab("appearance")}>
            🎨 Вигляд
          </button>
          <button className={tab === "wallet" ? "active" : ""} onClick={() => openTab("wallet")}>
            🥃 Гаманець · {user.grams} ГРАМ
          </button>
          <button className={tab === "premium" ? "active" : ""} onClick={() => openTab("premium")}>
            ⭐ Преміум
          </button>
          <button className={tab === "account" ? "active" : ""} onClick={() => openTab("account")}>
            🔒 Акаунт
          </button>
        </nav>
        <button className="logout-btn" onClick={() => logout()}>
          Вийти
        </button>
      </aside>

      <main className="settings-content">
        <button className="mobile-back-btn settings-mobile-back" onClick={() => setTabOpened(false)}>
          ← Налаштування
        </button>
        {tab === "profile" && <ProfileTab user={user} />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "wallet" && <WalletTab user={user} />}
        {tab === "premium" && <PremiumTab user={user} />}
        {tab === "account" && <AccountTab user={user} />}
      </main>
    </div>
  );
}

function ProfileTab({ user }: TabProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

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

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 160, 0.7, 250_000);
      await updateProfile(user.id, { avatarUrl: dataUrl });
      setAvatarUrl(dataUrl);
    } catch (err) {
      setPhotoError(err instanceof DataError ? err.message : "Не вдалося завантажити фото");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onRemovePhoto() {
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      await updateProfile(user.id, { avatarUrl: null });
      setAvatarUrl(null);
    } catch {
      setPhotoError("Не вдалося прибрати фото");
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <form className="settings-panel" onSubmit={onSave}>
      <h2>Профіль</h2>

      <div className="avatar-photo-picker">
        <Avatar name={displayName || "?"} color={avatarColor} photoUrl={avatarUrl} size={88} isPremium={user.isPremium} />
        <div className="avatar-photo-actions">
          <label className="btn-ghost avatar-upload-btn">
            {uploadingPhoto ? "Завантаження…" : avatarUrl ? "Змінити фото" : "Додати фото"}
            <input type="file" accept="image/*" hidden disabled={uploadingPhoto} onChange={onPickPhoto} />
          </label>
          {avatarUrl && (
            <button type="button" className="btn-ghost" disabled={uploadingPhoto} onClick={onRemovePhoto}>
              Прибрати фото
            </button>
          )}
        </div>
      </div>
      {photoError && <div className="auth-error">{photoError}</div>}

      <label>
        Ім'я
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={48} />
      </label>
      <label>
        Про себе
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} />
      </label>
      <label>Колір аватара {avatarUrl && <span className="settings-hint">(видно, коли немає фото)</span>}</label>
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
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const { installed, canPromptInstall, promptInstall, isIos, isAndroid } = useInstallPrompt();

  function applyTheme(next: string) {
    setTheme(next);
    localStorage.setItem("stogram_theme", next);
    document.documentElement.dataset.theme = next;
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playNotificationSound();
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

      <h3>Сповіщення</h3>
      <label className="switch-row">
        <span>🔔 Звук при новому повідомленні</span>
        <input type="checkbox" checked={soundOn} onChange={toggleSound} />
      </label>

      <h3>Застосунок на телефон і ПК</h3>
      {installed ? (
        <p className="settings-hint">✓ Уже встановлено як застосунок на цьому пристрої</p>
      ) : (
        <>
          {canPromptInstall && (
            <>
              <p className="settings-hint">
                Постав 100 ГРАМ як застосунок — окрема іконка, вікно без адресного рядка, працює офлайн.
              </p>
              <button className="btn-primary" style={{ width: "fit-content" }} onClick={promptInstall}>
                📲 Встановити застосунок
              </button>
            </>
          )}
          {/* Chrome/Edge only fire the auto-prompt after some engagement
              (repeat visits, time on page), so a manual path that always
              works matters more than the button above. */}
          <ol className="install-steps">
            {isIos ? (
              <>
                <li>Натисни «Поділитися» ⬆️ внизу екрана Safari</li>
                <li>Обери «На екран «Додому»»</li>
              </>
            ) : isAndroid ? (
              <>
                <li>Натисни ⋮ (три крапки) у верхньому правому куті браузера</li>
                <li>Обери «Додати на головний екран» або «Встановити застосунок»</li>
              </>
            ) : (
              <>
                <li>У Chrome/Edge знайди значок встановлення ⊕ праворуч в адресному рядку</li>
                <li>Або відкрий меню ⋮ → «Встановити 100 ГРАМ…»</li>
              </>
            )}
          </ol>
        </>
      )}
    </div>
  );
}

const TRANSFER_PRESETS = [10, 50, 100, 250];

function WalletTab({ user }: TabProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [recipient, setRecipient] = useState<PublicUser | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState(50);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeTransactions(user.id, setTransactions);
    return unsub;
  }, [user.id]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        setResults(await searchUsers(q, user.id));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, user.id]);

  async function onTransfer(e: FormEvent) {
    e.preventDefault();
    if (!recipient) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      await transferGrams(user.id, user.username, recipient.username, amount, note.trim() || null);
      setSuccess(`Переказано ${amount} ГРАМ користувачу @${recipient.username} ✓`);
      setRecipient(null);
      setQuery("");
      setNote("");
      setAmount(50);
      setTimeout(() => setSuccess(null), 3000);
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

        {recipient ? (
          <div className="transfer-recipient-chip">
            <Avatar name={recipient.displayName} color={recipient.avatarColor} photoUrl={recipient.avatarUrl} size={32} isPremium={recipient.isPremium} />
            <div>
              <div className="chat-name">{recipient.displayName}</div>
              <div className="chat-list-item-bottom">@{recipient.username}</div>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setRecipient(null)}>
              Змінити
            </button>
          </div>
        ) : (
          <label>
            Кому переказати
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ім'я або @username"
              autoComplete="off"
            />
          </label>
        )}

        {!recipient && query.trim().length >= 2 && (
          <div className="search-results transfer-search-results">
            {searching && <div className="search-results-title">Пошук…</div>}
            {!searching && results.length === 0 && <div className="empty-hint">Нікого не знайдено</div>}
            {results.map((u) => (
              <button
                type="button"
                className="chat-list-item"
                key={u.id}
                onClick={() => {
                  setRecipient(u);
                  setQuery("");
                  setResults([]);
                }}
              >
                <Avatar name={u.displayName} color={u.avatarColor} photoUrl={u.avatarUrl} isPremium={u.isPremium} />
                <div className="chat-list-item-body">
                  <div className="chat-list-item-top">
                    <span className="chat-name">{u.displayName}</span>
                  </div>
                  <div className="chat-list-item-bottom">@{u.username}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <label>
          Сума
          <div className="topup-presets">
            {TRANSFER_PRESETS.map((v) => (
              <button
                type="button"
                key={v}
                className={`plan-card topup-preset ${amount === v ? "selected" : ""}`}
                onClick={() => setAmount(v)}
              >
                {v} 🥃
              </button>
            ))}
          </div>
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
        {success && <div className="auth-success">{success}</div>}
        <button className="btn-primary" type="submit" disabled={sending || !recipient}>
          {sending ? "Надсилання…" : "Переказати"}
        </button>
      </form>

      <AxiomaCard user={user} />

      <h3>Історія</h3>
      <div className="tx-list">
        {transactions.length === 0 && <div className="empty-hint">Ще немає транзакцій</div>}
        {transactions.map((t) => (
          <div key={t.id} className="tx-row">
            <div className="tx-icon">
              {t.type === "premium_purchase" || t.type === "premium_purchase_axioma"
                ? "⭐"
                : t.type === "welcome_bonus"
                  ? "🎁"
                  : t.type === "axioma_topup"
                    ? "💳"
                    : t.direction === "in"
                      ? "⬇️"
                      : "⬆️"}
            </div>
            <div className="tx-body">
              <div className="tx-title">
                {t.type === "welcome_bonus"
                  ? "Вітальний бонус"
                  : t.type === "premium_purchase" || t.type === "premium_purchase_axioma" || t.type === "axioma_topup"
                    ? t.note ?? "Покупка преміум"
                    : t.direction === "in"
                      ? `Від @${t.counterparty.username}`
                      : `Для @${t.counterparty.username}`}
              </div>
              <div className="tx-date">{new Date(t.createdAt).toLocaleString("uk-UA")}</div>
            </div>
            {t.amount !== 0 && (
              <div className={`tx-amount ${t.amount >= 0 ? "positive" : "negative"}`}>
                {t.amount >= 0 ? "+" : ""}
                {t.amount}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PremiumTab({ user }: TabProps) {
  const { linked: axiomaLinked } = useAxioma();
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

  async function buyWithAxioma(plan: PremiumPlan) {
    setBuying(plan.id + ":axioma");
    setError(null);
    setSuccess(null);
    try {
      await withdrawFromAxioma(plan.price / AXIOMA_EXCHANGE_RATE, `Преміум 100 ГРАМ: ${plan.label}`);
      await grantPremiumFromAxioma(user.id, plan);
      setSuccess(`Преміум активовано карткою Аксіоми: ${plan.label} ✓`);
    } catch (e2) {
      setError(e2 instanceof AxiomaError || e2 instanceof DataError ? e2.message : "Не вдалося оплатити карткою Аксіоми");
    } finally {
      setBuying(null);
    }
  }

  const bestValueId = PREMIUM_PLANS[PREMIUM_PLANS.length - 1]?.id;
  const planIcons: Record<string, string> = { "1m": "🚀", "6m": "💎", "12m": "👑" };

  return (
    <div className="settings-panel">
      <div className="premium-hero">
        <div className="premium-hero-crown">👑</div>
        <h2>100 ГРАМ Преміум</h2>
        <p>Виділяйся, отримуй бонуси і підтримуй розробку застосунку</p>
      </div>

      <ul className="premium-features">
        <li>🚀 Швидша доставка повідомлень</li>
        <li>⭐ Значок преміум біля імені</li>
        <li>🎨 Ексклюзивні кольори аватара</li>
        <li>📎 Більший ліміт повідомлень</li>
        <li>🥃 +10% бонус до подарункових ГРАМів</li>
      </ul>

      {user.isPremium && user.premiumUntil && (
        <div className="premium-chip premium-chip-active">
          👑 Активний до {new Date(user.premiumUntil).toLocaleDateString("uk-UA")}
        </div>
      )}
      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      <div className="premium-plans">
        {PREMIUM_PLANS.map((plan) => (
          <div className={`plan-card ${plan.id === bestValueId ? "best-value" : ""}`} key={plan.id}>
            {plan.id === bestValueId && <div className="plan-badge">Найвигідніше</div>}
            <div className="plan-icon">{planIcons[plan.id] ?? "⭐"}</div>
            <div className="plan-label">{plan.label}</div>
            <div className="plan-price">{plan.price} 🥃</div>
            <button className="btn-primary" disabled={!!buying} onClick={() => buy(plan)}>
              {buying === plan.id ? "Оформлення…" : "Оформити за ГРАМи"}
            </button>
            {axiomaLinked && (
              <button className="btn-ghost" disabled={!!buying} onClick={() => buyWithAxioma(plan)}>
                {buying === plan.id + ":axioma" ? "Оплата…" : `💳 ${plan.price / AXIOMA_EXCHANGE_RATE} ₴ Аксіомою`}
              </button>
            )}
          </div>
        ))}
      </div>
      {!axiomaLinked && (
        <p className="settings-hint">
          Прив'яжи картку Аксіоми в Гаманці, щоб платити преміум напряму нею.
        </p>
      )}
    </div>
  );
}

function AccountTab({ user }: TabProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const email = getCurrentEmail();
  const isMeSiteAdmin = isSiteAdmin(user.username);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [startingSupport, setStartingSupport] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  const [showAdminBadge, setShowAdminBadge] = useState(!!user.showAdminBadge);
  const [savingAdminBadge, setSavingAdminBadge] = useState(false);

  async function openSupport() {
    setSupportError(null);
    setStartingSupport(true);
    try {
      const chatId = await startDirectChat(user, SITE_ADMIN_USERNAME);
      navigate(`/chat/${chatId}`);
    } catch (err) {
      setSupportError(err instanceof DataError ? err.message : "Не вдалося відкрити підтримку");
    } finally {
      setStartingSupport(false);
    }
  }

  async function toggleAdminBadge() {
    const next = !showAdminBadge;
    setShowAdminBadge(next);
    setSavingAdminBadge(true);
    try {
      await updateProfile(user.id, { showAdminBadge: next });
    } finally {
      setSavingAdminBadge(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    if (newPassword.length < 6) {
      setPwError("Новий пароль — мінімум 6 символів");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    } catch (err) {
      setPwError(err instanceof DataError ? err.message : "Не вдалося змінити пароль");
    } finally {
      setPwSaving(false);
    }
  }

  async function onDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount(deletePassword, user.id, user.username.toLowerCase());
      // Firebase Auth signs the user out as part of deleting them; this
      // just clears any local state on our side too.
      await logout().catch(() => {});
    } catch (err) {
      setDeleteError(err instanceof DataError ? err.message : "Не вдалося видалити акаунт");
      setDeleting(false);
    }
  }

  return (
    <div className="settings-panel">
      <h2>Акаунт</h2>

      <label>
        Email
        <input value={email ?? ""} disabled />
      </label>

      {!isMeSiteAdmin && (
        <div>
          <button className="btn-ghost" type="button" onClick={openSupport} disabled={startingSupport}>
            {startingSupport ? "Відкриття…" : "🆘 Підтримка"}
          </button>
          {supportError && <div className="auth-error">{supportError}</div>}
        </div>
      )}

      {isMeSiteAdmin && (
        <div className="admin-controls">
          <h3>Адмін-панель</h3>
          <label className="switch-row">
            <span>👑 Показувати бейдж адміністратора</span>
            <input type="checkbox" checked={showAdminBadge} onChange={toggleAdminBadge} disabled={savingAdminBadge} />
          </label>
        </div>
      )}

      <form onSubmit={onChangePassword}>
        <h3 style={{ marginTop: 4 }}>Змінити пароль</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label>
            Поточний пароль
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label>
            Новий пароль
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Мінімум 6 символів"
              autoComplete="new-password"
            />
          </label>
          {pwError && <div className="auth-error">{pwError}</div>}
          <button className="btn-primary" type="submit" disabled={pwSaving || !currentPassword || !newPassword}>
            {pwSaving ? "Збереження…" : pwSaved ? "Пароль змінено ✓" : "Змінити пароль"}
          </button>
        </div>
      </form>

      <div className="danger-zone">
        <h3 style={{ marginTop: 0 }}>Небезпечна зона</h3>
        {!showDelete ? (
          <button className="btn-danger" type="button" onClick={() => setShowDelete(true)}>
            Видалити акаунт
          </button>
        ) : (
          <form onSubmit={onDeleteAccount} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p className="settings-hint">
              Акаунт і профіль зникнуть назавжди. Введи пароль, щоб підтвердити.
            </p>
            <label>
              Пароль
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {deleteError && <div className="auth-error">{deleteError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-danger" type="submit" disabled={deleting || !deletePassword}>
                {deleting ? "Видалення…" : "Так, видалити назавжди"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setShowDelete(false)} disabled={deleting}>
                Скасувати
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
