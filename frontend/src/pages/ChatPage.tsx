import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { subscribeChats, subscribePublicProfile } from "../data/firestore-api";
import { useAuth } from "../context/AuthContext";
import { playNotificationSound } from "../utils/sound";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import LockPrompt from "../components/LockPrompt";
import { useChatLock } from "../context/ChatLockContext";
import { ChatSummary, User } from "../types";

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLocked, hasPassword, unlocked } = useChatLock();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, User>>({});
  const lastSeenRef = useRef<Map<string, string> | null>(null);
  const openChatIdRef = useRef(chatId);
  openChatIdRef.current = chatId;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    lastSeenRef.current = null;
    const unsub = subscribeChats(user.id, (data) => {
      const previous = lastSeenRef.current;
      if (previous) {
        for (const chat of data) {
          const last = chat.lastMessage;
          if (!last || last.senderId === user.id) continue;
          if (chat.id === openChatIdRef.current) continue;
          const seenAt = previous.get(chat.id);
          if (seenAt !== last.createdAt) playNotificationSound();
        }
      }
      lastSeenRef.current = new Map(data.map((c) => [c.id, c.lastMessage?.createdAt ?? ""]));
      setChats(data);
      setLoading(false);
    });
    return unsub;
  }, [user?.id]);

  // Direct chats carry a copy of the other person's profile from when the
  // chat was created, so a photo added later never shows up in the list.
  // Follow the live profiles of everyone we have a DM with instead.
  const dmPeerKey = chats
    .filter((c) => !c.isGroup && !c.isSaved)
    .map((c) => c.members.find((m) => m.id !== user?.id)?.id)
    .filter(Boolean)
    .sort()
    .join(",");

  useEffect(() => {
    const uids = dmPeerKey ? dmPeerKey.split(",") : [];
    const unsubs = uids.map((uid) =>
      subscribePublicProfile(uid, (p) => {
        if (p) setProfiles((prev) => ({ ...prev, [uid]: p }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [dmPeerKey]);

  const liveChats = chats.map((c) => {
    if (c.isGroup || c.isSaved) return c;
    const peer = profiles[c.members.find((m) => m.id !== user?.id)?.id ?? ""];
    return peer ? { ...c, name: peer.displayName, avatarColor: peer.avatarColor, avatarUrl: peer.avatarUrl ?? null } : c;
  });

  const activeChat = liveChats.find((c) => c.id === chatId);

  function handleChatCreated(id: string) {
    navigate(`/chat/${id}`);
  }

  return (
    <div className={`app-layout ${chatId ? "mobile-show-detail" : ""}`}>
      <Sidebar chats={liveChats} activeChatId={chatId} onChatCreated={handleChatCreated} />
      {activeChat && isLocked(activeChat.id) && hasPassword && !unlocked ? (
        <div className="chat-window-empty">
          <LockPrompt title={`«${activeChat.name}» заблоковано`} onCancel={() => navigate("/")} />
        </div>
      ) : activeChat ? (
        <ChatWindow chat={activeChat} />
      ) : (
        <div className="chat-window-empty">
          {loading ? "Завантаження чатів…" : (
            <>
              <div className="empty-illustration">🥃</div>
              <h2>100 ГРАМ</h2>
              <p>Оберіть чат зліва або знайдіть друга через пошук</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
