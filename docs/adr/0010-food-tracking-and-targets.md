# 0010: Food tracking: Open Food Facts, snapshotted entries, and adaptive targets

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

Lifters who track their training usually track body weight and food too, often
in a second app. We added body-weight tracking and a food diary: barcode
scanning, recipes, calorie and macro targets from a goal weight and timeline,
water, and an optional "share this recipe with friends".

That raised five questions: where food data comes from, how a logged meal
relates to the food it came from, how to set targets that are useful but not
reckless, how a noisy scale should be shown, and how food relates to the
friends feature.

## Decisions

### 1. Food data: Open Food Facts, cached, plus custom foods

[Open Food Facts](https://world.openfoodfacts.org) is a free, open (ODbL)
database of more than 3 million products with barcode lookup and no API key.
Commercial databases (Nutritionix, FatSecret, Edamam) have better coverage of
restaurant and generic foods but cost money or limit free use.

- `OpenFoodFactsClient` sits behind a small `FoodDatabase` interface (tests swap
  in a fake). Timeouts are short (4s connect, 8s read), and it sends an
  identifying User-Agent as the Open Food Facts terms ask.
- Every product we look up is **cached in the `food` table**, so the second
  scan of a barcode never leaves our database. That makes lookups fast and
  limits how much we depend on (and load) a free service.
- A barcode that isn't found opens "New food" with the barcode filled in. The
  user types the label in **per serving**, because that's how labels print
  values, and the server stores it per 100 g like everything else.
- **Quick add** (calories, optional macros) covers restaurant meals.

### 2. Diary entries snapshot their nutrition

A `food_log_entry` stores the computed calories and macros at the time of
logging, not just a reference to a food and an amount. Editing a custom food,
changing a recipe, or Open Food Facts correcting a product never rewrites what
you ate last month. This is the same "history is immutable" reasoning as
workouts. The food and recipe references are kept (nullable, `ON DELETE SET
NULL`) only for "recent foods" and re-logging.

### 3. Targets: a standard formula, safety rails, then adaptation

- **Starting estimate:** Mifflin-St Jeor BMR × an activity factor (1.2–1.9).
  It's the most accurate of the common equations for most adults and needs only
  sex, age, height and weight. "Prefer not to say" uses the midpoint of the two
  sex constants.
- **Pace from the timeline:** (goal − current weight) × 7,700 kcal/kg spread
  over the days to the goal date, **capped** at 1% of body weight per week when
  losing and 0.5% when gaining, with calorie floors (1,200 / 1,500 / 1,350 kcal).
  If the timeline is too aggressive, the app says so and shows the date the
  safe pace actually reaches.
- **Macros:** protein 1.8 g/kg (of goal weight when losing), fat 27% of calories
  with a floor of 0.6 g/kg, carbs are the rest. Fiber 14 g per 1,000 kcal,
  water 35 ml/kg.
- **Adaptive maintenance** (on by default): formulas are often off by 10–20%
  for an individual. Once there are 14+ well-logged days (≥ 800 kcal) and two
  weeks of weigh-ins, the server estimates real maintenance from the last 28
  days: average intake − (change in trend weight × 7,700 ÷ days). It blends in
  gradually (weight = logged days ÷ 28) and is clamped to ±30% of the formula,
  so a week of sloppy logging can't produce a silly number. The goal screen
  says which source is in use.

Targets are computed on request from the profile, weigh-ins and diary, never
stored, so they're always consistent with the data (same principle as PRs).

### 4. Body weight: show a trend, not the scale

Daily weight swings 1–2 kg with water and food. The app shows a **trend
weight**: an exponentially weighted moving average (10% per day, compounded
across days with no weigh-in), the same idea popularised by Libra and
MacroFactor. The headline, the weekly rate and the adaptive targets all use the
trend; individual weigh-ins are faint dots behind the line.

### 5. Privacy: food and weight stay private; recipes are opt-in sharing

Weight and eating are more sensitive than lifting numbers, so **diary, weigh-ins
and goals are never visible to friends**, whatever the workout-sharing setting.
The one exception is a recipe the owner explicitly marks **"Share with
friends"**:

- Friends see shared recipes (ingredients and nutrition) under Recipes → From
  friends. Non-friends get 404, through the same `FriendService` check used
  elsewhere ([ADR 0008](0008-friends-and-privacy.md)).
- Friends can't log someone else's recipe directly. They **save a copy**, which
  becomes their own recipe. The owner's custom-food ingredients are copied into
  the friend's foods, so the copy keeps working if the owner edits, unshares or
  deletes the original. A unique `(owner_id, copied_from)` index makes saving
  twice return the same copy.

## Consequences

- No paid food API and no keys, at the cost of weaker coverage for generic and
  restaurant foods. Search covers cached and custom foods, and Quick add fills
  the gap.
- Barcode scanning uses `expo-camera`, which runs in Expo Go on a phone (it
  needs camera permission). The web preview shows a message instead.
- Diary history is immutable by design. Fixing a food doesn't fix past entries;
  you edit the entry instead.
- The targets are general guidance for healthy adults, and the app says so. It
  is not medical advice.
