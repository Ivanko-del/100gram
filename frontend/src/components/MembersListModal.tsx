import { ChatSummary } from "../types";
import Avatar from "./Avatar";

interface Props {
  chat: ChatSummary;
  onClose: () => void;
  onSelectMember: (uid: string) => void;
}

export default function MembersListModal({ chat, onClose, onSelectMember }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{chat.isChannel ? "Підписники" : "Учасники"} ({chat.members.length})</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        <div className="member-list">
          {chat.members.map((m) => (
            <button key={m.id} className="chat-list-item" onClick={() => onSelectMember(m.id)}>
              <Avatar name={m.displayName} color={m.avatarColor} />
              <div className="chat-list-item-body">
                <div className="chat-list-item-top">
                  <span className="chat-name">{m.displayName}</span>
                  {chat.adminUids.includes(m.id) && <span className="admin-badge">адмін</span>}
                </div>
                <div className="chat-list-item-bottom">@{m.username}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
