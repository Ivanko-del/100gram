import { useEffect, useRef, useState } from "react";
import { countMessagesSince } from "../data/firestore-api";
import { ChatSummary } from "../types";
import { isUnread } from "../utils/unread";

/** chatId -> number of unread messages. Counted server-side, and only for
 * chats that actually have news; results are cached per last-message time so
 * a busy chat list doesn't re-count on every snapshot. */
export function useUnreadCounts(chats: ChatSummary[], myUid: string | undefined): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const cache = useRef<Map<string, number>>(new Map());

  const unread = myUid ? chats.filter((c) => isUnread(c, myUid)) : [];
  const key = unread.map((c) => `${c.id}:${c.lastMessage?.createdAt}:${c.readBy[myUid!]}`).join("|");

  useEffect(() => {
    if (!myUid) return;
    let cancelled = false;
    const next: Record<string, number> = {};
    const pending: Promise<void>[] = [];
    for (const c of unread) {
      const ck = `${c.id}:${c.lastMessage?.createdAt}:${c.readBy[myUid]}`;
      const cached = cache.current.get(ck);
      if (cached !== undefined) {
        next[c.id] = cached;
        continue;
      }
      next[c.id] = 1; // show at least one until the exact count arrives
      pending.push(
        countMessagesSince(c.id, c.readBy[myUid])
          .then((n) => {
            cache.current.set(ck, Math.max(1, n));
            next[c.id] = Math.max(1, n);
          })
          .catch(() => {})
      );
    }
    setCounts({ ...next });
    if (pending.length) Promise.all(pending).then(() => !cancelled && setCounts({ ...next }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, myUid]);

  return counts;
}
