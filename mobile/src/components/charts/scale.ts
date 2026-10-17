/**
 * Small, dependency-free scale helpers for the SVG charts: a linear scale and
 * "nice" axis ticks (round numbers like 0 / 50 / 100 instead of 0 / 47.3 / 94.6).
 */

export type LinearScale = ((value: number) => number) & { domain: [number, number]; range: [number, number] };

/** Maps `domain` linearly onto `range`. A zero-width domain maps everything to the middle. */
export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const scale = ((value: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0))) as LinearScale;
  scale.domain = domain;
  scale.range = range;
  return scale;
}

/** A step of 1, 2, 2.5 or 5 × 10ⁿ that splits `span` into about `count` parts. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/**
 * Round tick values covering [min, max], about `count` intervals.
 * `zeroBased` forces the axis to start at 0 (required for bars, whose length
 * encodes the value; optional for lines, where a tight range shows change better).
 */
export function niceTicks(min: number, max: number, count = 4, zeroBased = false): number[] {
  let lo = zeroBased ? Math.min(0, min) : min;
  let hi = max;
  if (lo === hi) {
    // A flat series still needs a visible range around it.
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo = zeroBased ? 0 : lo - pad;
    hi = hi + pad;
  }
  const step = niceStep(hi - lo, count);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

/** Compact axis labels: 950 → "950", 1200 → "1.2K", 15000 → "15K", 2500000 → "2.5M". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K`;
  return trim(value);
}

function trim(value: number): string {
  return String(Number(value.toFixed(value >= 100 || value <= -100 ? 0 : 1)));
}

/** Index of the element of `xs` (sorted ascending) nearest to `x`. */
export function nearestIndex(xs: number[], x: number): number {
  if (xs.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < xs.length; i++) {
    if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  }
  return best;
}
