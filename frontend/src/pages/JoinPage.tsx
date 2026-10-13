import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DataError, getChatPreview, joinChat } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { ChatSummary } from "../types";
import Avatar from "../components/Avatar";

/** Landing page of an invite link: `/join/:chatId` (public chat) or
 * `/join/:chatId?k=<code>` (private chat). Non-members can read only public
 * chats, so a private one is shown as a generic invitation. */
export default function JoinPage() {
  const { chatId = "" } = useParams();
  const [params] = useSearchParams();
  const code = params.get("k");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<{ status: "loading" } | { status: "missing" } | { status: "private" } | { status: "public"; chat: ChatSummary }>({
    status: "loading",
  });
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getChatPreview(chatId, uid).then((res) => {
      if (cancelled) return;
      if (res === "private") return setState({ status: "private" });
      if (!res) return setState({ status: "missing" });
      // already inside: just open it
      if (res.members.some((m) => m.id === uid)) return navigate(`/chat/${chatId}`, { replace: true });
      setState({ status: "public", chat: res });
    });
    return () => {
      cancelled = true;
    };
  }, [chatId, uid, navigate]);

  async function join() {
    if (!user) return;
    setError(null);
    setJoining(true);
    try {
      await joinChat(user, chatId, code);
      navigate(`/chat/${chatId}`, { replace: true });
    } catch (e) {
      setError(e instanceof DataError ? e.message : "Не вдалося приєднатися");
      setJoining(false);
    }
  }

  const chat = state.status === "public" ? state.chat : null;

  return (
    <div className="join-screen">
      <button type="button" className="join-back" onClick={() => navigate("/")}>
        <ArrowLeft size={18} className="inline-icon" /> До чатів
      </button>
      <div className="join-card">
        {state.status === "loading" && <p className="settings-hint">Завантаження…</p>}

        {state.status === "missing" && (
          <>
            <h2>Чат не знайдено</h2>
            <p className="settings-hint">Можливо, його видалили, або посилання неправильне.</p>
          </>
        )}

        {state.status === "private" && (
          <>
            <div className="join-icon">🔒</div>
            <h2>Приватний чат</h2>
            {code ? (
              <>
                <p className="settings-hint">Тебе запросили до закритої групи або каналу. Приєднатися можна за цим посиланням.</p>
                {error && <div className="auth-error">{error}</div>}
                <button type="button" className="btn-primary" disabled={joining} onClick={join}>
                  {joining ? "Приєднуємось…" : "Приєднатися"}
                </button>
              </>
            ) : (
              <p className="settings-hint">Сюди можна потрапити лише за посиланням-запрошенням від учасника.</p>
            )}
          </>
        )}

        {chat && (
          <>
            <Avatar name={chat.name} color={chat.avatarColor} photoUrl={chat.avatarUrl} size={96} />
            <h2>{chat.name}</h2>
            <div className="settings-hint">
              {chat.isChannel ? "Публічний канал" : "Публічна група"} · {chat.members.length}{" "}
              {chat.isChannel ? "підписників" : "учасників"}
            </div>
            {chat.description && <p className="join-description">{chat.description}</p>}
            {error && <div className="auth-error">{error}</div>}
            <button type="button" className="btn-primary" disabled={joining} onClick={join}>
              {joining ? "Приєднуємось…" : `Приєднатися до ${chat.isChannel ? "каналу" : "групи"}`}
            </button>
            <p className="settings-hint">Вийти можна будь-коли.</p>
          </>
        )}
      </div>
    </div>
  );
}
