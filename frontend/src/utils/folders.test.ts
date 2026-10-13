import { describe, expect, it } from "vitest";
import { FREE_FOLDER_LIMIT, PREMIUM_FOLDER_LIMIT } from "../constants";
import { folderLimit, folderTabId, makeFolder, toggleChatInFolder } from "./folders";

describe("folders", () => {
  it("gives premium accounts more folders", () => {
    expect(folderLimit(false)).toBe(FREE_FOLDER_LIMIT);
    expect(folderLimit(true)).toBe(PREMIUM_FOLDER_LIMIT);
    expect(PREMIUM_FOLDER_LIMIT).toBeGreaterThan(FREE_FOLDER_LIMIT);
  });

  it("prefixes folder tabs so they never clash with the built-in ones", () => {
    expect(folderTabId("abc")).toBe("f:abc");
  });

  it("trims and caps the folder name", () => {
    const f = makeFolder("   Робота над дуже довгою назвою папки   ");
    expect(f.name.length).toBeLessThanOrEqual(20);
    expect(f.name.startsWith("Робота")).toBe(true);
    expect(f.chatIds).toEqual([]);
  });

  it("toggles a chat in and out of a folder without mutating it", () => {
    const f = makeFolder("Друзі", ["a"]);
    const added = toggleChatInFolder(f, "b");
    expect(added.chatIds).toEqual(["a", "b"]);
    expect(f.chatIds).toEqual(["a"]);
    expect(toggleChatInFolder(added, "a").chatIds).toEqual(["b"]);
  });
});
