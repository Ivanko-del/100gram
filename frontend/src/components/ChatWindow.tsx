import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { ChatMessage, ChatSummary } from "../types";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

interface Props {
  chat: ChatSummary;
  onMessageSent: (chatId: string, message: ChatMessage) => void;
}

export default function ChatWindow({ chat, onMessageSent }: Props) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    api.get<ChatMessage[]>(`/chats/${chat.id}/messages`).then((data) => {
      if (!cancelled) {
        setMessages(data);
        setLoading(false);
      }
    });
    socket?.emit("chat:join", chat.id);
    return () => {
      cancelled = true;
    };
  }, [chat.id, socket]);

  useEffect(() => {
    if (!socket) return;
    function onNewMessage(msg: ChatMessage) {
      if (msg.chatId !== chat.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      onMessageSent(chat.id, msg);
    }
    function onTyping(data: { chatId: string; userId: string; username: string; isTyping: boolean }) {
      if (data.chatId !== chat.id || data.userId === user?.id) return;
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      if (data.isTyping) {
        setTypingUser(data.username);
        typingClearRef.current = setTimeout(() => setTypingUser(null), 2500);
      } else {
        setTypingUser(null);
      }
    }
    socket.on("message:new", onNewMessage);
    socket.on("typing", onTyping);
    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("typing", onTyping);
    };
  }, [socket, chat.id, user?.id, onMessageSent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function sendMessage(content: string) {
    if (!socket) return;
    socket.emit("message:send", { chatId: chat.id, content }, (res: { error?: string }) => {
      if (res?.error) {
        // eslint-disable-next-line no-console
        console.error(res.error);
      }
    });
  }

  function handleTyping(isTyping: boolean) {
    socket?.emit("typing", { chatId: chat.id, isTyping });
  }

  const isGroup = chat.isGroup;

  return (
    <section className="chat-window">
      <header className="chat-window-header">
        <Avatar name={chat.name} color={chat.avatarColor} />
        <div>
          <div className="chat-window-title">{chat.name}</div>
          <div className="chat-window-subtitle">
            {typingUser ? `${typingUser} друкує…` : isGroup ? `${chat.members.length} учасників` : "в мережі"}
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

      <MessageInput onSend={sendMessage} onTyping={handleTyping} disabled={!socket} />
    </section>
  );
}
