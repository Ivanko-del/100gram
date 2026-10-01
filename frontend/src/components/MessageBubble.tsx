import { useState } from "react";
import { REACTIONS_FREE, REACTIONS_PREMIUM } from "../constants";
import { ChatMessage } from "../types";
import { renderWithMentions } from "../utils/mentions";
import UserName from "./UserName";

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
  canDelete: boolean;
  onDelete: (messageId: string) => void;
  myUid?: string;
  isPremium?: boolean;
  onReact?: (message: ChatMessage, emoji: string) => void;
  /** Direct chats: when the other person last read - drives ✓ / ✓✓ on my messages */
  peerReadAt?: string | null;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage, text: string) => void;
  onForward?: (message: ChatMessage) => void;
  /** scroll to a quoted message */
  onJump?: (messageId: string) => void;
  highlight?: boolean;
  onVote?: (message: ChatMessage, optionIndex: number) => void;
  /** whether the pin/unpin action is allowed here (DM: anyone, group/channel: admins) */
  canPin?: boolean;
  isPinned?: boolean;
  onPin?: (message: ChatMessage) => void;
  onUnpin?: () => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({
  message,
  isOwn,
  showSender,
  canDelete,
  onDelete,
  myUid,
  isPremium,
  onReact,
  peerReadAt,
  onReply,
  onEdit,
  onForward,
  onJump,
  highlight,
  onVote,
  canPin,
  isPinned,
  onPin,
  onUnpin,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const reactions = Object.entries(message.reactions ?? {}).filter(([, uids]) => uids.length > 0);

  function onDeleteClick() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    onDelete(message.id);
  }

  return (
    <div id={`msg-${message.id}`} className={`message-row ${isOwn ? "own" : ""} ${highlight ? "highlight" : ""}`}>
      <div className="message-bubble" style={!isOwn ? { borderTopLeftRadius: 4 } : { borderTopRightRadius: 4 }}>
        {showSender && !isOwn && (
          <div className="message-sender" style={{ color: message.sender.nameColor ?? message.sender.avatarColor }}>
            <UserName name={message.sender.displayName} emoji={message.sender.emojiStatus} />
          </div>
        )}
        {message.forwardedFrom && <div className="message-forwarded">↪ Переслано від {message.forwardedFrom}</div>}
        {message.replyTo && (
          <button type="button" className="message-quote" onClick={() => onJump?.(message.replyTo!.id)}>
            <span className="message-quote-name">{message.replyTo.name}</span>
            <span className="message-quote-text">
              {message.replyTo.type === "image" ? "📷 Фото" : message.replyTo.type === "poll" ? `📊 ${message.replyTo.text}` : message.replyTo.text}
            </span>
          </button>
        )}
        {isPinned && <div className="message-pinned-tag">📌 Закріплено</div>}
        {message.type === "image" ? (
          <img className="message-image" src={message.content} alt="" loading="lazy" />
        ) : message.type === "poll" && message.poll ? (
          <PollView poll={message.poll} myUid={myUid} onVote={(idx) => onVote?.(message, idx)} />
        ) : editing ? (
          <form
            className="message-edit"
            onSubmit={(e) => {
              e.preventDefault();
              const text = draft.trim();
              if (text && text !== message.content) onEdit?.(message, text);
              setEditing(false);
            }}
          >
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autoFocus />
            <div className="message-edit-actions">
              <button type="submit" className="btn-primary">Зберегти</button>
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Скасувати</button>
            </div>
          </form>
        ) : (
          <div className="message-content">
            {renderWithMentions(message.content)}
            {message.editedAt && <span className="message-edited"> (ред.)</span>}
          </div>
        )}
        {reactions.length > 0 && (
          <div className="message-reactions">
            {reactions.map(([emoji, uids]) => (
              <button
                type="button"
                key={emoji}
                className={`reaction-chip ${myUid && uids.includes(myUid) ? "mine" : ""}`}
                onClick={() => onReact?.(message, emoji)}
              >
                {emoji} <span>{uids.length}</span>
              </button>
            ))}
          </div>
        )}
        <div className="message-time">
          {formatTime(message.createdAt)}
          {isOwn && peerReadAt !== undefined && (
            <span className={`message-ticks ${peerReadAt && new Date(peerReadAt) >= new Date(message.createdAt) ? "read" : ""}`}>
              {peerReadAt && new Date(peerReadAt) >= new Date(message.createdAt) ? "✓✓" : "✓"}
            </span>
          )}
        </div>
        {onReact && (
          <button type="button" className="message-react-btn" onClick={() => { setPicking((v) => !v); setMenuOpen(false); }} title="Реакція">
            ☺
          </button>
        )}
        {(onReply || onForward || onEdit || canPin) && (
          <button type="button" className="message-react-btn message-more-btn" onClick={() => { setMenuOpen((v) => !v); setPicking(false); }} title="Дії">
            ⋯
          </button>
        )}
        {menuOpen && (
          <div className={`message-menu ${isOwn ? "own" : ""}`}>
            {onReply && (
              <button type="button" onClick={() => { setMenuOpen(false); onReply(message); }}>↩ Відповісти</button>
            )}
            {onEdit && isOwn && message.type === "text" && (
              <button type="button" onClick={() => { setMenuOpen(false); setDraft(message.content); setEditing(true); }}>✎ Редагувати</button>
            )}
            {onForward && (
              <button type="button" onClick={() => { setMenuOpen(false); onForward(message); }}>↪ Переслати</button>
            )}
            {canPin && !isPinned && onPin && (
              <button type="button" onClick={() => { setMenuOpen(false); onPin(message); }}>📌 Закріпити</button>
            )}
            {canPin && isPinned && onUnpin && (
              <button type="button" onClick={() => { setMenuOpen(false); onUnpin(); }}>📌 Відкріпити</button>
            )}
            {message.type === "text" && (
              <button type="button" onClick={() => { setMenuOpen(false); navigator.clipboard?.writeText(message.content).catch(() => {}); }}>⧉ Копіювати</button>
            )}
          </div>
        )}
        {picking && onReact && (
          <div className={`reaction-picker ${isOwn ? "own" : ""}`}>
            <div className="reaction-picker-row">
              {REACTIONS_FREE.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => {
                    setPicking(false);
                    onReact(message, e);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="reaction-picker-row">
              {REACTIONS_PREMIUM.map((e) => (
                <button
                  type="button"
                  key={e}
                  className={isPremium ? "" : "locked"}
                  title={isPremium ? undefined : "Потрібен преміум ⭐"}
                  onClick={() => {
                    setPicking(false);
                    onReact(message, e);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {canDelete && (
          <button
            type="button"
            className={`message-delete-btn ${confirming ? "confirming" : ""}`}
            onClick={onDeleteClick}
            title={confirming ? "Натисни ще раз, щоб підтвердити" : "Видалити повідомлення"}
          >
            {confirming ? "Точно?" : "🗑"}
          </button>
        )}
      </div>
    </div>
  );
}

function PollView({ poll, myUid, onVote }: { poll: NonNullable<ChatMessage["poll"]>; myUid?: string; onVote: (optionIndex: number) => void }) {
  const counts = poll.options.map((_, i) => (poll.votes[String(i)] ?? []).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const myIndex = poll.options.findIndex((_, i) => myUid && (poll.votes[String(i)] ?? []).includes(myUid));

  return (
    <div className="poll">
      <div className="poll-question">📊 {poll.question}</div>
      {poll.options.map((option, i) => {
        const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        const mine = i === myIndex;
        return (
          <button type="button" key={i} className={`poll-option ${mine ? "mine" : ""}`} onClick={() => onVote(i)}>
            <div className="poll-option-bar" style={{ width: `${pct}%` }} />
            <span className="poll-option-label">{mine ? "✓ " : ""}{option}</span>
            <span className="poll-option-pct">{pct}%</span>
          </button>
        );
      })}
      <div className="poll-total">{total === 0 ? "Ще немає голосів" : `${total} ${total === 1 ? "голос" : "голосів"}`}</div>
    </div>
  );
}
