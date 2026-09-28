import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendMessage as sendMessageApi, setTyping, subscribeMessages, subscribeTyping } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { ChatMessage, ChatSummary } from "../types";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

interface Props {
  chat: ChatSummary;
}

export default function ChatWindow({ chat }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
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

  function sendMessage(content: string) {
    if (!user) return;
    sendMessageApi(chat.id, user, content).catch(() => {});
  }

  function handleTyping(isTyping: boolean) {
    if (!user) return;
    setTyping(chat.id, user.id, user.displayName, isTyping).catch(() => {});
  }

  const isGroup = chat.isGroup;
  const typingLabel = typingUsers.length > 0 ? `${typingUsers.join(", ")} друкує…` : null;

  return (
    <section className="chat-window">
      <header className="chat-window-header">
        <button className="mobile-back-btn" onClick={() => navigate("/")} aria-label="Назад до чатів">
          ←
        </button>
        <Avatar name={chat.name} color={chat.avatarColor} />
        <div>
          <div className="chat-window-title">{chat.name}</div>
          <div className="chat-window-subtitle">
            {typingLabel ?? (isGroup ? `${chat.members.length} учасників` : "в мережі")}
          </div>
        </div>
      </header>

      <div className="message-list">
        {loading && <div className="empty-hint">Завантаження повідомлень…</div>}
        {!loading && messages.length === 0 && <div className="empty-hint">Напишіть перше повідомлення 👋</div>}
        {messages.map((m, idx) => {
          const prev = messages[idx - 1];
          const showSender = isGroup && (!prev || prev.sender.id !== m.sender.id);
          return <MessageBubble key={m.id} message={m} isOwn={m.sender.id === user?.id} showSender={showSender} />;
        })}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={sendMessage} onTyping={handleTyping} disabled={!user} />
    </section>
  );
}
