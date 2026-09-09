import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseAuthUser,
} from "firebase/auth";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAt,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { AVATAR_COLORS, WELCOME_BONUS } from "../constants";
import { ChatMessage, ChatSummary, PremiumPlan, PublicUser, User, WalletTransaction } from "../types";

export class DataError extends Error {}

function tsToIso(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  return new Date().toISOString();
}
function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/* ---------------- auth ---------------- */

export function watchAuth(cb: (fbUser: FirebaseAuthUser | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const usernameLower = username.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  try {
    await runTransaction(db, async (tx) => {
      const usernameRef = doc(db, "usernames", usernameLower);
      const usernameSnap = await tx.get(usernameRef);
      if (usernameSnap.exists()) throw new DataError("Це ім'я користувача вже зайняте");

      const userRef = doc(db, "users", uid);
      tx.set(usernameRef, { uid });
      tx.set(userRef, {
        uid,
        username,
        usernameLower,
        displayName,
        bio: "Привіт! Я користуюсь 100 ГРАМ 🥃",
        avatarColor: randomColor(),
        isPremium: false,
        premiumUntil: null,
        grams: WELCOME_BONUS,
        createdAt: serverTimestamp(),
      });
      const txRef = doc(collection(userRef, "transactions"));
      tx.set(txRef, {
        amount: WELCOME_BONUS,
        type: "welcome_bonus",
        note: "Вітальний бонус",
        counterpart: null,
        counterpartUsername: null,
        createdAt: serverTimestamp(),
      });
    });
  } catch (err) {
    await cred.user.delete().catch(() => {});
    if (err instanceof DataError) throw err;
    throw new DataError("Не вдалося завершити реєстрацію");
  }
  return uid;
}

export async function loginUser(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/* ---------------- users ---------------- */

function mapUser(snap: { id: string; data: () => Record<string, unknown> }): User {
  const d = snap.data();
  return {
    id: snap.id,
    username: d.username as string,
    displayName: d.displayName as string,
    bio: (d.bio as string) ?? "",
    avatarColor: d.avatarColor as string,
    isPremium: !!d.isPremium,
    premiumUntil: d.premiumUntil ? tsToIso(d.premiumUntil) : null,
    grams: (d.grams as number) ?? 0,
  };
}

export function subscribeUser(uid: string, cb: (user: User | null) => void) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? mapUser(snap) : null);
  });
}

export async function updateProfile(uid: string, patch: { displayName?: string; bio?: string; avatarColor?: string }) {
  await updateDoc(doc(db, "users", uid), patch);
}

export async function searchUsers(queryText: string, excludeUid: string): Promise<PublicUser[]> {
  const qLower = queryText.trim().toLowerCase();
  if (qLower.length < 2) return [];
  const qy = query(
    collection(db, "users"),
    orderBy("usernameLower"),
    startAt(qLower),
    endAt(qLower + ""),
    limit(20)
  );
  const snap = await getDocs(qy);
  return snap.docs
    .filter((d) => d.id !== excludeUid)
    .map((d) => {
      const u = mapUser(d);
      return { id: u.id, username: u.username, displayName: u.displayName, bio: u.bio, avatarColor: u.avatarColor, isPremium: u.isPremium };
    });
}

/* ---------------- chats ---------------- */

interface MemberProfile {
  username: string;
  displayName: string;
  avatarColor: string;
}

function mapChat(snap: { id: string; data: () => Record<string, unknown> }, myUid: string): ChatSummary {
  const d = snap.data();
  const memberUids = (d.memberUids as string[]) ?? [];
  const profiles = (d.memberProfiles as Record<string, MemberProfile>) ?? {};
  const isGroup = !!d.isGroup;
  const otherUid = memberUids.find((u) => u !== myUid);
  const name = isGroup ? ((d.name as string) ?? "Група") : (otherUid ? profiles[otherUid]?.displayName ?? "Чат" : "Чат");
  const avatarColor = isGroup ? "#8774e1" : otherUid ? profiles[otherUid]?.avatarColor ?? "#999" : "#999";
  const lastMessage = d.lastMessage
    ? {
        content: (d.lastMessage as any).content,
        senderId: (d.lastMessage as any).senderUid,
        createdAt: tsToIso((d.lastMessage as any).createdAt),
      }
    : null;
  return {
    id: snap.id,
    isGroup,
    name,
    avatarColor,
    members: memberUids.map((u) => ({
      id: u,
      username: profiles[u]?.username ?? u,
      displayName: profiles[u]?.displayName ?? u,
      avatarColor: profiles[u]?.avatarColor ?? "#999",
      bio: "",
      isPremium: false,
    })),
    lastMessage,
    updatedAt: d.updatedAt ? tsToIso(d.updatedAt) : tsToIso(d.createdAt),
  };
}

export function subscribeChats(myUid: string, cb: (chats: ChatSummary[]) => void) {
  const qy = query(collection(db, "chats"), where("memberUids", "array-contains", myUid));
  return onSnapshot(qy, (snap) => {
    const chats = snap.docs.map((d) => mapChat(d, myUid));
    chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    cb(chats);
  });
}

export async function startDirectChat(me: User, otherUsername: string): Promise<string> {
  const usernameLower = otherUsername.trim().toLowerCase();
  const unameSnap = await getDoc(doc(db, "usernames", usernameLower));
  if (!unameSnap.exists()) throw new DataError("Користувача не знайдено");
  const otherUid = (unameSnap.data() as { uid: string }).uid;
  if (otherUid === me.id) throw new DataError("Не можна писати самому собі");

  const chatId = "dm_" + [me.id, otherUid].sort().join("_");
  const chatRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) {
    const otherSnap = await getDoc(doc(db, "users", otherUid));
    if (!otherSnap.exists()) throw new DataError("Користувача не знайдено");
    const other = mapUser(otherSnap);
    await setDoc(chatRef, {
      isGroup: false,
      name: null,
      memberUids: [me.id, otherUid].sort(),
      memberProfiles: {
        [me.id]: { username: me.username, displayName: me.displayName, avatarColor: me.avatarColor },
        [otherUid]: { username: other.username, displayName: other.displayName, avatarColor: other.avatarColor },
      },
      lastMessage: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return chatId;
}

/* ---------------- messages ---------------- */

function mapMessage(snap: { id: string; data: () => Record<string, unknown> }, chatId: string): ChatMessage {
  const d = snap.data();
  return {
    id: snap.id,
    chatId,
    content: d.content as string,
    type: "text",
    createdAt: tsToIso(d.createdAt),
    sender: {
      id: d.senderUid as string,
      username: (d.senderUsername as string) ?? "",
      displayName: d.senderDisplayName as string,
      avatarColor: d.senderAvatarColor as string,
    },
  };
}

export function subscribeMessages(chatId: string, cb: (messages: ChatMessage[]) => void) {
  const qy = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(200));
  return onSnapshot(qy, (snap) => {
    cb(snap.docs.map((d) => mapMessage(d, chatId)));
  });
}

export async function sendMessage(chatId: string, sender: User, content: string) {
  const chatRef = doc(db, "chats", chatId);
  const msgRef = doc(collection(chatRef, "messages"));
  const createdAt = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(msgRef, {
    senderUid: sender.id,
    senderUsername: sender.username,
    senderDisplayName: sender.displayName,
    senderAvatarColor: sender.avatarColor,
    content,
    createdAt,
  });
  batch.update(chatRef, {
    updatedAt: createdAt,
    lastMessage: { content, senderUid: sender.id, createdAt },
  });
  await batch.commit();
}

/* ---------------- typing indicator ---------------- */

const TYPING_TTL_MS = 4000;

export async function setTyping(chatId: string, uid: string, username: string, isTyping: boolean) {
  const ref = doc(db, "chats", chatId, "typing", uid);
  if (isTyping) {
    await setDoc(ref, { username, updatedAt: serverTimestamp() });
  } else {
    await deleteDoc(ref).catch(() => {});
  }
}

export function subscribeTyping(chatId: string, myUid: string, cb: (usernames: string[]) => void) {
  return onSnapshot(collection(db, "chats", chatId, "typing"), (snap) => {
    const now = Date.now();
    const names = snap.docs
      .filter((d) => d.id !== myUid)
      .map((d) => d.data() as { username: string; updatedAt: Timestamp | null })
      .filter((t) => t.updatedAt && now - t.updatedAt.toDate().getTime() < TYPING_TTL_MS)
      .map((t) => t.username);
    cb(names);
  });
}

/* ---------------- wallet ---------------- */

function mapTx(snap: { id: string; data: () => Record<string, unknown> }): WalletTransaction {
  const d = snap.data();
  const amount = d.amount as number;
  return {
    id: snap.id,
    amount,
    type: d.type as string,
    note: (d.note as string) ?? null,
    createdAt: tsToIso(d.createdAt),
    direction: amount >= 0 ? "in" : "out",
    counterparty: { username: (d.counterpartUsername as string) ?? "100gram", displayName: (d.counterpartUsername as string) ?? "100 ГРАМ" },
  };
}

export function subscribeTransactions(uid: string, cb: (txs: WalletTransaction[]) => void) {
  const qy = query(collection(db, "users", uid, "transactions"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(qy, (snap) => cb(snap.docs.map(mapTx)));
}

export async function transferGrams(fromUid: string, fromUsername: string, toUsername: string, amount: number, note: string | null) {
  const toUsernameLower = toUsername.trim().toLowerCase();
  const unameSnap = await getDoc(doc(db, "usernames", toUsernameLower));
  if (!unameSnap.exists()) throw new DataError("Отримувача не знайдено");
  const toUid = (unameSnap.data() as { uid: string }).uid;
  if (toUid === fromUid) throw new DataError("Не можна переказати собі");

  await runTransaction(db, async (tx) => {
    const fromRef = doc(db, "users", fromUid);
    const toRef = doc(db, "users", toUid);
    const fromSnap = await tx.get(fromRef);
    const toSnap = await tx.get(toRef);
    if (!fromSnap.exists() || !toSnap.exists()) throw new DataError("Помилка гаманця");
    const fromData = fromSnap.data() as { grams: number };
    const toData = toSnap.data() as { grams: number; username: string };
    if (fromData.grams < amount) throw new DataError("Недостатньо ГРАМів");

    tx.update(fromRef, { grams: fromData.grams - amount });
    tx.update(toRef, { grams: toData.grams + amount });

    const fromTxRef = doc(collection(fromRef, "transactions"));
    const toTxRef = doc(collection(toRef, "transactions"));
    tx.set(fromTxRef, { amount: -amount, type: "transfer", note, counterpart: toUid, counterpartUsername: toData.username, createdAt: serverTimestamp() });
    tx.set(toTxRef, { amount, type: "transfer", note, counterpart: fromUid, counterpartUsername: fromUsername, createdAt: serverTimestamp() });
  });
}

export async function buyPremium(uid: string, plan: PremiumPlan) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "users", uid);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new DataError("Помилка гаманця");
    const data = snap.data() as { grams: number; premiumUntil: Timestamp | null };
    if (data.grams < plan.price) throw new DataError("Недостатньо ГРАМів");

    const now = new Date();
    const base = data.premiumUntil && data.premiumUntil.toDate() > now ? data.premiumUntil.toDate() : now;
    const premiumUntil = new Date(base.getTime() + plan.days * 24 * 60 * 60 * 1000);

    tx.update(ref, { grams: data.grams - plan.price, isPremium: true, premiumUntil: Timestamp.fromDate(premiumUntil) });
    const txRef = doc(collection(ref, "transactions"));
    tx.set(txRef, { amount: -plan.price, type: "premium_purchase", note: `Преміум: ${plan.label}`, counterpart: null, counterpartUsername: null, createdAt: serverTimestamp() });
  });
}
