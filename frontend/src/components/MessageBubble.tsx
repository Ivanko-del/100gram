import { ChatMessage } from "../types";

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isOwn, showSender }: Props) {
  return (
    <div className={`message-row ${isOwn ? "own" : ""}`}>
      <div className="message-bubble" style={!isOwn ? { borderTopLeftRadius: 4 } : { borderTopRightRadius: 4 }}>
        {showSender && !isOwn && (
          <div className="message-sender" style={{ color: message.sender.avatarColor }}>
            {message.sender.displayName}
          </div>
        )}
        <div className="message-content">{message.content}</div>
        <div className="message-time">{formatTime(message.createdAt)}</div>
      </div>
    </div>
  );
}
