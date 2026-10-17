/** Date labels for chart axes, tooltips and tables. */

const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear();

/** "Oct 12", or "Oct 12, 2025" outside the current year. */
export function shortDate(input: string | number | Date): string {
  const d = new Date(input);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear(d) ? undefined : 'numeric' });
}

/** Compact axis label: "Oct 12", or "Oct '25" for points in another year. */
export function axisDate(input: string | number | Date): string {
  const d = new Date(input);
  if (sameYear(d)) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${d.toLocaleDateString(undefined, { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
}

/** Bucket start dates come as "2026-10-12" (a calendar date, not an instant); parse as local. */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}
