import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteMessage,
  markChatRead,
  sendMessage as sendMessageApi,
  setTyping,
  subscribeMessages,
  subscribeTyping,
  setUserBlocked,
  toggleReaction,
} from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { FREE_REACTIONS_PER_MESSAGE, PREMIUM_REACTIONS_PER_MESSAGE, REACTIONS_PREMIUM, isSiteAdmin } from "../constants";
import { ChatMessage, ChatSummary } from "../types";
import Avatar from "./Avatar";
import UserName from "./UserName";
import { formatLastSeen } from "../utils/lastSeen";
import { isUnread } from "../utils/unread";
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

  // Reading: mark the chat read whenever it is open, visible and has news
  useEffect(() => {
    if (!user) return;
    const mark = () => {
      if (document.visibilityState === "visible" && isUnread(chat, user.id)) markChatRead(chat.id, user.id);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, chat.lastMessage?.createdAt, chat.readBy[user?.id ?? ""], user?.id]);

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

  function handleReact(message: ChatMessage, emoji: string) {
    if (!user) return;
    const mine = Object.entries(message.reactions)
      .filter(([, uids]) => uids.includes(user.id))
      .map(([e]) => e);
    if (!mine.includes(emoji) && REACTIONS_PREMIUM.includes(emoji) && !user.isPremium) {
      setSendError("Ці реакції доступні з преміумом ⭐");
      return;
    }
    setSendError(null);
    const limit = user.isPremium ? PREMIUM_REACTIONS_PER_MESSAGE : FREE_REACTIONS_PER_MESSAGE;
    toggleReaction(chat.id, message.id, user.id, emoji, mine, limit).catch((err) => setSendError(describeSendError(err)));
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
    (chat.isSaved ? "Твої нотатки й файли" : !isGroup && chat.statusText ? chat.statusText : isChannel ? `${chat.members.length} підписників` : isGroup ? `${chat.members.length} учасників` : formatLastSeen(chat.peerLastSeenAt));
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
          <Avatar name={chat.name} color={chat.avatarColor} photoUrl={chat.avatarUrl} icon={chat.isSaved ? "🔖" : undefined} />
          <div>
            <div className="chat-window-title">
              {isChannel ? "📢 " : isGroup ? "👥 " : ""}
              <UserName name={chat.name} emoji={chat.emojiStatus} color={chat.nameColor} />
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
              myUid={user?.id}
              isPremium={user?.isPremium}
              onReact={handleReact}
              peerReadAt={!isGroup && !chat.isSaved && chat.peerId ? chat.readBy[chat.peerId] ?? null : undefined}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && <div className="auth-error chat-send-error">{sendError}</div>}

      {!chat.isGroup && chat.peerId && (user?.blockedUids ?? []).includes(chat.peerId) ? (
        <div className="channel-readonly-note">
          Ти заблокував(ла) цього користувача.{" "}
          <button className="btn-link" onClick={() => user && setUserBlocked(user.id, chat.peerId!, false)}>
            Розблокувати
          </button>
        </div>
      ) : canPost ? (
        <MessageInput onSend={sendMessage} onSendImage={sendImage} onTyping={handleTyping} disabled={!user} />
      ) : muted ? (
        <div className="channel-readonly-note">🔇 Тебе заглушено {chat.mutedUids.includes(user?.id ?? "") ? "в цьому чаті" : ""}</div>
      ) : (
        <div className="channel-readonly-note">Публікувати в цьому каналі можуть лише адміни</div>
      )}
    </section>
  );
}
