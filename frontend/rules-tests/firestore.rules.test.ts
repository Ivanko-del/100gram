// Firestore rules tests. NOT part of `npm run test` (needs the Firestore
// emulator + Java); run with `npm run test:rules`, see HANDOFF.md.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch, Timestamp, FieldPath } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "rules-test",
    firestore: { rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8") },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { username: "Alice", usernameLower: "alice", grams: 100 });
    await setDoc(doc(db, "users/bob"), { username: "Bob", usernameLower: "bob", grams: 100 });
    await setDoc(doc(db, "users/admin"), { username: "theivankoo", usernameLower: "theivankoo", grams: 0 });
    await setDoc(doc(db, "chats/dm"), { memberUids: ["alice", "bob"], adminUids: [], isGroup: false, readBy: {} });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("chats.deliveredTo", () => {
  it("member can write own deliveredTo", async () => {
    await assertSucceeds(updateDoc(doc(as("bob"), "chats/dm"), new FieldPath("deliveredTo", "bob"), serverTimestamp()));
  });
  it("member cannot write someone else's deliveredTo", async () => {
    await assertFails(updateDoc(doc(as("bob"), "chats/dm"), new FieldPath("deliveredTo", "alice"), serverTimestamp()));
  });
  it("non-member cannot write deliveredTo", async () => {
    await assertFails(updateDoc(doc(as("eve"), "chats/dm"), new FieldPath("deliveredTo", "eve"), serverTimestamp()));
  });
  it("deliveredTo cannot ride along with other keys", async () => {
    await assertFails(updateDoc(doc(as("bob"), "chats/dm"), { name: "x", deliveredTo: { bob: serverTimestamp() } }));
  });
  it("readBy still works", async () => {
    await assertSucceeds(updateDoc(doc(as("bob"), "chats/dm"), new FieldPath("readBy", "bob"), serverTimestamp()));
    await assertFails(updateDoc(doc(as("bob"), "chats/dm"), new FieldPath("readBy", "alice"), serverTimestamp()));
  });
});

describe("reports", () => {
  const base = () => ({
    reporterUid: "alice",
    targetUid: "bob",
    reason: "spam",
    createdAt: serverTimestamp(),
    status: "open",
  });

  it("signed-in user can report someone", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "reports/alice_bob_user"), base()));
  });
  it("with message context and comment", async () => {
    await assertSucceeds(
      setDoc(doc(as("alice"), "reports/alice_bob_m1"), { ...base(), chatId: "dm", messageId: "m1", messageText: "hi", comment: "rude" })
    );
  });
  it("anonymous cannot report", async () => {
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "reports/alice_bob_user"), base()));
  });
  it("cannot report as someone else", async () => {
    await assertFails(setDoc(doc(as("bob"), "reports/alice_bob_user"), base()));
  });
  it("cannot report yourself", async () => {
    await assertFails(setDoc(doc(as("alice"), "reports/alice_alice_user"), { ...base(), targetUid: "alice" }));
  });
  it("rejects unknown reason, extra keys, wrong status, long text, client createdAt", async () => {
    const db = as("alice");
    await assertFails(setDoc(doc(db, "reports/alice_bob_user"), { ...base(), reason: "boring" }));
    await assertFails(setDoc(doc(db, "reports/alice_bob_user"), { ...base(), extra: 1 }));
    await assertFails(setDoc(doc(db, "reports/alice_bob_user"), { ...base(), status: "closed" }));
    await assertFails(setDoc(doc(db, "reports/alice_bob_m1"), { ...base(), messageId: "m1", messageText: "x".repeat(501) }));
    await assertFails(setDoc(doc(db, "reports/alice_bob_user"), { ...base(), comment: "x".repeat(501) }));
    await assertFails(setDoc(doc(db, "reports/alice_bob_user"), { ...base(), createdAt: new Date() }));
  });
  it("enforces the deterministic document id", async () => {
    const db = as("alice");
    await assertFails(setDoc(doc(db, "reports/random1"), base()));
    await assertFails(setDoc(doc(db, "reports/alice_bob_user"), { ...base(), messageId: "m1" }));
  });
  it("a repeat report (update) is denied to the reporter", async () => {
    const db = as("alice");
    await assertSucceeds(setDoc(doc(db, "reports/alice_bob_user"), base()));
    await assertFails(setDoc(doc(db, "reports/alice_bob_user"), base()));
  });
  it("reporter cannot read, update or delete", async () => {
    const db = as("alice");
    await assertSucceeds(setDoc(doc(db, "reports/alice_bob_user"), base()));
    await assertFails(getDoc(doc(db, "reports/alice_bob_user")));
    await assertFails(updateDoc(doc(db, "reports/alice_bob_user"), { status: "closed" }));
  });
  it("site admin can read and close", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "reports/alice_bob_user"), base()));
    const admin = as("admin");
    await assertSucceeds(getDoc(doc(admin, "reports/alice_bob_user")));
    await assertSucceeds(updateDoc(doc(admin, "reports/alice_bob_user"), { status: "closed" }));
  });
  it("other users cannot read reports", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "reports/alice_bob_user"), base()));
    await assertFails(getDoc(doc(as("bob"), "reports/alice_bob_user")));
  });
});

describe("chats/messages create", () => {
  const msg = (over: Record<string, unknown> = {}) => ({
    senderUid: "alice", senderUsername: "alice", senderDisplayName: "Alice", senderAvatarColor: "#fff",
    content: "hi", type: "text", createdAt: serverTimestamp(), ...over,
  });
  const put = (data: Record<string, unknown>, uid = "alice") => setDoc(doc(as(uid), "chats/dm/messages/m1"), data);

  it("accepts text, reply, forward, poll and image", async () => {
    await assertSucceeds(put(msg()));
    await assertSucceeds(setDoc(doc(as("alice"), "chats/dm/messages/m2"), msg({ replyTo: { id: "m1", name: "A", text: "hi", type: "text" }, forwardedFrom: "bob" })));
    await assertSucceeds(setDoc(doc(as("alice"), "chats/dm/messages/m3"), msg({ type: "poll", content: "Q?", poll: { question: "Q?", options: ["a", "b"], votes: {} } })));
    await assertSucceeds(setDoc(doc(as("alice"), "chats/dm/messages/m4"), msg({ type: "image", content: "data:image/jpeg;base64," + "A".repeat(700_000) })));
  });
  it("text up to 4000 chars ok, 4001 rejected", async () => {
    await assertSucceeds(put(msg({ content: "x".repeat(4000) })));
    await assertFails(setDoc(doc(as("alice"), "chats/dm/messages/m2"), msg({ content: "x".repeat(4001) })));
    await assertFails(setDoc(doc(as("alice"), "chats/dm/messages/m3"), msg({ type: "poll", content: "x".repeat(4001) })));
  });
  it("rejects oversized image, bad type, non-string content", async () => {
    await assertFails(put(msg({ type: "image", content: "A".repeat(900_001) })));
    await assertFails(put(msg({ type: "video" })));
    await assertFails(put(msg({ content: 5 })));
    const { content: _c, ...noContent } = msg();
    void _c;
    await assertFails(put(noContent));
  });
  it("createdAt must be the server time", async () => {
    await assertFails(put(msg({ createdAt: new Date() })));
    await assertFails(put(msg({ createdAt: Timestamp.fromDate(new Date("2000-01-01")) })));
  });
  it("still requires own senderUid and membership", async () => {
    await assertFails(put(msg({ senderUid: "bob" })));
    await assertFails(put(msg({ senderUid: "eve" }), "eve"));
  });
});

describe("chats update: sendMessage batch, lastMessage, updatedAt", () => {
  const send = (uid: string, over: { lastMessage?: Record<string, unknown> | null; updatedAt?: unknown } = {}) => {
    const db = as(uid);
    const t = serverTimestamp();
    const b = writeBatch(db);
    b.set(doc(db, "chats/dm/messages/m1"), { senderUid: uid, content: "hi", type: "text", createdAt: t });
    b.update(doc(db, "chats/dm"), {
      updatedAt: "updatedAt" in over ? over.updatedAt : t,
      lastMessage: "lastMessage" in over ? over.lastMessage : { content: "hi", senderUid: uid, createdAt: t },
      [`readBy.${uid}`]: t,
    });
    return b.commit();
  };

  it("legit sendMessage batch passes", async () => {
    await assertSucceeds(send("alice"));
  });
  it("lastMessage cannot impersonate another sender", async () => {
    await assertFails(send("alice", { lastMessage: { content: "hi", senderUid: "bob", createdAt: serverTimestamp() } }));
  });
  it("lastMessage.createdAt / updatedAt must be server time", async () => {
    await assertFails(send("alice", { lastMessage: { content: "hi", senderUid: "alice", createdAt: new Date() } }));
    await assertFails(send("alice", { updatedAt: new Date("2099-01-01") }));
  });
  it("lastMessage rejects extra keys and huge content", async () => {
    await assertFails(send("alice", { lastMessage: { content: "hi", senderUid: "alice", createdAt: serverTimestamp(), x: 1 } }));
    await assertFails(send("alice", { lastMessage: { content: "x".repeat(5000), senderUid: "alice", createdAt: serverTimestamp() } }));
  });
  it("editMessage / deleteMessage preview repair (lastMessage alone, old time) passes", async () => {
    const db = as("alice");
    await assertSucceeds(updateDoc(doc(db, "chats/dm"), { lastMessage: { content: "edited", senderUid: "alice", createdAt: Timestamp.fromDate(new Date("2024-01-01")) } }));
    await assertSucceeds(updateDoc(doc(db, "chats/dm"), { lastMessage: { content: "prev", senderUid: "bob", createdAt: Timestamp.fromDate(new Date("2024-01-01")) } }));
    await assertSucceeds(updateDoc(doc(db, "chats/dm"), { lastMessage: null }));
  });
  it("lastMessage repair cannot be in the future", async () => {
    await assertFails(updateDoc(doc(as("alice"), "chats/dm"), { lastMessage: { content: "x", senderUid: "bob", createdAt: Timestamp.fromDate(new Date("2099-01-01")) } }));
  });
  it("non-member cannot touch lastMessage", async () => {
    await assertFails(updateDoc(doc(as("eve"), "chats/dm"), { lastMessage: null }));
  });
  it("updatedAt alone must be server time", async () => {
    await assertSucceeds(updateDoc(doc(as("alice"), "chats/dm"), { updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as("alice"), "chats/dm"), { updatedAt: new Date() }));
  });
});

describe("readBy / deliveredTo must be server time", () => {
  it("own entry with a client date is rejected", async () => {
    await assertFails(updateDoc(doc(as("bob"), "chats/dm"), new FieldPath("readBy", "bob"), new Date()));
    await assertFails(updateDoc(doc(as("bob"), "chats/dm"), new FieldPath("deliveredTo", "bob"), Timestamp.fromDate(new Date("2099-01-01"))));
  });
  it("own entry with serverTimestamp is accepted", async () => {
    await assertSucceeds(updateDoc(doc(as("bob"), "chats/dm"), new FieldPath("readBy", "bob"), serverTimestamp()));
    await assertSucceeds(updateDoc(doc(as("bob"), "chats/dm"), new FieldPath("deliveredTo", "bob"), serverTimestamp()));
  });
});

describe("users.grams raise by a non-owner", () => {
  it("raise up to 1 000 000 passes, more is rejected", async () => {
    await assertSucceeds(updateDoc(doc(as("alice"), "users/bob"), { grams: 100 + 1_000_000 }));
    await assertFails(updateDoc(doc(as("alice"), "users/bob"), { grams: 100 + 1_000_000 + 1 + 1_000_000 }));
  });
  it("lowering or other fields are rejected", async () => {
    await assertFails(updateDoc(doc(as("alice"), "users/bob"), { grams: 1 }));
    await assertFails(updateDoc(doc(as("alice"), "users/bob"), { grams: 101, isPremium: true }));
  });
  it("owner is unaffected by the cap", async () => {
    await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), { grams: 5_000_000 }));
  });
});

describe("users/{uid}/transactions create", () => {
  const incoming = (over: Record<string, unknown> = {}) => ({
    amount: 50, type: "transfer", note: null, counterpart: "alice", counterpartUsername: "Alice", createdAt: serverTimestamp(), ...over,
  });
  const putTx = (data: Record<string, unknown>, by = "alice") => setDoc(doc(as(by), "users/bob/transactions/t1"), data);

  it("counterpart can write a normal incoming transfer", async () => {
    await assertSucceeds(putTx(incoming()));
    await assertSucceeds(setDoc(doc(as("alice"), "users/bob/transactions/t2"), incoming({ note: "pizza" })));
  });
  it("counterpart cannot write other types, bad amounts, extra keys, client time", async () => {
    await assertFails(putTx(incoming({ type: "axioma_topup" })));
    await assertFails(putTx(incoming({ type: "premium_purchase" })));
    await assertFails(putTx(incoming({ amount: -5 })));
    await assertFails(putTx(incoming({ amount: 0 })));
    await assertFails(putTx(incoming({ amount: 1_000_001 })));
    await assertFails(putTx(incoming({ amount: "50" })));
    await assertFails(putTx(incoming({ extra: 1 })));
    await assertFails(putTx(incoming({ createdAt: new Date() })));
    await assertFails(putTx(incoming({ note: "x".repeat(501) })));
  });
  it("cannot claim a different counterpart; owner stays flexible", async () => {
    await assertFails(putTx(incoming({ counterpart: "carol" })));
    await assertSucceeds(setDoc(doc(as("bob"), "users/bob/transactions/t3"), { amount: -10, type: "premium_purchase", note: "n", counterpart: null, counterpartUsername: null, createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(as("bob"), "users/bob/transactions/t4"), { amount: -50, type: "transfer", note: null, counterpart: "alice", counterpartUsername: "Alice", createdAt: serverTimestamp() }));
  });
  it("transactions are immutable", async () => {
    await assertSucceeds(putTx(incoming()));
    await assertFails(updateDoc(doc(as("bob"), "users/bob/transactions/t1"), { amount: 9 }));
  });
});
void deleteField;
