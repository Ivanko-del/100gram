/** 1536 -> "1,5 КБ" (Ukrainian units, decimal comma). */
export function formatBytes(bytes: number): string {
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = Math.max(0, bytes);
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const text = i === 0 || value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace(".", ",");
  return `${text} ${units[i]}`;
}
