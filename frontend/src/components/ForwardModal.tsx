import { ChatSummary } from "../types";
import Avatar from "./Avatar";

interface Props {
  chats: ChatSummary[];
  onPick: (chat: ChatSummary) => void;
  onClose: () => void;
}

/** "Forward to…" - pick a chat to send a copy of a message to. */
export default function ForwardModal({ chats, onPick, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Переслати в…</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>
        {chats.length === 0 && <p className="settings-hint">Немає чатів, куди можна переслати.</p>}
        <div className="search-results modal-results" style={{ maxHeight: 340 }}>
          {chats.map((c) => (
            <button type="button" className="chat-list-item" key={c.id} onClick={() => onPick(c)}>
              <Avatar name={c.name} color={c.avatarColor} photoUrl={c.avatarUrl} size={40} icon={c.isSaved ? "🔖" : undefined} />
              <div className="chat-list-item-body">
                <div className="chat-list-item-top">
                  <span className="chat-name">{c.isChannel ? "📢 " : c.isGroup ? "👥 " : ""}{c.name}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
