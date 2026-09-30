const pad = (n: number) => String(n).padStart(2, "0");

/** "в мережі" / "був(ла) сьогодні о 14:05" / "був(ла) вчора о …" / "був(ла) 12.05".
 * `iso` null means hidden or never recorded. */
export function formatLastSeen(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "був(ла) нещодавно";
  const d = new Date(iso);
  const diff = now.getTime() - d.getTime();
  if (diff < 2 * 60_000) return "в мережі";
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(d)) / 86_400_000);
  if (days <= 0) return `був(ла) сьогодні о ${time}`;
  if (days === 1) return `був(ла) вчора о ${time}`;
  if (days < 7) return `був(ла) ${days} дн. тому`;
  return `був(ла) ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
