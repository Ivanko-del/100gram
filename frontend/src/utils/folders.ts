import { FREE_FOLDER_LIMIT, MAX_FOLDER_NAME, PREMIUM_FOLDER_LIMIT } from "../constants";
import type { ChatFolder } from "../types";

export function folderLimit(isPremium: boolean): number {
  return isPremium ? PREMIUM_FOLDER_LIMIT : FREE_FOLDER_LIMIT;
}

/** Id of a folder's tab in the chat list filter (built-in tabs have no prefix). */
export function folderTabId(folderId: string): string {
  return `f:${folderId}`;
}

export function makeFolder(name: string, chatIds: string[] = []): ChatFolder {
  return { id: crypto.randomUUID().slice(0, 8), name: name.trim().slice(0, MAX_FOLDER_NAME), chatIds };
}

/** Adds the chat to the folder, or takes it out when it is already there. */
export function toggleChatInFolder(folder: ChatFolder, chatId: string): ChatFolder {
  const has = folder.chatIds.includes(chatId);
  return { ...folder, chatIds: has ? folder.chatIds.filter((id) => id !== chatId) : [...folder.chatIds, chatId] };
}
