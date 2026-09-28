import { DataError } from "../data/firestore-api";

/** Downscales an image client-side and returns it as a small JPEG data URL,
 * small enough to store directly on Firestore - no Storage bucket (and
 * therefore no Blaze plan) needed. Each message is its own small document,
 * so a bigger budget than the avatar case is fine (default 700 KB, well
 * under Firestore's 1 MB per-document limit). */
export function compressImageToDataUrl(file: File, maxDim = 160, quality = 0.7, maxBytes = 700_000): Promise<string> {
  if (!file.type.startsWith("image/")) return Promise.reject(new DataError("Обери файл зображення"));

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new DataError("Не вдалося обробити зображення"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length > maxBytes) {
        reject(new DataError("Фото завелике навіть після стиснення - спробуй інше"));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new DataError("Не вдалося прочитати зображення"));
    };
    img.src = objectUrl;
  });
}
