import { useState } from "react";
import { REACTIONS_FREE, REACTIONS_PREMIUM } from "../constants";
import { ChatMessage } from "../types";
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
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isOwn, showSender, canDelete, onDelete, myUid, isPremium, onReact }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
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
    <div className={`message-row ${isOwn ? "own" : ""}`}>
      <div className="message-bubble" style={!isOwn ? { borderTopLeftRadius: 4 } : { borderTopRightRadius: 4 }}>
        {showSender && !isOwn && (
          <div className="message-sender" style={{ color: message.sender.nameColor ?? message.sender.avatarColor }}>
            <UserName name={message.sender.displayName} emoji={message.sender.emojiStatus} />
          </div>
        )}
        {message.type === "image" ? (
          <img className="message-image" src={message.content} alt="" loading="lazy" />
        ) : (
          <div className="message-content">{message.content}</div>
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
        <div className="message-time">{formatTime(message.createdAt)}</div>
        {onReact && (
          <button type="button" className="message-react-btn" onClick={() => setPicking((v) => !v)} title="Реакція">
            ☺
          </button>
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
