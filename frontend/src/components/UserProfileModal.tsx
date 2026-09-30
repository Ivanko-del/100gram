import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, setGlobalMute, setUserBadge, startDirectChat, setUserBlocked } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { BADGE_COLORS, PROFILE_BANNERS, isSiteAdmin } from "../constants";
import { User } from "../types";
import Avatar from "./Avatar";
import UserName from "./UserName";

interface Props {
  uid: string;
  onClose: () => void;
}

export default function UserProfileModal({ uid, onClose }: Props) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const [badgeText, setBadgeText] = useState("");
  const [badgeColor, setBadgeColor] = useState(BADGE_COLORS[0]);
  const [savingBadge, setSavingBadge] = useState(false);
  const [mutingGlobal, setMutingGlobal] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getUserProfile(uid).then((p) => {
      if (!cancelled) {
        setProfile(p);
        setBadgeText(p?.badge?.text ?? "");
        setBadgeColor(p?.badge?.color ?? BADGE_COLORS[0]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function message() {
    if (!me || !profile) return;
    setStarting(true);
    try {
      const chatId = await startDirectChat(me, profile.username);
      onClose();
      navigate(`/chat/${chatId}`);
    } finally {
      setStarting(false);
    }
  }

  async function saveBadge(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setAdminError(null);
    setSavingBadge(true);
    try {
      await setUserBadge(profile.id, badgeText.trim() ? { text: badgeText.trim(), color: badgeColor } : null);
    } catch {
      setAdminError("Не вдалося зберегти бейдж");
    } finally {
      setSavingBadge(false);
    }
  }

  async function toggleGlobalMute() {
    if (!profile) return;
    setAdminError(null);
    setMutingGlobal(true);
    try {
      await setGlobalMute(profile.id, !profile.mutedGlobally);
      setProfile({ ...profile, mutedGlobally: !profile.mutedGlobally });
    } catch {
      setAdminError("Не вдалося змінити заглушення");
    } finally {
      setMutingGlobal(false);
    }
  }

  const isSelf = me?.id === uid;
  const viewerIsSiteAdmin = isSiteAdmin(me?.username);
  const profileIsSiteAdmin = !!profile && isSiteAdmin(profile.username);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card profile-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Профіль</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        {loading && <p className="settings-hint">Завантаження…</p>}
        {!loading && !profile && <p className="settings-hint">Користувача не знайдено</p>}

        {profile && (
          <>
            {profile.isPremium && profile.profileBanner && PROFILE_BANNERS[profile.profileBanner] && (
              <div className="profile-banner" style={{ background: PROFILE_BANNERS[profile.profileBanner] }} />
            )}
            <div className={`profile-card-identity ${profile.isPremium && profile.profileBanner ? "with-banner" : ""}`}>
              <Avatar name={profile.displayName} color={profile.avatarColor} photoUrl={profile.avatarUrl} size={72} isPremium={profile.isPremium} />
              <div className="settings-profile-name">
                <UserName
                  name={profile.displayName}
                  emoji={profile.isPremium ? profile.emojiStatus : null}
                  color={profile.isPremium ? profile.nameColor : null}
                />
              </div>
              {profile.isPremium && profile.statusText && <div className="profile-status-text">{profile.statusText}</div>}
              <div className="settings-profile-username">@{profile.username}</div>
              <div className="profile-badges">
                {profile.isPremium && (
                  <div className="premium-chip">
                    ⭐ Преміум{profile.premiumUntil ? ` до ${new Date(profile.premiumUntil).toLocaleDateString("uk-UA")}` : ""}
                  </div>
                )}
                {profileIsSiteAdmin && profile.showAdminBadge && <div className="user-badge admin-site-badge">👑 Адміністратор</div>}
                {profile.badge && (
                  <div className="user-badge" style={{ background: profile.badge.color }}>
                    {profile.badge.text}
                  </div>
                )}
                {profile.mutedGlobally && <div className="user-badge muted-badge">🔇 Заглушено</div>}
              </div>
            </div>

            {profile.bio && <p className="profile-card-bio">{profile.bio}</p>}
            {profile.birthDate && (isSelf || !profile.hideBirthDate) && (
              <p className="profile-card-bio">🎂 {new Date(profile.birthDate + "T00:00:00").toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}</p>
            )}

            {!isSelf && (
              <button className="btn-primary" onClick={message} disabled={starting}>
                {starting ? "Відкриття…" : "✉️ Написати повідомлення"}
              </button>
            )}
            {!isSelf && me && (
              <button
                className="btn-ghost"
                onClick={() => setUserBlocked(me.id, profile.id, !(me.blockedUids ?? []).includes(profile.id))}
              >
                {(me.blockedUids ?? []).includes(profile.id) ? "✅ Розблокувати" : "🚫 Заблокувати"}
              </button>
            )}

            {viewerIsSiteAdmin && (
              <div className="admin-controls">
                <h3>Керування (адмін)</h3>
                <button type="button" className="btn-ghost" disabled={mutingGlobal} onClick={toggleGlobalMute}>
                  {profile.mutedGlobally ? "🔊 Зняти глобальне заглушення" : "🔇 Заглушити глобально"}
                </button>

                <form className="badge-form" onSubmit={saveBadge}>
                  <label>
                    Бейдж (текст, порожньо - прибрати)
                    <input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} maxLength={24} placeholder="Модератор" />
                  </label>
                  <div className="color-swatches">
                    {BADGE_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        className={`swatch ${badgeColor === c ? "selected" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setBadgeColor(c)}
                      />
                    ))}
                  </div>
                  <button className="btn-primary" type="submit" disabled={savingBadge}>
                    {savingBadge ? "Збереження…" : "Зберегти бейдж"}
                  </button>
                </form>
                {adminError && <div className="auth-error">{adminError}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
