import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteMessage, sendMessage as sendMessageApi, setTyping, subscribeMessages, subscribeTyping } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { isSiteAdmin } from "../constants";
import { ChatMessage, ChatSummary } from "../types";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import MembersListModal from "./MembersListModal";
import UserProfileModal from "./UserProfileModal";

interface Props {
  chat: ChatSummary;
}

export default function ChatWindow({ chat }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setSendError(null);
    const unsub = subscribeMessages(chat.id, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, [chat.id]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeTyping(chat.id, user.id, setTypingUsers);
    return unsub;
  }, [chat.id, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (user) setTyping(chat.id, user.id, user.displayName, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  function describeSendError(err: unknown): string {
    // Duck-type on `.code` rather than `instanceof FirestoreError` - Firebase
    // sometimes throws these as plain FirebaseError instances, which fails
    // an instanceof check against the Firestore-specific subclass even for
    // a genuine permission-denied.
    const code = typeof (err as { code?: unknown })?.code === "string" ? (err as { code: string }).code : null;
    if (code === "permission-denied") {
      return "Немає прав надіслати це тут (можливо, тебе заглушено або це доступно лише адмінам)";
    }
    const msg = err instanceof Error ? err.message : String(err);
    return code ? `Не вдалося надіслати (${code}): ${msg}` : `Не вдалося надіслати: ${msg}`;
  }

  function sendMessage(content: string) {
    if (!user) return;
    setSendError(null);
    sendMessageApi(chat.id, user, content, "text").catch((err) => setSendError(describeSendError(err)));
  }

  function sendImage(url: string) {
    if (!user) return;
    setSendError(null);
    sendMessageApi(chat.id, user, url, "image").catch((err) => setSendError(describeSendError(err)));
  }

  function handleTyping(isTyping: boolean) {
    if (!user) return;
    setTyping(chat.id, user.id, user.displayName, isTyping).catch(() => {});
  }

  function handleDelete(messageId: string) {
    deleteMessage(chat.id, messageId).catch((err) => setSendError(describeSendError(err)));
  }

  const isGroup = chat.isGroup;
  const isChannel = chat.isChannel;
  const isAdmin = !!user && chat.adminUids.includes(user.id);
  const isAppAdmin = isSiteAdmin(user?.username);
  const muted = !!user && (!!user.mutedGlobally || chat.mutedUids.includes(user.id));
  const canPost = (!isChannel || isAdmin) && !muted;
  const typingLabel = typingUsers.length > 0 ? `${typingUsers.join(", ")} друкує…` : null;
  const subtitle =
    typingLabel ??
    (isChannel ? `${chat.members.length} підписників` : isGroup ? `${chat.members.length} учасників` : "в мережі");
  const otherMember = !isGroup ? chat.members.find((m) => m.id !== user?.id) : undefined;

  function openHeaderInfo() {
    if (isGroup) {
      setShowMembers(true);
    } else if (otherMember) {
      setProfileUid(otherMember.id);
    }
  }

  return (
    <section className="chat-window">
      <header className="chat-window-header">
        <button className="mobile-back-btn" onClick={() => navigate("/")} aria-label="Назад до чатів">
          ←
        </button>
        <button type="button" className="chat-header-info" onClick={openHeaderInfo}>
          <Avatar name={chat.name} color={chat.avatarColor} photoUrl={chat.avatarUrl} />
          <div>
            <div className="chat-window-title">
              {isChannel ? "📢 " : isGroup ? "👥 " : ""}
              {chat.name}
            </div>
            <div className="chat-window-subtitle">{subtitle}</div>
          </div>
        </button>
      </header>

      {showMembers && (
        <MembersListModal
          chat={chat}
          onClose={() => setShowMembers(false)}
          onSelectMember={(uid) => {
            setShowMembers(false);
            setProfileUid(uid);
          }}
        />
      )}
      {profileUid && <UserProfileModal uid={profileUid} onClose={() => setProfileUid(null)} />}

      <div className="message-list">
        {loading && <div className="empty-hint">Завантаження повідомлень…</div>}
        {!loading && messages.length === 0 && (
          <div className="empty-hint">
            {isChannel ? (canPost ? "Опублікуй перший допис 📢" : "Тут поки що немає дописів") : "Напишіть перше повідомлення 👋"}
          </div>
        )}
        {messages.map((m, idx) => {
          const prev = messages[idx - 1];
          const showSender = isGroup && !isChannel && (!prev || prev.sender.id !== m.sender.id);
          const isOwn = m.sender.id === user?.id;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              isOwn={isOwn}
              showSender={showSender}
              canDelete={isOwn || isAppAdmin}
              onDelete={handleDelete}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && <div className="auth-error chat-send-error">{sendError}</div>}

      {canPost ? (
        <MessageInput onSend={sendMessage} onSendImage={sendImage} onTyping={handleTyping} disabled={!user} />
      ) : muted ? (
        <div className="channel-readonly-note">🔇 Тебе заглушено {chat.mutedUids.includes(user?.id ?? "") ? "в цьому чаті" : ""}</div>
      ) : (
        <div className="channel-readonly-note">Публікувати в цьому каналі можуть лише адміни</div>
      )}
    </section>
  );
}
