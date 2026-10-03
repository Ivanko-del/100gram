import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Megaphone, Pin, Search, Users, VolumeX, X } from "lucide-react";
import {
  deleteMessage,
  editMessage,
  markChatRead,
  pinMessage,
  sendMessage as sendMessageApi,
  setTyping,
  subscribeMessages,
  subscribeTyping,
  setUserBlocked,
  toggleReaction,
  votePoll,
} from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { FREE_REACTIONS_PER_MESSAGE, PREMIUM_REACTIONS_PER_MESSAGE, REACTIONS_PREMIUM, isSiteAdmin } from "../constants";
import { ChatMessage, ChatSummary } from "../types";
import Avatar from "./Avatar";
import UserName from "./UserName";
import ForwardModal from "./ForwardModal";
import { formatLastSeen } from "../utils/lastSeen";
import { isUnread } from "../utils/unread";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import MembersListModal from "./MembersListModal";
import UserProfileModal from "./UserProfileModal";
import ReportModal from "./ReportModal";

interface Props {
  chat: ChatSummary;
  /** all visible chats, offered as targets when forwarding a message */
  chats?: ChatSummary[];
}

const PAGE_SIZE = 60;

export default function ChatWindow({ chat, chats = [] }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [reportMsg, setReportMsg] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const loadingOlder = useRef(false);
  const sentAt = useRef<number[]>([]);
  // when the "typing" doc was last written (0 = not typing), so we write it
  // every couple of seconds instead of on every keystroke
  const typingSentAt = useRef(0);
  const messageListRef = useRef<HTMLDivElement>(null);
  // true until the freshly-opened chat has landed on its newest message -
  // drives an instant jump instead of an animated smooth-scroll
  const freshOpen = useRef(true);

  // a different chat: start from a clean slate
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setSendError(null);
    setPageSize(PAGE_SIZE);
    setReplyTo(null);
    setSearchOpen(false);
    setSearchQuery("");
    setTypingUsers([]);
    typingSentAt.current = 0;
    freshOpen.current = true;
  }, [chat.id]);

  // live view of the newest `pageSize` messages
  useEffect(() => {
    const unsub = subscribeMessages(
      chat.id,
      (msgs) => {
        setMessages(msgs);
        setLoading(false);
      },
      pageSize
    );
    return unsub;
  }, [chat.id, pageSize]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeTyping(chat.id, user.id, setTypingUsers);
    return unsub;
    // Depends on the stable user.id, not the whole `user` object, which
    // changes identity on every Firestore snapshot and would resubscribe needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // loading older history must not yank the view down to the newest message
    if (loadingOlder.current) {
      loadingOlder.current = false;
      return;
    }
    // Depends on the `messages` array identity (not `.length`) - Firestore
    // hands us a new array on every snapshot, so switching to a different
    // chat that happens to load the same number of messages still scrolls.
    const isFreshOpen = freshOpen.current;
    if (messages.length > 0) freshOpen.current = false;
    bottomRef.current?.scrollIntoView({ behavior: isFreshOpen ? "auto" : "smooth" });
  }, [messages]);

  useEffect(() => {
    // A photo lower in the list can still be loading when we land on the
    // newest message; once it decodes it grows the page and leaves the view
    // short of the real bottom, so snap back down whenever one finishes.
    const list = messageListRef.current;
    if (!list) return;
    function isNearBottom() {
      if (!list) return true;
      return list.scrollHeight - list.scrollTop - list.clientHeight < 200;
    }
    function onImageLoad(e: Event) {
      if ((e.target as HTMLElement).tagName === "IMG" && isNearBottom()) {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }
    list.addEventListener("load", onImageLoad, true);
    return () => list.removeEventListener("load", onImageLoad, true);
  }, [chat.id]);

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

  // crude anti-flood: at most 8 messages per 10 seconds
  function tooFast(): boolean {
    const now = Date.now();
    sentAt.current = sentAt.current.filter((t) => now - t < 10_000);
    if (sentAt.current.length >= 8) {
      setSendError("Не так швидко — зачекай кілька секунд");
      return true;
    }
    sentAt.current.push(now);
    return false;
  }

  function sendMessage(content: string) {
    if (!user || tooFast()) return;
    setSendError(null);
    const reply = replyTo
      ? {
          id: replyTo.id,
          name: replyTo.sender.displayName,
          text: replyTo.type === "image" ? "" : replyTo.content.slice(0, 140),
          type: replyTo.type,
        }
      : null;
    setReplyTo(null);
    sendMessageApi(chat.id, user, content, "text", { replyTo: reply }).catch((err) => setSendError(describeSendError(err)));
  }

  function handleEdit(message: ChatMessage, text: string) {
    const isLast = messages[messages.length - 1]?.id === message.id;
    editMessage(chat.id, { id: message.id, createdAt: message.createdAt, senderId: message.sender.id }, text, isLast).catch((err) =>
      setSendError(describeSendError(err))
    );
  }

  function forwardTo(target: ChatSummary) {
    if (!user || !forwardMsg) return;
    const from = forwardMsg.forwardedFrom ?? forwardMsg.sender.displayName;
    // Forwarding a poll resets the vote count - it travels as a fresh poll
    // with the same question/options, not as a snapshot of someone's votes.
    sendMessageApi(target.id, user, forwardMsg.content, forwardMsg.type, {
      forwardedFrom: from,
      ...(forwardMsg.type === "poll" && forwardMsg.poll
        ? { poll: { question: forwardMsg.poll.question, options: forwardMsg.poll.options } }
        : {}),
    }).catch((err) => setSendError(describeSendError(err)));
    setForwardMsg(null);
  }

  function jumpTo(messageId: string) {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) {
      setSendError("Це повідомлення завантажене не повністю — натисни «Показати раніше»");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId(null), 1500);
  }

  function loadOlder() {
    loadingOlder.current = true;
    setPageSize((n) => n + PAGE_SIZE);
  }

  function sendImage(url: string) {
    if (!user || tooFast()) return;
    setSendError(null);
    sendMessageApi(chat.id, user, url, "image").catch((err) => setSendError(describeSendError(err)));
  }

  function sendPoll(question: string, options: string[]) {
    if (!user || tooFast()) return;
    setSendError(null);
    sendMessageApi(chat.id, user, question, "poll", { poll: { question, options } }).catch((err) =>
      setSendError(describeSendError(err))
    );
  }

  function handleVote(message: ChatMessage, optionIndex: number) {
    if (!user || !message.poll) return;
    const previousIndex = message.poll.options.findIndex((_, i) => (message.poll!.votes[String(i)] ?? []).includes(user.id));
    votePoll(chat.id, message.id, user.id, optionIndex, previousIndex === -1 ? null : previousIndex).catch((err) =>
      setSendError(describeSendError(err))
    );
  }

  function handlePin(message: ChatMessage) {
    pinMessage(chat.id, message.id).catch((err) => setSendError(describeSendError(err)));
  }

  function handleUnpin() {
    pinMessage(chat.id, null).catch((err) => setSendError(describeSendError(err)));
  }

  function handleTyping(isTyping: boolean) {
    if (!user) return;
    const now = Date.now();
    if (isTyping) {
      if (now - typingSentAt.current < 2500) return;
      typingSentAt.current = now;
    } else {
      if (typingSentAt.current === 0) return;
      typingSentAt.current = 0;
    }
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
    // deleting the newest message must also roll the chat-list preview back
    const idx = messages.findIndex((m) => m.id === messageId);
    const prev = messages[idx - 1];
    // with a partly loaded history we cannot tell what came before, so leave the preview alone
    const canRollBack = idx === messages.length - 1 && (!!prev || messages.length < pageSize);
    const newLast = !canRollBack
      ? undefined
      : prev
        ? { type: prev.type, content: prev.content, senderId: prev.sender.id, createdAt: prev.createdAt }
        : null;
    deleteMessage(chat.id, messageId, newLast).catch((err) => setSendError(describeSendError(err)));
    // a deleted message must not stay behind as a dangling pinned banner
    if (chat.pinnedMessageId === messageId && canPin) handleUnpin();
  }

  const query = searchQuery.trim().toLowerCase();
  const shownMessages = query ? messages.filter((m) => m.type === "text" && m.content.toLowerCase().includes(query)) : messages;
  const hasMore = messages.length >= pageSize && !query;
  const targets = chats.filter((c) => c.id !== chat.id && (!c.isChannel || (user && c.adminUids.includes(user.id))));

  const isGroup = chat.isGroup;
  const isChannel = chat.isChannel;
  const isAdmin = !!user && chat.adminUids.includes(user.id);
  const isAppAdmin = isSiteAdmin(user?.username);
  // Pinning: any member in a direct chat, admins only in a group/channel -
  // mirrored in firestore.rules' isPinChange() check.
  const canPin = !isGroup || isAdmin;
  const pinnedMessage = chat.pinnedMessageId ? messages.find((m) => m.id === chat.pinnedMessageId) : undefined;
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
          <ArrowLeft size={22} />
        </button>
        <button type="button" className="chat-header-info" onClick={openHeaderInfo}>
          <Avatar name={chat.name} color={chat.avatarColor} photoUrl={chat.avatarUrl} icon={chat.isSaved ? "🔖" : undefined} />
          <div>
            <div className="chat-window-title">
              {isChannel ? (
                <Megaphone size={15} className="title-prefix-icon" />
              ) : isGroup ? (
                <Users size={15} className="title-prefix-icon" />
              ) : null}
              <UserName name={chat.name} emoji={chat.emojiStatus} color={chat.nameColor} />
            </div>
            <div className="chat-window-subtitle">{subtitle}</div>
          </div>
        </button>
        <span className="header-spacer" />
        <button type="button" className="header-icon-btn" onClick={() => { setSearchOpen((v) => !v); setSearchQuery(""); }} aria-label="Пошук у чаті">
          <Search size={20} />
        </button>
      </header>

      {chat.pinnedMessageId && (
        <button type="button" className="pinned-banner" onClick={() => jumpTo(chat.pinnedMessageId!)}>
          <Pin size={16} className="pinned-banner-icon" />
          <span className="pinned-banner-text">
            {pinnedMessage
              ? pinnedMessage.type === "image"
                ? "Фото"
                : pinnedMessage.type === "poll"
                  ? pinnedMessage.poll?.question ?? "Опитування"
                  : pinnedMessage.content
              : "Закріплене повідомлення"}
          </span>
          {canPin && (
            <span
              className="pinned-banner-unpin"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleUnpin();
              }}
              aria-label="Відкріпити"
            >
              <X size={14} />
            </span>
          )}
        </button>
      )}

      {searchOpen && (
        <div className="chat-search-bar">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук у цьому чаті"
          />
          {query && <span className="settings-hint">{shownMessages.length}</span>}
        </div>
      )}

      {showMembers && (
        <MembersListModal
          chat={chat}
          onClose={() => setShowMembers(false)}
          onLeft={() => navigate("/")}
          onSelectMember={(uid) => {
            setShowMembers(false);
            setProfileUid(uid);
          }}
        />
      )}
      {profileUid && <UserProfileModal uid={profileUid} onClose={() => setProfileUid(null)} />}

      <div className="message-list" ref={messageListRef}>
        {loading && <div className="empty-hint">Завантаження повідомлень…</div>}
        {!loading && messages.length === 0 && (
          <div className="empty-hint">
            {isChannel ? (canPost ? "Опублікуй перший допис 📢" : "Тут поки що немає дописів") : "Напишіть перше повідомлення 👋"}
          </div>
        )}
        {hasMore && (
          <button type="button" className="btn-ghost load-older" onClick={loadOlder}>
            Показати раніше
          </button>
        )}
        {shownMessages.map((m, idx) => {
          const prev = shownMessages[idx - 1];
          const showSender = isGroup && !isChannel && (!prev || prev.sender.id !== m.sender.id);
          const isOwn = m.sender.id === user?.id;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              isOwn={isOwn}
              showSender={showSender}
              canDelete={isOwn || isAppAdmin || (isGroup && isAdmin)}
              onDelete={handleDelete}
              myUid={user?.id}
              isPremium={user?.isPremium}
              onReact={handleReact}
              onReply={canPost ? setReplyTo : undefined}
              onEdit={handleEdit}
              onForward={setForwardMsg}
              onJump={jumpTo}
              highlight={highlightId === m.id}
              peerReadAt={!isGroup && !chat.isSaved && chat.peerId ? chat.readBy[chat.peerId] ?? null : undefined}
              peerDeliveredAt={!isGroup && !chat.isSaved && chat.peerId ? chat.deliveredTo?.[chat.peerId] ?? null : undefined}
              onVote={handleVote}
              canPin={canPin}
              isPinned={chat.pinnedMessageId === m.id}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onReport={setReportMsg}
              onMentionOpen={setProfileUid}
              onMentionMissing={(name) => setSendError(`Користувача @${name} не знайдено`)}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && <div className="auth-error chat-send-error">{sendError}</div>}

      {reportMsg && (
        <ReportModal
          targetUid={reportMsg.sender.id}
          targetName={reportMsg.sender.displayName}
          message={{
            chatId: chat.id,
            messageId: reportMsg.id,
            text: reportMsg.type === "poll" ? reportMsg.poll?.question ?? "" : reportMsg.type === "image" ? "" : reportMsg.content,
          }}
          onClose={() => setReportMsg(null)}
        />
      )}

      {forwardMsg && <ForwardModal chats={targets} onPick={forwardTo} onClose={() => setForwardMsg(null)} />}

      {replyTo && canPost && (
        <div className="reply-bar">
          <div className="reply-bar-body">
            <span className="reply-bar-name">Відповідь для {replyTo.sender.displayName}</span>
            <span className="reply-bar-text">
              {replyTo.type === "image" ? "Фото" : replyTo.type === "poll" ? replyTo.content : replyTo.content}
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={() => setReplyTo(null)} aria-label="Скасувати відповідь">
            <X size={18} />
          </button>
        </div>
      )}

      {!chat.isGroup && chat.peerId && (user?.blockedUids ?? []).includes(chat.peerId) ? (
        <div className="channel-readonly-note">
          Ти заблокував(ла) цього користувача.{" "}
          <button className="btn-link" onClick={() => user && setUserBlocked(user.id, chat.peerId!, false)}>
            Розблокувати
          </button>
        </div>
      ) : canPost ? (
        <MessageInput onSend={sendMessage} onSendImage={sendImage} onSendPoll={sendPoll} onTyping={handleTyping} disabled={!user} />
      ) : muted ? (
        <div className="channel-readonly-note">
          <VolumeX size={14} className="inline-icon" /> Тебе заглушено {chat.mutedUids.includes(user?.id ?? "") ? "в цьому чаті" : ""}
        </div>
      ) : (
        <div className="channel-readonly-note">Публікувати в цьому каналі можуть лише адміни</div>
      )}
    </section>
  );
}
