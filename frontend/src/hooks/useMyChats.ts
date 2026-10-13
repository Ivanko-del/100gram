import { useEffect, useState } from "react";
import { subscribeChats } from "../data/firestore-api";
import { ChatSummary } from "../types";

/** The signed-in user's chats, live (for settings screens that list them). */
export function useMyChats(uid: string): ChatSummary[] {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  useEffect(() => subscribeChats(uid, setChats), [uid]);
  return chats;
}
