import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { ChatLock, subscribeChatLock, verifyLockPassword } from "../data/chat-lock";

// After the app has been in the background this long, locked chats lock again
const RELOCK_AFTER_MS = 2 * 60 * 1000;

interface ChatLockValue {
  lock: ChatLock;
  hasPassword: boolean;
  /** password entered recently: locked chats and the hidden list are open */
  unlocked: boolean;
  tryUnlock: (password: string) => Promise<boolean>;
  lockNow: () => void;
  isLocked: (chatId: string) => boolean;
  isHidden: (chatId: string) => boolean;
}

const EMPTY: ChatLock = { locked: [], hidden: [] };
const Ctx = createContext<ChatLockValue | null>(null);

export function ChatLockProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const [lock, setLock] = useState<ChatLock>(EMPTY);
  const [unlocked, setUnlocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    setUnlocked(false);
    if (!uid) {
      setLock(EMPTY);
      return;
    }
    return subscribeChatLock(uid, setLock);
  }, [uid]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        setUnlocked(false);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const tryUnlock = useCallback(
    async (password: string) => {
      const ok = await verifyLockPassword(lock, password);
      if (ok) setUnlocked(true);
      return ok;
    },
    [lock]
  );

  const value = useMemo<ChatLockValue>(
    () => ({
      lock,
      hasPassword: !!lock.hash,
      unlocked,
      tryUnlock,
      lockNow: () => setUnlocked(false),
      isLocked: (id) => lock.locked.includes(id),
      isHidden: (id) => lock.hidden.includes(id),
    }),
    [lock, unlocked, tryUnlock]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatLock(): ChatLockValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChatLock must be used inside ChatLockProvider");
  return v;
}
