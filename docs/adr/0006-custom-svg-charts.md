# 0006: Custom SVG charts instead of a charting library

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
Progress charts are the core of the app's value: lifters need to see whether
they're getting stronger over any time range. The charts must:

- run in Expo Go (no custom native modules),
- follow the project's data-visualization rules: one axis only, thin marks,
  fixed bar widths with rounded data ends, recessive hairline grid, no number
  on every point, a table view for every chart, and colors validated for
  contrast in light and dark mode,
- support touch scrubbing (drag to read any session) without fighting the
  screen's vertical scrolling.

## Options considered
1. **Victory Native / Skia-based libraries.** Fast and flexible, but they pull in
   Skia, Reanimated and Gesture Handler versions that must match the SDK, and
   their default styling would need overriding everywhere to meet the mark specs.
2. **react-native-chart-kit / gifted-charts.** Quick to start, but opinionated
   visuals (gradients, value labels on every point) that conflict with the rules,
   and limited control over interaction.
3. **Small custom components on `react-native-svg`** (already bundled in Expo Go):
   a linear scale, "nice" ticks, and four chart types (line, column, horizontal
   bars, sparkline).

## Decision
Option 3. About 400 lines of focused, unit-tested code in
`mobile/src/components/charts/`.

## Consequences
- Every visual detail matches the spec exactly: 2px lines, 8px ringed markers,
  ≤24px columns with 4px rounded tops, time-proportional x positions, and a
  fixed readout row rather than a tooltip under the finger.
- Axis text is drawn with native `Text` rather than SVG text, so it uses the
  system font and tabular digits on every platform.
- No third-party chart dependency to keep in sync with Expo SDK upgrades.
- More code to own. That's acceptable for four chart types, but it would be revisited
  if the app needed many more (e.g. heatmaps or zoomable charts).
