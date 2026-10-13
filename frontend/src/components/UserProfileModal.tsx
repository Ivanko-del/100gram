import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataError, getUserProfile, grantSubscription, revokeSubscription, setGlobalMute, setSiteRole, setUserBadge, startDirectChat, setUserBlocked } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { BADGE_COLORS, PROFILE_BANNERS, TIER_META, isSiteAdmin, isStaff } from "../constants";
import { PremiumTier, User } from "../types";
import Avatar from "./Avatar";
import UserName from "./UserName";
import ReportModal from "./ReportModal";

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
  const [reporting, setReporting] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [badgeText, setBadgeText] = useState("");
  const [badgeColor, setBadgeColor] = useState(BADGE_COLORS[0]);
  const [savingBadge, setSavingBadge] = useState(false);
  const [mutingGlobal, setMutingGlobal] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [subTier, setSubTier] = useState<PremiumTier>("premium");
  const [subDays, setSubDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getUserProfile(uid)
      .catch(() => null)
      .then((p) => {
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
    setMessageError(null);
    try {
      const chatId = await startDirectChat(me, profile.username);
      onClose();
      navigate(`/chat/${chatId}`);
    } catch (err) {
      setMessageError(err instanceof DataError ? err.message : "Не вдалося відкрити чат");
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

  async function runAdminAction(action: () => Promise<void>, patch: Partial<User>, failMsg: string) {
    if (!profile) return;
    setAdminError(null);
    setAdminBusy(true);
    try {
      await action();
      setProfile({ ...profile, ...patch });
    } catch {
      setAdminError(failMsg);
    } finally {
      setAdminBusy(false);
    }
  }

  function giveSubscription() {
    if (!profile) return;
    const base = profile.isPremium && profile.premiumUntil ? new Date(profile.premiumUntil) : new Date();
    const stacked = new Date(Math.max(base.getTime(), Date.now()) + subDays * 24 * 60 * 60 * 1000);
    return runAdminAction(
      () => grantSubscription(profile.id, subTier, subDays),
      { isPremium: true, premiumTier: subTier, premiumUntil: stacked.toISOString() },
      "Не вдалося видати підписку"
    );
  }

  function takeSubscription() {
    if (!profile) return;
    return runAdminAction(
      () => revokeSubscription(profile.id),
      { isPremium: false, premiumTier: null, premiumUntil: null },
      "Не вдалося забрати підписку"
    );
  }

  function toggleModerator() {
    if (!profile) return;
    const next = profile.siteRole === "moderator" ? null : "moderator";
    return runAdminAction(() => setSiteRole(profile.id, next), { siteRole: next }, "Не вдалося змінити роль");
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
  const viewerIsStaff = isStaff(me?.username, me?.siteRole);
  const profileIsSiteAdmin = !!profile && isSiteAdmin(profile.username);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card profile-card" role="dialog" aria-modal="true" aria-label="Профіль" onClick={(e) => e.stopPropagation()}>
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
              <Avatar name={profile.displayName} color={profile.avatarColor} photoUrl={profile.avatarUrl} size={72} isPremium={profile.isPremium} tier={profile.premiumTier} />
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
                    {TIER_META[profile.premiumTier ?? "premium"].icon} {TIER_META[profile.premiumTier ?? "premium"].label}{profile.premiumUntil ? ` до ${new Date(profile.premiumUntil).toLocaleDateString("uk-UA")}` : ""}
                  </div>
                )}
                {profile.siteRole === "moderator" && <div className="user-badge moderator-badge">🛡 Модератор</div>}
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
            {messageError && <div className="auth-error">{messageError}</div>}
            {!isSelf && me && (
              <button
                className="btn-ghost"
                onClick={() => setUserBlocked(me.id, profile.id, !(me.blockedUids ?? []).includes(profile.id))}
              >
                {(me.blockedUids ?? []).includes(profile.id) ? "✅ Розблокувати" : "🚫 Заблокувати"}
              </button>
            )}

            {!isSelf && me && (
              <button className="btn-ghost" onClick={() => setReporting(true)}>
                🚩 Поскаржитись
              </button>
            )}
            {reporting && <ReportModal targetUid={profile.id} targetName={profile.displayName} onClose={() => setReporting(false)} />}

            {viewerIsStaff && !isSelf && !profileIsSiteAdmin && (viewerIsSiteAdmin || profile.siteRole !== "moderator") && (
              <div className="admin-controls">
                <h3>{viewerIsSiteAdmin ? "Керування (адмін)" : "Керування (модератор)"}</h3>
                <button type="button" className="btn-ghost" disabled={mutingGlobal} onClick={toggleGlobalMute}>
                  {profile.mutedGlobally ? "🔊 Зняти глобальне заглушення" : "🔇 Заглушити глобально"}
                </button>

                {viewerIsSiteAdmin && (
                  <>
                    <div className="admin-block">
                      <b>Підписка{profile.isPremium ? `: ${TIER_META[profile.premiumTier ?? "premium"].icon} ${TIER_META[profile.premiumTier ?? "premium"].label}` : ": немає"}</b>
                      <div className="admin-row">
                        <select value={subTier} onChange={(e) => setSubTier(e.target.value as PremiumTier)} aria-label="Рівень підписки">
                          {(Object.keys(TIER_META) as PremiumTier[]).map((t) => (
                            <option key={t} value={t}>{TIER_META[t].label}</option>
                          ))}
                        </select>
                        <select value={subDays} onChange={(e) => setSubDays(Number(e.target.value))} aria-label="Термін">
                          <option value={7}>7 днів</option>
                          <option value={30}>30 днів</option>
                          <option value={180}>180 днів</option>
                          <option value={365}>365 днів</option>
                        </select>
                      </div>
                      <div className="admin-row">
                        <button type="button" className="btn-primary" disabled={adminBusy} onClick={giveSubscription}>
                          Видати
                        </button>
                        {profile.isPremium && (
                          <button type="button" className="btn-ghost" disabled={adminBusy} onClick={takeSubscription}>
                            Забрати
                          </button>
                        )}
                      </div>
                    </div>

                    <button type="button" className="btn-ghost" disabled={adminBusy} onClick={toggleModerator}>
                      {profile.siteRole === "moderator" ? "🛡 Зняти модератора" : "🛡 Призначити модератором"}
                    </button>
                  </>
                )}

                {viewerIsSiteAdmin && (
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
                )}
                {adminError && <div className="auth-error">{adminError}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
