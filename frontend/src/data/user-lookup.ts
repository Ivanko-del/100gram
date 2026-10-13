import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getUserProfile, normalizeUsername } from "./firestore-api";
import type { User } from "../types";

/** "@username" -> profile, with a short-lived cache: hovering a mention fires
 * a lookup, and the same name usually shows up many times in a chat. A failed
 * lookup (network, rules) is never cached, so it is simply retried. */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; user: User | null }>();

export async function lookupUserByUsername(username: string): Promise<User | null> {
  const key = normalizeUsername(username);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.user;

  const snap = await getDoc(doc(db, "usernames", key));
  const uid = snap.exists() ? (snap.data() as { uid: string }).uid : null;
  const user = uid ? await getUserProfile(uid) : null;
  cache.set(key, { at: Date.now(), user });
  return user;
}
