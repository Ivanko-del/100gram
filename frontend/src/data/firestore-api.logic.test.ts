import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  runTransaction: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: {},
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  onAuthStateChanged: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  FieldPath: class {},
  Timestamp: class {},
  arrayRemove: vi.fn(),
  arrayUnion: vi.fn(),
  collection: (...a: unknown[]) => ({ collection: a }),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  doc: (...a: unknown[]) => ({ doc: a }),
  endAt: vi.fn(),
  getDoc: fs.getDoc,
  getCountFromServer: vi.fn(),
  getDocs: vi.fn(),
  increment: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: fs.runTransaction,
  serverTimestamp: () => "SERVER_TS",
  setDoc: fs.setDoc,
  startAt: vi.fn(),
  updateDoc: fs.updateDoc,
  where: vi.fn(),
  writeBatch: fs.writeBatch,
}));

vi.mock("../firebase", () => ({ auth: {}, db: {} }));

import { DataError, ReportError, markChatDelivered, submitReport, topUpGramsFromAxioma, transferGrams, buyPremium } from "./firestore-api";
import { reportDocId } from "../utils/reports";

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  return store;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("navigator", { onLine: true });
  stubStorage();
});
afterEach(() => vi.unstubAllGlobals());

/** Runs the transaction callback against fake user docs. */
function fakeTransaction(users: Record<string, { grams: number; username?: string }>) {
  const tx = {
    get: vi.fn(async (ref: { doc: unknown[] }) => {
      const u = users[ref.doc[2] as string];
      return { exists: () => !!u, data: () => u };
    }),
    update: vi.fn(),
    set: vi.fn(),
  };
  fs.runTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => Promise<void>) => fn(tx));
  return tx;
}

describe("transferGrams validation", () => {
  it.each([[1.5], [0], [-5], [1_000_001], [NaN]])("rejects amount %s", async (amount) => {
    await expect(transferGrams("me", "me", "bob", amount, null)).rejects.toThrow("Вкажи цілу суму від 1 до 1 000 000 ГРАМ");
    expect(fs.getDoc).not.toHaveBeenCalled();
  });

  it("accepts the boundary amounts 1 and 1_000_000", async () => {
    fs.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ uid: "bob" }) });
    fakeTransaction({ me: { grams: 2_000_000 }, bob: { grams: 0, username: "bob" } });
    await expect(transferGrams("me", "me", "bob", 1, null)).resolves.toBeUndefined();
    await expect(transferGrams("me", "me", "bob", 1_000_000, null)).resolves.toBeUndefined();
  });

  it("fails when the recipient username does not exist", async () => {
    fs.getDoc.mockResolvedValue({ exists: () => false });
    await expect(transferGrams("me", "me", "@ghost", 10, null)).rejects.toThrow("Отримувача не знайдено");
    expect(fs.runTransaction).not.toHaveBeenCalled();
  });

  it("refuses a transfer to yourself", async () => {
    fs.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ uid: "me" }) });
    await expect(transferGrams("me", "me", "me", 10, null)).rejects.toThrow("Не можна переказати собі");
    expect(fs.runTransaction).not.toHaveBeenCalled();
  });

  it("fails with insufficient funds and writes nothing", async () => {
    fs.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ uid: "bob" }) });
    const tx = fakeTransaction({ me: { grams: 5 }, bob: { grams: 0, username: "bob" } });
    await expect(transferGrams("me", "me", "bob", 10, null)).rejects.toThrow("Недостатньо ГРАМів");
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("moves grams between both wallets on success", async () => {
    fs.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ uid: "bob" }) });
    const tx = fakeTransaction({ me: { grams: 100 }, bob: { grams: 7, username: "bob" } });
    await transferGrams("me", "me", "bob", 30, "дякую");
    expect(tx.update).toHaveBeenCalledWith(expect.anything(), { grams: 70 });
    expect(tx.update).toHaveBeenCalledWith(expect.anything(), { grams: 37 });
  });

  it("turns a network failure inside the transaction into the offline message", async () => {
    fs.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ uid: "bob" }) });
    fs.runTransaction.mockRejectedValue(Object.assign(new Error("x"), { code: "unavailable" }));
    await expect(transferGrams("me", "me", "bob", 10, null)).rejects.toThrow("Потрібен інтернет");
  });
});

describe("offline guard", () => {
  beforeEach(() => vi.stubGlobal("navigator", { onLine: false }));

  it("transferGrams throws DataError before touching Firestore", async () => {
    const p = transferGrams("me", "me", "bob", 10, null);
    await expect(p).rejects.toBeInstanceOf(DataError);
    await expect(p).rejects.toThrow("Потрібен інтернет");
    expect(fs.getDoc).not.toHaveBeenCalled();
  });

  it("buyPremium throws 'Потрібен інтернет'", async () => {
    await expect(buyPremium("me", { id: "m", label: "Місяць", days: 30, price: 10 } as never)).rejects.toThrow("Потрібен інтернет");
    expect(fs.runTransaction).not.toHaveBeenCalled();
  });

  it("topUpGramsFromAxioma throws 'Потрібен інтернет'", async () => {
    await expect(topUpGramsFromAxioma("me", 10, 5)).rejects.toThrow("Потрібен інтернет");
    expect(fs.writeBatch).not.toHaveBeenCalled();
  });
});

describe("submitReport", () => {
  const base = { reporterUid: "a", targetUid: "b", reason: "spam" as const };

  it("rejects an unknown reason", async () => {
    await expect(submitReport({ ...base, reason: "nope" as never })).rejects.toThrow("Обери причину скарги");
    expect(fs.setDoc).not.toHaveBeenCalled();
  });

  it("throws ReportError 'already' when remembered in localStorage", async () => {
    const store = stubStorage();
    store.set("stogram_reported_a", JSON.stringify([reportDocId("a", "b", null)]));
    const err = await submitReport(base).catch((e) => e);
    expect(err).toBeInstanceOf(ReportError);
    expect(err.kind).toBe("already");
    expect(fs.setDoc).not.toHaveBeenCalled();
  });

  it("maps permission-denied to ReportError 'unavailable'", async () => {
    fs.setDoc.mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    const err = await submitReport(base).catch((e) => e);
    expect(err).toBeInstanceOf(ReportError);
    expect(err.kind).toBe("unavailable");
  });

  it("does not remember the report when it failed", async () => {
    const store = stubStorage();
    fs.setDoc.mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    await submitReport(base).catch(() => {});
    expect(store.size).toBe(0);
  });

  it("on success writes the report and remembers its id (second attempt is 'already')", async () => {
    fs.setDoc.mockResolvedValue(undefined);
    await submitReport({ ...base, messageId: "m1", comment: "  hi  " });
    expect(fs.setDoc).toHaveBeenCalledTimes(1);
    expect(fs.setDoc.mock.calls[0][1]).toMatchObject({ reporterUid: "a", targetUid: "b", comment: "hi", status: "open", messageId: "m1" });
    const err = await submitReport({ ...base, messageId: "m1" }).catch((e) => e);
    expect(err).toBeInstanceOf(ReportError);
    expect(err.kind).toBe("already");
  });
});

describe("markChatDelivered", () => {
  it("swallows a rules denial", async () => {
    fs.updateDoc.mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    await expect(markChatDelivered("c", "u")).resolves.toBeUndefined();
  });
  it("calls updateDoc once on success", async () => {
    fs.updateDoc.mockResolvedValue(undefined);
    await markChatDelivered("c", "u");
    expect(fs.updateDoc).toHaveBeenCalledTimes(1);
  });
});
