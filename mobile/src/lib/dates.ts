/**
 * Calendar dates (YYYY-MM-DD) in the user's own time zone. Diary days and
 * weigh-ins belong to a local calendar day, not a UTC instant.
 */
export function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

/** "Today", "Yesterday", "Tomorrow", or "Wed, Oct 15". */
export function dayLabel(isoDate: string, today = localDate()): string {
  if (isoDate === today) return 'Today';
  if (isoDate === addDays(today, -1)) return 'Yesterday';
  if (isoDate === addDays(today, 1)) return 'Tomorrow';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
