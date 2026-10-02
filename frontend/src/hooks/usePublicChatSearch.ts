import { useEffect, useState } from "react";
import { searchPublicChats } from "../data/firestore-api";
import { ChatSummary } from "../types";

/** Debounced search over public groups/channels by name or description. */
export function usePublicChatSearch(queryText: string, myUid: string | undefined) {
  const [results, setResults] = useState<ChatSummary[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = queryText.trim();
    if (q.length < 2 || !myUid) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const found = await searchPublicChats(q, myUid);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [queryText, myUid]);

  return { results, searching };
}
