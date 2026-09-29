import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User as FirebaseAuthUser,
} from "firebase/auth";
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  endAt,
  getDoc,
  getDocs,
  increment,
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
import { normalizePhone } from "../utils/phone";
import { ChatMessage, ChatSummary, PremiumPlan, PublicUser, User, UserBadge, WalletTransaction } from "../types";

export class DataError extends Error {}

/** Accepts "@olha" or "olha" alike - usernames are stored without the "@". */
function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

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

/** Firebase Auth keeps the email locally for the signed-in user - it is
 * never stored in the Firestore user doc, so read it from here. */
export function getCurrentEmail(): string | null {
  return auth.currentUser?.email ?? null;
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
  displayName: string,
  birthDate: string | null = null,
  phone: string | null = null
): Promise<string> {
  const usernameLower = username.trim().toLowerCase();
  if (phone) {
    // Cheap pre-check so the person hears "number taken" before an auth
    // account gets created (the transaction below is the real guard).
    const taken = await getDoc(doc(db, "phones", phone)).then((s) => s.exists()).catch(() => false);
    if (taken) throw new DataError("Цей номер телефону вже зареєстровано");
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  try {
    await runTransaction(db, async (tx) => {
      const usernameRef = doc(db, "usernames", usernameLower);
      const usernameSnap = await tx.get(usernameRef);
      if (usernameSnap.exists()) throw new DataError("Це ім'я користувача вже зайняте");

      const phoneRef = phone ? doc(db, "phones", phone) : null;
      if (phoneRef) {
        const phoneSnap = await tx.get(phoneRef);
        if (phoneSnap.exists()) throw new DataError("Цей номер телефону вже зареєстровано");
        tx.set(phoneRef, { uid, email });
      }

      const userRef = doc(db, "users", uid);
      tx.set(usernameRef, { uid });
      tx.set(userRef, {
        uid,
        username,
        usernameLower,
        displayName,
        birthDate,
        phone,
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

/** Sign in with an email address, or with a phone number that was saved on
 * the account (looked up to the email Firebase Auth actually uses). */
export async function loginUser(identifier: string, password: string): Promise<void> {
  const id = identifier.trim();
  let email = id;
  if (!id.includes("@")) {
    const phone = normalizePhone(id);
    if (!phone) throw new DataError("Введи email або номер телефону");
    const snap = await getDoc(doc(db, "phones", phone)).catch(() => null);
    const found = snap?.exists() ? (snap.data() as { email?: string }).email : undefined;
    if (!found) throw new DataError("Акаунт із таким номером не знайдено");
    email = found;
  }
  await signInWithEmailAndPassword(auth, email, password);
}

/** Finds a user by phone number (exact match), for the "new chat" search. */
export async function searchUserByPhone(phone: string, excludeUid: string): Promise<PublicUser | null> {
  const snap = await getDoc(doc(db, "phones", phone)).catch(() => null);
  if (!snap?.exists()) return null;
  const uid = (snap.data() as { uid: string }).uid;
  if (uid === excludeUid) return null;
  const u = await getUserProfile(uid);
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl,
    isPremium: u.isPremium,
  };
}

/** Sets, changes or clears the phone on the signed-in account, keeping the
 * unique `phones/{digits}` reservation in step with it. */
export async function setMyPhone(uid: string, oldPhone: string | null, newPhone: string | null): Promise<void> {
  if (oldPhone === newPhone) return;
  const email = auth.currentUser?.email ?? null;
  await runTransaction(db, async (tx) => {
    if (newPhone) {
      const ref = doc(db, "phones", newPhone);
      const snap = await tx.get(ref);
      if (snap.exists() && (snap.data() as { uid: string }).uid !== uid) {
        throw new DataError("Цей номер телефону вже використовується");
      }
      tx.set(ref, { uid, email });
    }
    if (oldPhone) tx.delete(doc(db, "phones", oldPhone));
    tx.update(doc(db, "users", uid), { phone: newPhone });
  });
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

async function reauthenticate(currentPassword: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email) throw new DataError("Ви не увійшли в акаунт");
  try {
    await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(fbUser.email, currentPassword));
  } catch {
    throw new DataError("Невірний поточний пароль");
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await reauthenticate(currentPassword);
  try {
    await updatePassword(auth.currentUser!, newPassword);
  } catch {
    throw new DataError("Не вдалося змінити пароль");
  }
}

/** Deletes the account's own profile data and Firebase Auth user. Chats
 * and messages the account took part in are left in place - removing
 * them everywhere they're referenced is out of scope here - but the
 * username is freed up and the account itself is gone. */
export async function deleteAccount(currentPassword: string, uid: string, usernameLower: string, phone?: string | null): Promise<void> {
  await reauthenticate(currentPassword);
  if (phone) await deleteDoc(doc(db, "phones", phone)).catch(() => {});
  await deleteDoc(doc(db, "usernames", usernameLower)).catch(() => {});
  await deleteDoc(doc(db, "users", uid)).catch(() => {});
  await deleteUser(auth.currentUser!);
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
    avatarUrl: (d.avatarUrl as string) ?? null,
    isPremium: !!d.isPremium,
    premiumUntil: d.premiumUntil ? tsToIso(d.premiumUntil) : null,
    grams: (d.grams as number) ?? 0,
    mutedGlobally: !!d.mutedGlobally,
    birthDate: (d.birthDate as string) ?? null,
    phone: (d.phone as string) ?? null,
    hideBirthDate: !!d.hideBirthDate,
    pinnedChats: (d.pinnedChats as string[]) ?? [],
    archivedChats: (d.archivedChats as string[]) ?? [],
    hiddenChats: (d.hiddenChats as Record<string, string>) ?? {},
    badge: (d.badge as UserBadge) ?? null,
    showAdminBadge: !!d.showAdminBadge,
  };
}

export function subscribeUser(uid: string, cb: (user: User | null) => void) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? mapUser(snap) : null);
  });
}

export async function updateProfile(
  uid: string,
  patch: { displayName?: string; bio?: string; avatarColor?: string; avatarUrl?: string | null; showAdminBadge?: boolean; birthDate?: string | null; hideBirthDate?: boolean }
) {
  await updateDoc(doc(db, "users", uid), patch);
}

/** Site-admin only: grants or clears a custom badge on someone else's
 * profile. Firestore rules restrict this write to the hardcoded
 * SITE_ADMIN_USERNAME and to only this one field. */
export async function setUserBadge(uid: string, badge: UserBadge | null): Promise<void> {
  await updateDoc(doc(db, "users", uid), { badge });
}

/** Site-admin only: mutes/unmutes a user across every chat. */
export async function setGlobalMute(uid: string, muted: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), { mutedGlobally: muted });
}

/** Fetches another user's profile to display (bio, premium status, ...).
 * The result also carries `grams`/`email` because they come off the same
 * document, but the UI must not show those for anyone but yourself. */
export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? mapUser(snap) : null;
}

export async function searchUsers(queryText: string, excludeUid: string): Promise<PublicUser[]> {
  const qLower = normalizeUsername(queryText);
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
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        avatarColor: u.avatarColor,
        avatarUrl: u.avatarUrl,
        isPremium: u.isPremium,
      };
    });
}

/* ---------------- chats ---------------- */

interface MemberProfile {
  username: string;
  displayName: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

function toMemberProfile(u: { username: string; displayName: string; avatarColor: string; avatarUrl?: string | null }): MemberProfile {
  return { username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, avatarUrl: u.avatarUrl ?? null };
}

function mapChat(snap: { id: string; data: () => Record<string, unknown> }, myUid: string): ChatSummary {
  const d = snap.data();
  const memberUids = (d.memberUids as string[]) ?? [];
  const profiles = (d.memberProfiles as Record<string, MemberProfile>) ?? {};
  const isGroup = !!d.isGroup;
  const isChannel = !!d.isChannel;
  const otherUid = memberUids.find((u) => u !== myUid);
  const isSaved = !isGroup && snap.id === savedChatId(myUid);
  const name = isSaved
    ? "Збережене"
    : isGroup
    ? (d.name as string) ?? (isChannel ? "Канал" : "Група")
    : otherUid
      ? profiles[otherUid]?.displayName ?? "Чат"
      : "Чат";
  const avatarColor = isSaved ? "#8b6cf0" : isGroup ? (isChannel ? "#3d8fdb" : "#8774e1") : otherUid ? profiles[otherUid]?.avatarColor ?? "#999" : "#999";
  const avatarUrl = isGroup ? null : otherUid ? profiles[otherUid]?.avatarUrl ?? null : null;
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
    isChannel,
    isSaved,
    name,
    avatarColor,
    avatarUrl,
    members: memberUids.map((u) => ({
      id: u,
      username: profiles[u]?.username ?? u,
      displayName: profiles[u]?.displayName ?? u,
      avatarColor: profiles[u]?.avatarColor ?? "#999",
      avatarUrl: profiles[u]?.avatarUrl ?? null,
      bio: "",
      isPremium: false,
    })),
    adminUids: (d.adminUids as string[]) ?? [],
    mutedUids: (d.mutedUids as string[]) ?? [],
    lastMessage,
    updatedAt: d.updatedAt ? tsToIso(d.updatedAt) : tsToIso(d.createdAt),
  };
}

/* ---------------- Saved messages + chat list prefs ---------------- */

export function savedChatId(uid: string): string {
  return "saved_" + uid;
}

/** Everyone's private "Saved messages" chat: a chat whose only member is
 * its owner. Created lazily the first time it is opened. */
export async function ensureSavedChat(me: User): Promise<string> {
  const chatId = savedChatId(me.id);
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    await setDoc(chatRef, {
      isGroup: false,
      isChannel: false,
      name: null,
      memberUids: [me.id],
      memberProfiles: { [me.id]: toMemberProfile(me) },
      adminUids: [],
      lastMessage: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return chatId;
}

export async function setChatPinned(uid: string, chatId: string, pinned: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), { pinnedChats: pinned ? arrayUnion(chatId) : arrayRemove(chatId) });
}

export async function setChatArchived(uid: string, chatId: string, archived: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    archivedChats: archived ? arrayUnion(chatId) : arrayRemove(chatId),
    // archiving an already-pinned chat unpins it, like Telegram
    ...(archived ? { pinnedChats: arrayRemove(chatId) } : {}),
  });
}

/** "Delete" a chat for this user only: it disappears from their list until
 * a newer message arrives. The other members' copy is untouched. */
export async function hideChatForMe(uid: string, chatId: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    [`hiddenChats.${chatId}`]: new Date().toISOString(),
    pinnedChats: arrayRemove(chatId),
    archivedChats: arrayRemove(chatId),
  });
}

/** Live profile of another user (avatar/name), so chat lists don't rely on
 * the copy frozen into `memberProfiles` when the chat was created. */
export function subscribePublicProfile(uid: string, cb: (u: User | null) => void) {
  return onSnapshot(doc(db, "users", uid), (snap) => cb(snap.exists() ? mapUser(snap) : null));
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
  const usernameLower = normalizeUsername(otherUsername);
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
      isChannel: false,
      name: null,
      memberUids: [me.id, otherUid].sort(),
      memberProfiles: {
        [me.id]: toMemberProfile(me),
        [otherUid]: toMemberProfile(other),
      },
      adminUids: [],
      lastMessage: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return chatId;
}

/**
 * Creates a group (everyone can post) or a channel (only admins can post).
 * `memberUsernames` are the initial members besides the creator, who is
 * always added as a member and as the first admin.
 */
export async function createGroupChat(
  creator: User,
  name: string,
  memberUsernames: string[],
  isChannel: boolean
): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new DataError("Вкажи назву");

  const uniqueUsernames = Array.from(new Set(memberUsernames.map((u) => u.trim().replace(/^@/, "")).filter(Boolean)));
  const memberProfiles: Record<string, MemberProfile> = {
    [creator.id]: toMemberProfile(creator),
  };
  const memberUids = [creator.id];

  for (const username of uniqueUsernames) {
    const unameSnap = await getDoc(doc(db, "usernames", normalizeUsername(username)));
    if (!unameSnap.exists()) throw new DataError(`Користувача @${username} не знайдено`);
    const uid = (unameSnap.data() as { uid: string }).uid;
    if (uid === creator.id || memberUids.includes(uid)) continue;
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) continue;
    const u = mapUser(userSnap);
    memberUids.push(uid);
    memberProfiles[uid] = toMemberProfile(u);
  }

  const chatId = (isChannel ? "ch_" : "grp_") + crypto.randomUUID();
  const chatRef = doc(db, "chats", chatId);
  await setDoc(chatRef, {
    isGroup: true,
    isChannel,
    name: trimmedName,
    memberUids,
    memberProfiles,
    adminUids: [creator.id],
    lastMessage: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return chatId;
}

/**
 * Invites more people into an existing group/channel by @username.
 * A plain group lets any current member invite; a channel needs admin
 * rights (matched by firestore.rules - see the "member addition" clause).
 */
export async function addChatMembers(chat: ChatSummary, usernames: string[]): Promise<void> {
  const uniqueUsernames = Array.from(new Set(usernames.map((u) => u.trim().replace(/^@/, "")).filter(Boolean)));
  if (uniqueUsernames.length === 0) return;

  const newMemberUids: string[] = [];
  const newProfiles: Record<string, MemberProfile> = {};

  for (const username of uniqueUsernames) {
    const unameSnap = await getDoc(doc(db, "usernames", normalizeUsername(username)));
    if (!unameSnap.exists()) throw new DataError(`Користувача @${username} не знайдено`);
    const uid = (unameSnap.data() as { uid: string }).uid;
    if (chat.members.some((m) => m.id === uid) || newMemberUids.includes(uid)) continue;
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) continue;
    const u = mapUser(userSnap);
    newMemberUids.push(uid);
    newProfiles[uid] = toMemberProfile(u);
  }
  if (newMemberUids.length === 0) return;

  const patch: Record<string, unknown> = { memberUids: arrayUnion(...newMemberUids) };
  for (const uid of newMemberUids) patch[`memberProfiles.${uid}`] = newProfiles[uid];
  await updateDoc(doc(db, "chats", chat.id), patch);
}

/** Admin-only: kicks a member out of a group/channel entirely. */
export async function removeChatMember(chatId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "chats", chatId), {
    memberUids: arrayRemove(uid),
    adminUids: arrayRemove(uid),
    [`memberProfiles.${uid}`]: deleteField(),
  });
}

/** Admin-only: promotes or demotes a member. */
export async function setChatAdmin(chatId: string, uid: string, makeAdmin: boolean): Promise<void> {
  await updateDoc(doc(db, "chats", chatId), {
    adminUids: makeAdmin ? arrayUnion(uid) : arrayRemove(uid),
  });
}

/** Admin-only: renames a group/channel. */
export async function renameChat(chatId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new DataError("Вкажи назву");
  await updateDoc(doc(db, "chats", chatId), { name: trimmed });
}

/** Admin-only: mutes/unmutes a member within just this one chat. */
export async function setChatMute(chatId: string, uid: string, muted: boolean): Promise<void> {
  await updateDoc(doc(db, "chats", chatId), {
    mutedUids: muted ? arrayUnion(uid) : arrayRemove(uid),
  });
}

/* ---------------- messages ---------------- */

function mapMessage(snap: { id: string; data: () => Record<string, unknown> }, chatId: string): ChatMessage {
  const d = snap.data();
  return {
    id: snap.id,
    chatId,
    content: d.content as string,
    type: d.type === "image" ? "image" : "text",
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

export async function sendMessage(chatId: string, sender: User, content: string, type: "text" | "image" = "text") {
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
    type,
    createdAt,
  });
  batch.update(chatRef, {
    updatedAt: createdAt,
    lastMessage: { content: type === "image" ? "📷 Фото" : content, senderUid: sender.id, createdAt },
  });
  await batch.commit();
}

/** Deletes a message. Firestore rules allow this for the message's own
 * sender, or the site admin deleting anywhere as moderation. */
export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
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
  const toUsernameLower = normalizeUsername(toUsername);
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

/* ---------------- Аксіома Банк ---------------- */

/** Credits ГРАМ after a successful `withdrawFromAxioma` - call this only
 * once the Аксіома card debit has actually gone through. */
export async function topUpGramsFromAxioma(uid: string, grams: number, axiomaAmount: number): Promise<void> {
  const ref = doc(db, "users", uid);
  const txRef = doc(collection(ref, "transactions"));
  const batch = writeBatch(db);
  batch.update(ref, { grams: increment(grams) });
  batch.set(txRef, {
    amount: grams,
    type: "axioma_topup",
    note: `Поповнення з картки Аксіоми (${axiomaAmount} ₴)`,
    counterpart: null,
    counterpartUsername: null,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Grants premium paid for directly with the Аксіома card - no ГРАМ change,
 * call only once the Аксіома card debit has actually gone through. */
export async function grantPremiumFromAxioma(uid: string, plan: PremiumPlan): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "users", uid);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new DataError("Помилка гаманця");
    const data = snap.data() as { premiumUntil: Timestamp | null };

    const now = new Date();
    const base = data.premiumUntil && data.premiumUntil.toDate() > now ? data.premiumUntil.toDate() : now;
    const premiumUntil = new Date(base.getTime() + plan.days * 24 * 60 * 60 * 1000);

    tx.update(ref, { isPremium: true, premiumUntil: Timestamp.fromDate(premiumUntil) });
    const txRef = doc(collection(ref, "transactions"));
    tx.set(txRef, {
      amount: 0,
      type: "premium_purchase_axioma",
      note: `Преміум карткою Аксіоми: ${plan.label}`,
      counterpart: null,
      counterpartUsername: null,
      createdAt: serverTimestamp(),
    });
  });
}
