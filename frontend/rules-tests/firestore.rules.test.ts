// Firestore rules tests. NOT part of `npm run test` (needs the Firestore
// emulator + Java); run with `npm run test:rules`, see HANDOFF.md.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, FieldPath } from "firebase/firestore";

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
void deleteField;
