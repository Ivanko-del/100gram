import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { markChatDelivered, markChatRead, subscribeChats, subscribePublicProfile } from "../data/firestore-api";
import { useUnreadCounts } from "../hooks/useUnreadCounts";
import { useAuth } from "../context/AuthContext";
import { playNotificationSound } from "../utils/sound";
import { needsDeliveryReceipt } from "../utils/messageStatus";
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
  const userRef = useRef(user);
  userRef.current = user;

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
          const me = userRef.current;
          if (me?.mutedChats?.includes(chat.id)) continue;
          const peerUid = !chat.isGroup ? chat.members.find((m) => m.id !== user.id)?.id : undefined;
          if (peerUid && me?.blockedUids?.includes(peerUid)) continue;
          const seenAt = previous.get(chat.id);
          if (seenAt !== last.createdAt) playNotificationSound();
        }
      }
      lastSeenRef.current = new Map(data.map((c) => [c.id, c.lastMessage?.createdAt ?? ""]));
      setChats(data);
      setLoading(false);
    });
    return unsub;
    // Depends on the stable user.id, not the whole `user` object, which
    // changes identity on every Firestore snapshot and would resubscribe needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!peer) return c;
    return {
      ...c,
      name: peer.displayName,
      avatarColor: peer.avatarColor,
      avatarUrl: peer.avatarUrl ?? null,
      // cosmetics count only while the peer's premium is active
      emojiStatus: peer.isPremium ? peer.emojiStatus ?? null : null,
      nameColor: peer.isPremium ? peer.nameColor ?? null : null,
      statusText: peer.isPremium ? peer.statusText ?? null : null,
      peerId: peer.id,
      peerLastSeenAt: peer.hideLastSeen ? null : peer.lastSeenAt ?? null,
    };
  });

  // Chats that predate read tracking get a silent "read now" mark, so old
  // history doesn't light up as unread.
  const initKey = chats.filter((c) => user && !c.readBy[user.id]).map((c) => c.id).join(",");
  useEffect(() => {
    if (!user || !initKey) return;
    initKey.split(",").forEach((id) => markChatRead(id, user.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initKey, user?.id]);

  // Delivery receipts: when a chat list update brings a new message from
  // someone else in a DM, record "delivered" once per message. `receipts`
  // remembers what was already sent so the snapshot echo of our own write
  // can never trigger another one. (A failed write - e.g. rules not yet
  // published - is not retried until the next new message.)
  const receipts = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    for (const c of chats) {
      const open = c.id === openChatIdRef.current && document.visibilityState === "visible";
      if (!needsDeliveryReceipt(c, user.id, open)) continue;
      const key = `${c.id}:${c.lastMessage?.createdAt}`;
      if (receipts.current.has(key)) continue;
      receipts.current.add(key);
      markChatDelivered(c.id, user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, user?.id]);

  const unreadCounts = useUnreadCounts(chats, user?.id);
  const totalUnread = Object.entries(unreadCounts)
    .filter(([id]) => !(user?.mutedChats ?? []).includes(id))
    .reduce((sum, [, n]) => sum + n, 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) 100 ГРАМ` : "100 ГРАМ";
  }, [totalUnread]);

  const blocked = user?.blockedUids ?? [];
  const visibleChats = liveChats.filter(
    (c) => c.isGroup || c.isSaved || !c.members.some((m) => m.id !== user?.id && blocked.includes(m.id))
  );

  const activeChat = liveChats.find((c) => c.id === chatId);

  function handleChatCreated(id: string) {
    navigate(`/chat/${id}`);
  }

  return (
    <div className={`app-layout ${chatId ? "mobile-show-detail" : ""}`}>
      <Sidebar chats={visibleChats} activeChatId={chatId} onChatCreated={handleChatCreated} />
      {activeChat && isLocked(activeChat.id) && hasPassword && !unlocked ? (
        <div className="chat-window-empty">
          <LockPrompt title={`«${activeChat.name}» заблоковано`} onCancel={() => navigate("/")} />
        </div>
      ) : activeChat ? (
        <ChatWindow chat={activeChat} chats={visibleChats} />
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
