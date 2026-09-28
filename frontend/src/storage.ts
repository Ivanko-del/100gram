import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";
import { DataError } from "./data/firestore-api";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Uploads (or overwrites) the signed-in user's avatar photo and returns
 * its public download URL. Stored at a stable per-user path so re-uploads
 * replace the old file instead of piling up orphans. */
export async function uploadAvatarPhoto(uid: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new DataError("Обери файл зображення");
  if (file.size > MAX_AVATAR_BYTES) throw new DataError("Фото завелике (максимум 5 МБ)");

  const avatarRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(avatarRef, file, { contentType: file.type });
  return getDownloadURL(avatarRef);
}

export async function removeAvatarPhoto(uid: string): Promise<void> {
  await deleteObject(ref(storage, `avatars/${uid}`)).catch(() => {});
}
