import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, startDirectChat } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { User } from "../types";
import Avatar from "./Avatar";

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getUserProfile(uid).then((p) => {
      if (!cancelled) {
        setProfile(p);
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

  const isSelf = me?.id === uid;

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
            <div className="profile-card-identity">
              <Avatar name={profile.displayName} color={profile.avatarColor} size={72} isPremium={profile.isPremium} />
              <div className="settings-profile-name">{profile.displayName}</div>
              <div className="settings-profile-username">@{profile.username}</div>
              {profile.isPremium && (
                <div className="premium-chip">
                  ⭐ Преміум{profile.premiumUntil ? ` до ${new Date(profile.premiumUntil).toLocaleDateString("uk-UA")}` : ""}
                </div>
              )}
            </div>

            {profile.bio && <p className="profile-card-bio">{profile.bio}</p>}

            {!isSelf && (
              <button className="btn-primary" onClick={message} disabled={starting}>
                {starting ? "Відкриття…" : "✉️ Написати повідомлення"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
