import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Cake,
  Clock,
  CornerDownLeft,
  Crown,
  Flag,
  LayoutList,
  Lock,
  MessageSquare,
  Palette,
  Shield,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import {
  DataError,
  assertOnline,
  buyPremium,
  changePassword,
  closeReport,
  deleteAccount,
  getCurrentEmail,
  getUserProfile,
  grantPremiumFromAxioma,
  listOpenReports,
  setGlobalMute,
  setUserBlocked,
  resetChatLockWithAccountPassword,
  setMyPhone,
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
import {
  AVATAR_COLORS,
  FREE_BIO_LIMIT,
  FREE_PIN_LIMIT,
  NAME_COLORS,
  PROFILE_BANNERS,
  STATUS_EMOJIS,
  STATUS_TEXT_LIMIT,
  PREMIUM_AVATAR_COLORS,
  PREMIUM_BIO_LIMIT,
  PREMIUM_PIN_LIMIT,
  PREMIUM_REACTIONS_PER_MESSAGE,
  FREE_REACTIONS_PER_MESSAGE,
  PREMIUM_PLANS, SITE_ADMIN_USERNAME, isSiteAdmin } from "../constants";
import { PremiumPlan, PublicUser, Report, User, WalletTransaction } from "../types";
import { REPORT_REASON_LABELS } from "../utils/reports";
import Avatar from "../components/Avatar";
import AxiomaCard from "../components/AxiomaCard";
import UserProfileModal from "../components/UserProfileModal";
import { formatPhone, normalizePhone } from "../utils/phone";
import type { ConfirmationResult } from "firebase/auth";
import { auth } from "../firebase";
import { isPhoneVerified, phoneAuthError, sendLinkCode, unlinkPhone } from "../data/phone-auth";
import SmsCodeStep from "../components/SmsCodeStep";
import LockPrompt from "../components/LockPrompt";
import LockSetupModal from "../components/LockSetupModal";
import { clearChatLock } from "../data/chat-lock";
import { useChatLock } from "../context/ChatLockContext";
import {
  Accent,
  ChatBackground,
  PREMIUM_ACCENTS,
  PREMIUM_BACKGROUNDS,
  getAccent,
  setAccent,
  FontSize,
  getChatBackground,
  getFontSize,
  isCompactList,
  isEnterSends,
  setChatBackground,
  setCompactList,
  setEnterSends,
  setFontSize,
} from "../utils/prefs";

type Tab = "profile" | "appearance" | "chats" | "privacy" | "wallet" | "premium" | "account" | "reports";

interface TabProps {
  user: User;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  // The chat-list drawer can deep-link straight into a tab (wallet, premium)
  const initialTab = (location.state as { tab?: Tab } | null)?.tab;
  const [tab, setTab] = useState<Tab>(initialTab ?? "profile");
  const [tabOpened, setTabOpened] = useState(!!initialTab);
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
          <ArrowLeft size={18} className="inline-icon" /> Назад до чатів
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
            <UserIcon size={17} className="inline-icon" /> Профіль
          </button>
          <button className={tab === "appearance" ? "active" : ""} onClick={() => openTab("appearance")}>
            <Palette size={17} className="inline-icon" /> Вигляд
          </button>
          <button className={tab === "chats" ? "active" : ""} onClick={() => openTab("chats")}>
            <MessageSquare size={17} className="inline-icon" /> Чати і сповіщення
          </button>
          <button className={tab === "privacy" ? "active" : ""} onClick={() => openTab("privacy")}>
            <Shield size={17} className="inline-icon" /> Конфіденційність
          </button>
          <div className="settings-nav-divider">Гаманець і підписка</div>
          <button className={tab === "wallet" ? "active" : ""} onClick={() => openTab("wallet")}>
            <Wallet size={17} className="inline-icon" /> Гаманець · {user.grams} ГРАМ
          </button>
          <button className={tab === "premium" ? "active" : ""} onClick={() => openTab("premium")}>
            <Crown size={17} className="inline-icon" /> Преміум
          </button>
          <button className={tab === "account" ? "active" : ""} onClick={() => openTab("account")}>
            <Lock size={17} className="inline-icon" /> Акаунт
          </button>
          {isSiteAdmin(user.username) && (
            <button className={tab === "reports" ? "active" : ""} onClick={() => openTab("reports")}>
              <Flag size={17} className="inline-icon" /> 🚩 Скарги
            </button>
          )}
        </nav>
        <button className="logout-btn" onClick={() => logout()}>
          Вийти
        </button>
      </aside>

      <main className="settings-content">
        <button className="mobile-back-btn settings-mobile-back" onClick={() => setTabOpened(false)}>
          <ArrowLeft size={16} className="inline-icon" /> Налаштування
        </button>
        {tab === "profile" && <ProfileTab user={user} />}
        {tab === "appearance" && <AppearanceTab user={user} />}
        {tab === "chats" && <ChatsTab />}
        {tab === "privacy" && <PrivacyTab user={user} />}
        {tab === "wallet" && <WalletTab user={user} />}
        {tab === "premium" && <PremiumTab user={user} />}
        {tab === "account" && <AccountTab user={user} />}
        {tab === "reports" && isSiteAdmin(user.username) && <ReportsTab />}
      </main>
    </div>
  );
}

function ProfileTab({ user }: TabProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [birthDate, setBirthDate] = useState(user.birthDate ?? "");
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [emojiStatus, setEmojiStatus] = useState(user.emojiStatus ?? "");
  const [statusText, setStatusText] = useState(user.statusText ?? "");
  const [nameColor, setNameColor] = useState(user.nameColor ?? "");
  const [banner, setBanner] = useState(user.profileBanner ?? "");
  const [gifUrl, setGifUrl] = useState("");
  const [premiumHint, setPremiumHint] = useState(false);

  async function applyGifAvatar() {
    const url = gifUrl.trim();
    if (!/^https:\/\/\S+$/i.test(url)) {
      setPhotoError("Встав пряме посилання на картинку чи GIF, що починається з https://");
      return;
    }
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      await updateProfile(user.id, { avatarUrl: url });
      setAvatarUrl(url);
      setGifUrl("");
    } catch {
      setPhotoError("Не вдалося встановити аватарку");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(user.id, {
        displayName,
        bio,
        avatarColor,
        birthDate: birthDate || null,
        // premium cosmetics are only written for active premium accounts
        ...(user.isPremium
          ? {
              emojiStatus: emojiStatus || null,
              statusText: statusText.trim() || null,
              nameColor: nameColor || null,
              profileBanner: banner || null,
            }
          : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e2) {
      setError(e2 instanceof DataError ? e2.message : "Не вдалося зберегти");
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
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={user.isPremium ? PREMIUM_BIO_LIMIT : FREE_BIO_LIMIT}
          rows={3}
        />
        {!user.isPremium && <span className="settings-hint">З преміумом — до {PREMIUM_BIO_LIMIT} символів</span>}
      </label>
      <label>
        Дата народження <span className="settings-hint">(необов'язково)</span>
        <input type="date" value={birthDate} min="1900-01-01" max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirthDate(e.target.value)} />
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
        {PREMIUM_AVATAR_COLORS.map((c) => {
          const locked = !user.isPremium && c !== avatarColor;
          return (
            <button
              type="button"
              key={c}
              className={`swatch ${avatarColor === c ? "selected" : ""} ${locked ? "swatch-locked" : ""}`}
              style={{ backgroundColor: c }}
              title={locked ? "Ексклюзивний колір — потрібен преміум" : undefined}
              onClick={() => (locked ? setError("Цей колір доступний із преміумом ⭐") : setAvatarColor(c))}
            >
              {locked ? "🔒" : ""}
            </button>
          );
        })}
      </div>

      <h3>Преміум-оформлення ⭐</h3>
      {!user.isPremium && (
        <p className="settings-hint">
          Статус-емодзі, колір імені, банер профілю та анімована аватарка доступні з преміумом — дивись вкладку «Преміум».
        </p>
      )}
      <fieldset className="premium-fieldset" disabled={!user.isPremium}>
        <label>Емодзі-статус біля імені</label>
        <div className="emoji-grid">
          <button type="button" className={`emoji-cell ${!emojiStatus ? "selected" : ""}`} onClick={() => setEmojiStatus("")}>
            ∅
          </button>
          {STATUS_EMOJIS.map((e) => (
            <button type="button" key={e} className={`emoji-cell ${emojiStatus === e ? "selected" : ""}`} onClick={() => setEmojiStatus(e)}>
              {e}
            </button>
          ))}
        </div>

        <label>
          Текст статусу <span className="settings-hint">(показується в шапці приватного чату замість «в мережі»)</span>
          <input value={statusText} onChange={(e) => setStatusText(e.target.value)} maxLength={STATUS_TEXT_LIMIT} placeholder="Наприклад: на зв'язку після 18:00" />
        </label>

        <label>Колір імені в чатах</label>
        <div className="color-swatches">
          <button type="button" className={`swatch swatch-none ${!nameColor ? "selected" : ""}`} onClick={() => setNameColor("")}>
            ∅
          </button>
          {NAME_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              className={`swatch ${nameColor === c ? "selected" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => setNameColor(c)}
            />
          ))}
        </div>

        <label>Банер профілю</label>
        <div className="banner-grid">
          <button type="button" className={`banner-cell banner-none ${!banner ? "selected" : ""}`} onClick={() => setBanner("")}>
            Без банера
          </button>
          {Object.entries(PROFILE_BANNERS).map(([id, bg]) => (
            <button
              type="button"
              key={id}
              className={`banner-cell ${banner === id ? "selected" : ""}`}
              style={{ background: bg }}
              aria-label={id}
              onClick={() => setBanner(id)}
            />
          ))}
        </div>
      </fieldset>

      {user.isPremium && (
        <>
          <label>
            Анімована аватарка (GIF за посиланням)
            <input value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} placeholder="https://…/avatar.gif" />
          </label>
          <button type="button" className="btn-ghost" disabled={uploadingPhoto || !gifUrl.trim()} onClick={applyGifAvatar}>
            Поставити як аватарку
          </button>
        </>
      )}
      {error && <div className="auth-error">{error}</div>}
      <button className="btn-primary" type="submit" disabled={saving}>
        {saving ? "Збереження…" : saved ? "Збережено ✓" : "Зберегти"}
      </button>
    </form>
  );
}

function AppearanceTab({ user }: TabProps) {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("stogram_theme") ?? "dark");
  const [font, setFont] = useState<FontSize>(getFontSize);
  const [bg, setBg] = useState<ChatBackground>(getChatBackground);
  const [compact, setCompact] = useState(isCompactList);
  const [accent, setAccentState] = useState<Accent>(getAccent);
  const [premiumHint, setPremiumHint] = useState(false);
  const { installed, canPromptInstall, promptInstall, isIos, isAndroid } = useInstallPrompt();

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

      <h3>Розмір тексту в чаті</h3>
      <div className="theme-options">
        {(["s", "m", "l"] as FontSize[]).map((f) => (
          <button
            key={f}
            className={`theme-card ${font === f ? "selected" : ""}`}
            onClick={() => {
              setFont(f);
              setFontSize(f);
            }}
          >
            <span style={{ fontSize: f === "s" ? 13 : f === "m" ? 16 : 20 }}>Аа</span>
          </button>
        ))}
      </div>

      <h3>Акцентний колір ⭐</h3>
      <div className="color-swatches">
        {(["purple", "blue", "green", "orange", "pink", "red"] as Accent[]).map((a) => {
          const locked = !user.isPremium && PREMIUM_ACCENTS.includes(a);
          return (
            <button
              type="button"
              key={a}
              className={`swatch accent-swatch accent-${a} ${accent === a ? "selected" : ""} ${locked ? "swatch-locked" : ""}`}
              aria-label={a}
              onClick={() => {
                if (locked) return setPremiumHint(true);
                setPremiumHint(false);
                setAccentState(a);
                setAccent(a);
              }}
            >
              {locked ? "🔒" : ""}
            </button>
          );
        })}
      </div>

      <h3>Фон чату</h3>
      <div className="theme-options theme-options-wrap">
        {(
          [
            ["aurora", "🌌 Градієнт"],
            ["dots", "⋯ Візерунок"],
            ["plain", "▫️ Простий"],
            ["sunset", "🌅 Захід ⭐"],
            ["ocean", "🌊 Океан ⭐"],
            ["forest", "🌲 Ліс ⭐"],
          ] as [ChatBackground, string][]
        ).map(([id, label]) => {
          const locked = !user.isPremium && PREMIUM_BACKGROUNDS.includes(id);
          return (
            <button
              key={id}
              className={`theme-card ${bg === id ? "selected" : ""} ${locked ? "theme-card-locked" : ""}`}
              onClick={() => {
                if (locked) return setPremiumHint(true);
                setPremiumHint(false);
                setBg(id);
                setChatBackground(id);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {premiumHint && <p className="settings-hint">Ці варіанти доступні з преміумом — дивись вкладку «Преміум» ⭐</p>}

      <label className="switch-row">
        <span><LayoutList size={16} className="inline-icon" /> Компактний список чатів</span>
        <input
          type="checkbox"
          checked={compact}
          onChange={(e) => {
            setCompact(e.target.checked);
            setCompactList(e.target.checked);
          }}
        />
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

function ChatsTab() {
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [enterSends, setEnterSendsState] = useState(isEnterSends);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playNotificationSound();
  }

  return (
    <div className="settings-panel">
      <h2>Чати і сповіщення</h2>

      <h3>Сповіщення</h3>
      <label className="switch-row">
        <span><Bell size={16} className="inline-icon" /> Звук при новому повідомленні</span>
        <input type="checkbox" checked={soundOn} onChange={toggleSound} />
      </label>

      <h3>Надсилання</h3>
      <label className="switch-row">
        <span><CornerDownLeft size={16} className="inline-icon" /> Enter надсилає повідомлення</span>
        <input
          type="checkbox"
          checked={enterSends}
          onChange={(e) => {
            setEnterSendsState(e.target.checked);
            setEnterSends(e.target.checked);
          }}
        />
      </label>
      <p className="settings-hint">
        {enterSends
          ? "Shift+Enter — новий рядок. Надіслати можна й кнопкою."
          : "Enter — новий рядок, надсилати треба кнопкою ➤."}
      </p>

      <h3>Керування чатами</h3>
      <p className="settings-hint">
        Утримуй чат у списку (на ПК — права кнопка миші), щоб закріпити його, відправити в архів або видалити. Архів
        ховається над списком — потягни список вниз, щоб його відкрити. «Збережене» знайдеш у меню ☰.
      </p>
    </div>
  );
}

function PrivacyTab({ user }: TabProps) {
  const [hideBirth, setHideBirth] = useState(!!user.hideBirthDate);
  const [error, setError] = useState<string | null>(null);

  async function toggleBirth(next: boolean) {
    setHideBirth(next);
    setError(null);
    try {
      await updateProfile(user.id, { hideBirthDate: next });
    } catch {
      setHideBirth(!next);
      setError("Не вдалося зберегти");
    }
  }

  return (
    <div className="settings-panel">
      <h2>Конфіденційність</h2>
      <label className="switch-row">
        <span><Cake size={16} className="inline-icon" /> Ховати дату народження від інших</span>
        <input type="checkbox" checked={hideBirth} onChange={(e) => toggleBirth(e.target.checked)} />
      </label>
      <p className="settings-hint">
        Дату народження (якщо вказана) бачать усі в твоєму профілі. Увімкни, щоб вона лишалась тільки в тебе.
      </p>
      <label className="switch-row">
        <span><Clock size={16} className="inline-icon" /> Ховати, коли я був(ла) в мережі</span>
        <input
          type="checkbox"
          checked={!!user.hideLastSeen}
          onChange={(e) => updateProfile(user.id, { hideLastSeen: e.target.checked }).catch(() => setError("Не вдалося зберегти"))}
        />
      </label>
      <p className="settings-hint">Замість точного часу співрозмовники бачитимуть «був(ла) нещодавно».</p>
      {error && <div className="auth-error">{error}</div>}

      <BlockedUsers user={user} />

      <ChatLockSettings user={user} />
    </div>
  );
}

function BlockedUsers({ user }: TabProps) {
  const [people, setPeople] = useState<User[]>([]);
  const key = (user.blockedUids ?? []).join(",");

  useEffect(() => {
    let cancelled = false;
    const uids = key ? key.split(",") : [];
    Promise.all(uids.map((u) => getUserProfile(u))).then((res) => {
      if (!cancelled) setPeople(res.filter((p): p is User => !!p));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <>
      <h3>Заблоковані</h3>
      {people.length === 0 ? (
        <p className="settings-hint">Нікого не заблоковано. Заблокувати можна в профілі людини.</p>
      ) : (
        people.map((p) => (
          <div key={p.id} className="switch-row">
            <span>
              {p.displayName} <span className="settings-hint">@{p.username}</span>
            </span>
            <button type="button" className="btn-ghost" onClick={() => setUserBlocked(user.id, p.id, false)}>
              Розблокувати
            </button>
          </div>
        ))
      )}
    </>
  );
}

function ChatLockSettings({ user }: TabProps) {
  const { hasPassword, unlocked, lock, lockNow } = useChatLock();
  const [setup, setSetup] = useState(false);
  const [gate, setGate] = useState<null | "change" | "remove">(null);
  const [showReset, setShowReset] = useState(false);
  const [accountPw, setAccountPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // after the correct password is typed, run the action that was waiting
  useEffect(() => {
    if (!gate || !unlocked) return;
    if (gate === "change") setSetup(true);
    if (gate === "remove") {
      setBusy(true);
      clearChatLock(user.id)
        .then(() => setNote("Пароль прибрано, усі чати знову видимі"))
        .catch(() => setError("Не вдалося прибрати пароль"))
        .finally(() => setBusy(false));
    }
    setGate(null);
  }, [gate, unlocked, user.id]);

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await resetChatLockWithAccountPassword(accountPw, user.id);
      setShowReset(false);
      setAccountPw("");
      setNote("Пароль скинуто. Заблоковані й приховані чати знову звичайні");
    } catch (e) {
      setError(e instanceof DataError ? e.message : "Не вдалося скинути пароль");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h3>Пароль на чати</h3>
      <p className="settings-hint">
        Заблокований чат відкривається лише за паролем, прихований зникає зі списку й лежить у меню ☰ → «Приховані
        чати». Утримуй чат у списку, щоб заблокувати чи приховати. Це захист від сторонніх очей у застосунку, а не
        шифрування повідомлень.
      </p>
      <p className="settings-hint">
        {hasPassword
          ? `Пароль задано · заблоковано: ${lock.locked.length} · приховано: ${lock.hidden.length}`
          : "Пароль ще не задано — з'явиться, коли вперше заблокуєш чи приховаєш чат."}
      </p>
      {note && <div className="auth-success">{note}</div>}
      {error && <div className="auth-error">{error}</div>}

      <div className="phone-section-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => (hasPassword && !unlocked ? setGate("change") : setSetup(true))}
        >
          {hasPassword ? "Змінити пароль" : "Задати пароль"}
        </button>
        {hasPassword && (
          <>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => setGate("remove")}>
              Прибрати пароль
            </button>
            {unlocked && (
              <button type="button" className="btn-ghost" onClick={lockNow}>
                Заблокувати зараз
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={() => setShowReset((v) => !v)}>
              Забув пароль
            </button>
          </>
        )}
      </div>

      {showReset && (
        <div className="phone-section">
          <p className="settings-hint">
            Введи пароль від акаунта, щоб скинути пароль на чати. Усі блокування й приховування буде знято.
          </p>
          <input type="password" value={accountPw} onChange={(e) => setAccountPw(e.target.value)} placeholder="Пароль акаунта" />
          <button type="button" className="btn-primary" disabled={busy || !accountPw} onClick={reset}>
            Скинути
          </button>
        </div>
      )}

      {gate && !unlocked && (
        <div className="modal-overlay" onClick={() => setGate(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <LockPrompt onCancel={() => setGate(null)} />
          </div>
        </div>
      )}
      {setup && (
        <LockSetupModal
          onClose={() => setSetup(false)}
          onDone={() => {
            setSetup(false);
            setNote("Пароль збережено");
          }}
        />
      )}
    </>
  );
}

const TRANSFER_PRESETS = [10, 50, 100, 250];

function WalletTab({ user }: TabProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
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

      <button type="button" className="history-toggle" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen}>
        <span>Історія{transactions.length > 0 ? ` · ${transactions.length}` : ""}</span>
        <span className={`history-chevron ${historyOpen ? "open" : ""}`}>▾</span>
      </button>
      <div className="tx-list">
        {historyOpen && transactions.length === 0 && <div className="empty-hint">Ще немає транзакцій</div>}
        {(historyOpen ? transactions : []).map((t) => (
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
      assertOnline(); // before the card is charged, not after
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
        <li>⭐ Золота рамка й зірка на аватарці — тебе видно в кожному чаті</li>
        <li>🎨 5 акцентних кольорів інтерфейсу замість одного</li>
        <li>🌅 Преміум-фони чату: захід, океан, ліс</li>
        <li>📌 До {PREMIUM_PIN_LIMIT} закріплених чатів (у безкоштовних — {FREE_PIN_LIMIT})</li>
        <li>😎 Емодзі-статус біля імені й текст статусу</li>
        <li>🌈 Колір імені та градієнтний банер профілю</li>
        <li>🎞 Анімована GIF-аватарка</li>
        <li>💬 Реакції на повідомлення: 14 ексклюзивних і до {PREMIUM_REACTIONS_PER_MESSAGE} на повідомлення (замість {FREE_REACTIONS_PER_MESSAGE})</li>
        <li>🖍 6 ексклюзивних кольорів аватара</li>
        <li>✍️ «Про себе» до {PREMIUM_BIO_LIMIT} символів (замість {FREE_BIO_LIMIT})</li>
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

function PhoneSection({ user }: TabProps) {
  const [phone, setPhone] = useState(user.phone ? formatPhone(user.phone) : "");
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [editing, setEditing] = useState(!user.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const digits = normalizePhone(phone);
  const verified = isPhoneVerified(user.phone);

  async function sendCode() {
    if (!digits) return setError("Вкажи номер, наприклад +380 67 123 45 67");
    setError(null);
    setBusy(true);
    try {
      // one verified number per account: detach the old one first
      if (auth.currentUser?.phoneNumber && auth.currentUser.phoneNumber !== "+" + digits) await unlinkPhone();
      confirmation.current = await sendLinkCode(digits, recaptchaRef.current!);
      setStep("code");
    } catch (err) {
      setError(phoneAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCode(code: string) {
    if (!confirmation.current || !digits) return;
    setError(null);
    setBusy(true);
    try {
      await confirmation.current.confirm(code);
      await setMyPhone(user.id, user.phone ?? null, digits);
      setStep("idle");
      setEditing(false);
      bump((n) => n + 1);
    } catch (err) {
      setError(phoneAuthError(err, "Невірний код"));
    } finally {
      setBusy(false);
    }
  }

  // Saving the number without SMS confirmation (it stays "not confirmed")
  async function saveUnverified() {
    if (!digits) return setError("Вкажи номер, наприклад +380 67 123 45 67");
    setError(null);
    setBusy(true);
    try {
      if (auth.currentUser?.phoneNumber && auth.currentUser.phoneNumber !== "+" + digits) await unlinkPhone();
      await setMyPhone(user.id, user.phone ?? null, digits);
      setEditing(false);
      bump((n) => n + 1);
    } catch (err) {
      setError(phoneAuthError(err, "Не вдалося зберегти номер"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Прибрати номер телефону з акаунта? Вхід за SMS перестане працювати.")) return;
    setBusy(true);
    setError(null);
    try {
      await unlinkPhone();
      await setMyPhone(user.id, user.phone ?? null, null);
      setPhone("");
      setEditing(true);
    } catch (err) {
      setError(phoneAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="phone-section">
      <div className="phone-section-title">Номер телефону</div>
      {step === "code" && digits ? (
        <SmsCodeStep phone={digits} busy={busy} error={error} onSubmit={onCode} onResend={sendCode} onBack={() => setStep("idle")} />
      ) : editing ? (
        <>
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380 67 123 45 67" />
          <p className="settings-hint">
            Номер можна просто зберегти, а можна підтвердити SMS-кодом — тоді працює вхід за номером.
          </p>
          {error && <div className="auth-error">{error}</div>}
          <div className="phone-section-actions">
            <button type="button" className="btn-primary" onClick={saveUnverified} disabled={busy || !digits}>
              Зберегти
            </button>
            <button type="button" className="btn-ghost" onClick={sendCode} disabled={busy || !digits}>
              {busy ? "Надсилаємо…" : "Підтвердити SMS"}
            </button>
            {user.phone && (
              <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setPhone(formatPhone(user.phone!)); setError(null); }}>
                Скасувати
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="phone-current">
            {user.phone ? formatPhone(user.phone) : "—"}{" "}
            <span className={verified ? "phone-badge ok" : "phone-badge"}>{verified ? "✓ підтверджено" : "не підтверджено"}</span>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="phone-section-actions">
            {!verified && (
              <button type="button" className="btn-primary" onClick={sendCode} disabled={busy}>
                Підтвердити
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)} disabled={busy}>
              Змінити
            </button>
            <button type="button" className="btn-ghost" onClick={remove} disabled={busy}>
              Прибрати
            </button>
          </div>
        </>
      )}
      <div ref={recaptchaRef} />
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOpenReports()
      .then(async (list) => {
        const uids = [...new Set(list.flatMap((r) => [r.reporterUid, r.targetUid]))];
        const profiles = await Promise.all(uids.map((u) => getUserProfile(u).catch(() => null)));
        if (cancelled) return;
        setNames(Object.fromEntries(uids.map((u, i) => [u, profiles[i] ? `${profiles[i]!.displayName} (@${profiles[i]!.username})` : u])));
        setMuted(Object.fromEntries(uids.map((u, i) => [u, !!profiles[i]?.mutedGlobally])));
        setReports(list);
      })
      .catch(() => !cancelled && setError("Не вдалося завантажити скарги"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function close(id: string) {
    setError(null);
    try {
      await closeReport(id);
      setReports((prev) => prev?.filter((r) => r.id !== id) ?? prev);
    } catch {
      setError("Не вдалося закрити скаргу");
    }
  }

  async function mute(uid: string) {
    setError(null);
    try {
      await setGlobalMute(uid, true);
      setMuted((prev) => ({ ...prev, [uid]: true }));
    } catch {
      setError("Не вдалося замутити");
    }
  }

  return (
    <div className="settings-panel">
      <h2>🚩 Скарги</h2>
      {error && <div className="auth-error">{error}</div>}
      {!reports && !error && <p className="settings-hint">Завантаження…</p>}
      {reports && reports.length === 0 && <p className="settings-hint">Відкритих скарг немає 🎉</p>}
      {reports?.map((r) => (
        <div className="report-item" key={r.id}>
          <div>
            <b>{REPORT_REASON_LABELS[r.reason]}</b> · на {names[r.targetUid] ?? r.targetUid}
          </div>
          <div className="settings-hint">
            від {names[r.reporterUid] ?? r.reporterUid} · {new Date(r.createdAt).toLocaleString("uk-UA")}
          </div>
          {r.messageText && <blockquote className="report-snapshot">{r.messageText}</blockquote>}
          {r.comment && <div>💬 {r.comment}</div>}
          <div className="report-item-actions">
            <button type="button" className="btn-ghost" onClick={() => close(r.id)}>
              Закрити
            </button>
            <button type="button" className="btn-ghost" disabled={muted[r.targetUid]} onClick={() => mute(r.targetUid)}>
              {muted[r.targetUid] ? "🔇 Замучено" : "🔇 Замутити глобально"}
            </button>
          </div>
        </div>
      ))}
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
      await deleteAccount(deletePassword, user.id, user.username.toLowerCase(), user.phone);
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

      <PhoneSection user={user} />

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
            <span><Crown size={16} className="inline-icon" /> Показувати бейдж адміністратора</span>
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
