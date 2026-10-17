# 0007: Focus progress tracking on strength, records and consistency

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
The first version of the Progress tab (Phase 3) showed totals for workouts,
volume (Σ weight × reps, "tonnage") and sets with percentage changes, a
weekly/monthly volume chart switchable to workouts or sets, a sets-by-muscle-group
chart, a session-volume personal record, and per-exercise volume charts.

Testing on a phone, the product owner found the screen busy and the volume
numbers not useful: no lifter decides what to do next based on "526K lb lifted
this quarter."

## Decision
Progress answers three questions, and only shows what serves them:

1. **Is each lift getting stronger?** For each lift trained in the range:
   the change in estimated one-rep max (reps for bodyweight movements) with a
   sparkline, and a per-exercise chart of estimated 1RM or heaviest weight
   per session, above a list of the sessions themselves.
2. **Did I set records?** Recent personal records in the range (heaviest weight,
   best estimated 1RM), one row per lift per session.
3. **Am I consistent?** Workouts in the range vs. the previous period, and
   the weekly streak.

Removed: volume everywhere (tiles, charts, history cards, the session-volume
record), the muscle-group split, set totals, and the duplicate "Last time" line
in the logger (the PREVIOUS column already shows it set by set). The API was
trimmed to match, so no unused endpoints or fields remain.

## Consequences
- A shorter, calmer Progress tab, where every number answers a question.
- Fewer API fields and less code (the column/bar charts and their bucketing
  logic are gone).
- Volume-based training (e.g. hypertrophy programs tracking weekly sets per
  muscle) isn't supported. It could return later as an opt-in view if users ask.
