import { useState } from "react";
import { ChatMessage } from "../types";

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
  canDelete: boolean;
  onDelete: (messageId: string) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isOwn, showSender, canDelete, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

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
          <div className="message-sender" style={{ color: message.sender.avatarColor }}>
            {message.sender.displayName}
          </div>
        )}
        {message.type === "image" ? (
          <img className="message-image" src={message.content} alt="" loading="lazy" />
        ) : (
          <div className="message-content">{message.content}</div>
        )}
        <div className="message-time">{formatTime(message.createdAt)}</div>
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
