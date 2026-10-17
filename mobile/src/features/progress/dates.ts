/** Date labels for chart axes, tooltips and tables. */

const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear();

/** A bare calendar date ("2026-10-12") is a local day; `new Date()` would read it as UTC midnight. */
const toDate = (input: string | number | Date) =>
  typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) ? parseLocalDate(input) : new Date(input);

/** "Oct 12", or "Oct 12, 2025" outside the current year. */
export function shortDate(input: string | number | Date): string {
  const d = toDate(input);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear(d) ? undefined : 'numeric' });
}

/** Compact axis label: "Oct 12", or "Oct '25" for points in another year. */
export function axisDate(input: string | number | Date): string {
  const d = toDate(input);
  if (sameYear(d)) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${d.toLocaleDateString(undefined, { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
}

/** Bucket start dates come as "2026-10-12" (a calendar date, not an instant); parse as local. */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}
