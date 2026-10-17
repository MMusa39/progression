# 0011: Measure nutrition consistency as "days on target", not averages alone

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

People asked to see how consistently they hit their calorie and macro goals.
An average can hide inconsistency: eating 1,600 kcal on weekdays and 3,300 on
weekends averages close to a 2,100 target while missing it every day. Popular
apps show either daily bars against a goal line (MyFitnessPal) or adherence
percentages (MacroFactor). We wanted one clear answer plus the detail behind it.

## Decision

The trends view leads with **"N of M days on target"** for the chosen nutrient,
then shows a bar per day (or per week for long ranges) against a shaded target
zone, then weekly averages as a table.

The rules live on the server (`NutritionTrends`) and are returned with the data,
so the app's chart bands and the counts can't disagree:

| Nutrient | On target when | Why |
| --- | --- | --- |
| Calories | within ±10% of the target | Close enough to stay on pace; daily precision isn't realistic. |
| Protein | at least 90% of the target | It's a minimum for muscle retention; going over isn't a miss. |
| Carbs, fat | within ±15% | They're the flexible part of the budget. |

Other choices:

- **Unlogged days are gaps, not zeros.** A zero would read as "ate nothing" and
  wreck the averages. "Days logged" and the logging streak measure logging
  consistency separately.
- **Today isn't judged until it's over.** It's drawn as an outlined
  "in progress" bar and left out of counts and averages.
- **The range starts at the first logged day.** Choosing "3 months" a week
  after you start shouldn't report 80 missed days.
- **Compared with current targets.** Targets aren't stored per day, so older
  days are measured against today's numbers. This is simpler and usually close
  enough. Storing a daily target snapshot would fix it if targets start
  changing a lot.
- **Long ranges chart weekly averages** (more than 42 days), so bars stay
  readable on a phone.
- **Off-target bars turn neutral grey** as a secondary cue. Position against
  the band is the primary one, and the touch readout says "335 kcal over" in
  words, so color is never the only signal.

## Consequences

- One number answers "am I consistent?", and the chart shows where the misses
  are (often weekends).
- Old days are judged against today's targets, as described above.
