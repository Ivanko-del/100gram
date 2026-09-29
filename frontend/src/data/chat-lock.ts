import { arrayRemove, arrayUnion, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/** Per-user chat lock: an optional password, plus which chats are locked
 * (need the password to open) and which are hidden (out of the list, found
 * only in "Приховані чати"). Stored in users/{uid}/private/chatlock, which
 * only the owner can read - other users must not see who locks what.
 *
 * This is an app-level lock, NOT encryption: messages stay readable to
 * anyone with database access. It keeps chats away from casual peeking. */

export interface ChatLock {
  /** hex; absent until a password is set */
  salt?: string;
  hash?: string;
  locked: string[];
  hidden: string[];
}

const EMPTY: ChatLock = { locked: [], hidden: [] };
const lockRef = (uid: string) => doc(db, "users", uid, "private", "chatlock");

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function derive(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}

export function subscribeChatLock(uid: string, cb: (lock: ChatLock) => void) {
  return onSnapshot(
    lockRef(uid),
    (snap) => {
      const d = snap.exists() ? snap.data() : {};
      cb({
        salt: d.salt as string | undefined,
        hash: d.hash as string | undefined,
        locked: (d.locked as string[]) ?? [],
        hidden: (d.hidden as string[]) ?? [],
      });
    },
    () => cb(EMPTY)
  );
}

export async function verifyLockPassword(lock: ChatLock, password: string): Promise<boolean> {
  if (!lock.salt || !lock.hash) return false;
  return (await derive(password, lock.salt)) === lock.hash;
}

export async function setLockPassword(uid: string, password: string): Promise<void> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  await setDoc(lockRef(uid), { salt, hash: await derive(password, salt) }, { merge: true });
}

/** Removes the password and every lock/hide flag (hidden chats reappear). */
export async function clearChatLock(uid: string): Promise<void> {
  await deleteDoc(lockRef(uid));
}

export async function setChatLocked(uid: string, chatId: string, on: boolean): Promise<void> {
  await setDoc(lockRef(uid), { locked: on ? arrayUnion(chatId) : arrayRemove(chatId) }, { merge: true });
}

export async function setChatHidden(uid: string, chatId: string, on: boolean): Promise<void> {
  await setDoc(lockRef(uid), { hidden: on ? arrayUnion(chatId) : arrayRemove(chatId) }, { merge: true });
}
