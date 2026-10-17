#!/usr/bin/env python3
"""
Seed the LOCAL API with realistic training history, so the Progress charts
have something to show during development. Also seeds six weeks of weigh-ins,
four weeks of food-diary entries and a nutrition goal (skip with --no-food).

Creates ~16 weeks of a push / pull / legs program for one user: three sessions
a week, weights that progress with some realistic noise, a deload week, a
missed week, and warm-up sets. Safe to re-run: the same --seed produces the
same workout ids, and PUT is idempotent.

Usage (API running with `./gradlew bootRun`):
    python3 backend/scripts/seed_dev_data.py                  # user "dev-user"
    python3 backend/scripts/seed_dev_data.py --subject alice --weeks 26

Only works against the local profile (it uses POST /dev/token).
"""
import argparse
import datetime as dt
import json
import random
import urllib.error
import urllib.request
import uuid

PROGRAM = {
    # day name: [(exercise, start weight lb, weekly increase lb, reps, working sets)]
    "Push Day": [("Bench Press", 155, 2.5, 8, 3), ("Overhead Press", 85, 1.25, 8, 3),
                 ("Incline Dumbbell Press", 50, 1, 10, 3), ("Triceps Pushdown", 40, 1, 12, 3)],
    "Pull Day": [("Deadlift", 225, 5, 5, 3), ("Barbell Row", 135, 2.5, 8, 3),
                 ("Lat Pulldown", 120, 2, 10, 3), ("Pull-Up", 0, 0, 8, 3)],
    "Leg Day": [("Back Squat", 185, 5, 6, 3), ("Romanian Deadlift", 135, 2.5, 8, 3),
                ("Leg Press", 270, 5, 10, 3), ("Standing Calf Raise", 140, 2, 12, 3)],
}


def request(base, method, path, token=None, body=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req) as resp:
        text = resp.read().decode()
        return json.loads(text) if text else None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default="http://localhost:8080")
    parser.add_argument("--subject", default="dev-user")
    parser.add_argument("--weeks", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-food", action="store_true", help="only seed workouts")
    args = parser.parse_args()
    rng = random.Random(args.seed)
    ids = uuid.UUID(int=rng.getrandbits(128))  # namespace for deterministic ids

    token = request(args.api, "POST", "/dev/token",
                    body={"subject": args.subject, "email": f"{args.subject}@progression.dev"})["accessToken"]
    catalog = {e["name"]: e["id"] for e in request(args.api, "GET", "/api/v1/exercises", token)}

    # Anchor on a Monday so each program week is one calendar week (Mon / Wed / Fri sessions).
    today = dt.datetime.now(dt.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - dt.timedelta(days=today.weekday(), weeks=args.weeks - 1)
    created = skipped = 0
    for week in range(args.weeks):
        if week == args.weeks // 2:
            continue  # a missed week (vacation)
        deload = week % 6 == 5
        for day_index, (name, exercises) in enumerate(PROGRAM.items()):
            started = start + dt.timedelta(weeks=week, days=day_index * 2, hours=17 + rng.randint(0, 2), minutes=rng.randint(0, 59))
            if started > dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=2):
                continue
            workout_exercises = []
            for ex_index, (exercise, base, step, reps, sets) in enumerate(exercises):
                weight = base + step * week * (0.6 if deload else 1)
                weight = round(weight / 2.5) * 2.5
                exercise_sets = []
                if base >= 135:  # warm-up for the heavy compounds
                    exercise_sets.append(("WARMUP", round(weight * 0.6 / 5) * 5, 8))
                for s in range(sets):
                    r = max(1, reps - (s if rng.random() < 0.5 else 0) + rng.choice([0, 0, 1, -1]))
                    exercise_sets.append(("WORKING", weight, r + (4 if base == 0 and week > args.weeks // 2 else 0)))
                workout_exercises.append({
                    "id": str(uuid.uuid5(ids, f"{week}-{day_index}-{ex_index}")),
                    "exerciseId": catalog[exercise],
                    "notes": None,
                    "sets": [{
                        "id": str(uuid.uuid5(ids, f"{week}-{day_index}-{ex_index}-{i}")),
                        "setType": t, "weight": w, "weightUnit": "LB", "reps": r, "rpe": None,
                        "completedAt": (started + dt.timedelta(minutes=5 + ex_index * 12 + i * 3)).isoformat(),
                    } for i, (t, w, r) in enumerate(exercise_sets)],
                })
            ended = started + dt.timedelta(minutes=55 + rng.randint(0, 25))
            workout_id = str(uuid.uuid5(ids, f"workout-{week}-{day_index}"))
            try:
                request(args.api, "PUT", f"/api/v1/workouts/{workout_id}", token, {
                    "name": name, "startedAt": started.isoformat(), "endedAt": ended.isoformat(),
                    "notes": None, "updatedAt": ended.isoformat(), "exercises": workout_exercises,
                })
                created += 1
            except urllib.error.HTTPError as error:
                if error.code != 409:
                    raise
                skipped += 1  # the server already has a newer copy of this workout
    print(f"Seeded {created} workouts over {args.weeks} weeks for '{args.subject}'"
          + (f" ({skipped} already existed)." if skipped else "."))
    seed_routines(args, token, catalog, ids)
    if not args.no_food:
        seed_body_and_food(args, token, rng, ids)


def seed_routines(args, token, catalog, ids):
    """One routine per program day, with rep ranges around the program's reps."""
    for name, exercises in PROGRAM.items():
        request(args.api, "PUT", f"/api/v1/routines/{uuid.uuid5(ids, f'routine-{name}')}", token, {
            "name": name,
            "exercises": [{"exerciseId": catalog[exercise], "sets": sets, "repMin": max(1, reps - 2), "repMax": reps}
                          for exercise, _, _, reps, sets in exercises],
        })
    print(f"Seeded {len(PROGRAM)} routines.")


# (meal, name, kcal, protein, carbs, fat): a typical day while cutting
MEALS = [
    ("BREAKFAST", "Greek yogurt, oats & berries", 480, 38, 62, 9),
    ("LUNCH", "Chicken rice bowl", 690, 52, 78, 16),
    ("SNACK", "Protein shake & banana", 260, 26, 32, 3),
    ("DINNER", "Salmon, potatoes & greens", 720, 44, 58, 32),
]


def seed_body_and_food(args, token, rng, ids):
    """Weigh-ins trending ~180 -> 176 lb, a goal, and a diary that fits the trend."""
    today = dt.date.today()
    weigh_ins = 0
    for back in range(42, -1, -1):
        day = today - dt.timedelta(days=back)
        if back > 0 and rng.random() < 0.25:
            continue  # nobody weighs in every single day
        weight = 180 - (42 - back) * 0.1 + rng.uniform(-1.2, 1.2)
        request(args.api, "PUT", f"/api/v1/body-weights/{day}", token,
                {"weight": round(weight, 1), "weightUnit": "LB", "today": str(today)})
        weigh_ins += 1

    if request(args.api, "GET", "/api/v1/nutrition/profile", token) is None:
        request(args.api, "PUT", "/api/v1/nutrition/profile", token, {
            "sex": "MALE", "birthYear": 1999, "heightCm": 178, "activityLevel": "MODERATE",
            "goalWeight": 170, "weightUnit": "LB", "goalDate": str(today + dt.timedelta(weeks=12)),
            "adaptive": True, "today": str(today),
        })

    entries = 0
    skipped_days = {9, 20}  # nobody logs every single day
    for back in range(28, -1, -1):
        day = today - dt.timedelta(days=back)
        # Weekends run high; some weekdays come in under. Real adherence is never perfect.
        weekend = day.weekday() >= 4
        day_scale = rng.uniform(1.15, 1.4) if weekend else rng.uniform(0.85, 1.08)
        low_protein = rng.random() < 0.25
        for index, (meal, name, kcal, protein, carbs, fat) in enumerate(MEALS):
            entry_id = uuid.uuid5(ids, f'food-{back}-{index}')
            if back in skipped_days or (back == 0 and meal == "DINNER"):  # today's dinner hasn't happened yet
                try:
                    request(args.api, "DELETE", f"/api/v1/diary/entries/{entry_id}", token)
                except urllib.error.HTTPError:
                    pass
                continue
            scale = day_scale * rng.uniform(0.9, 1.1)
            protein_scale = scale * (0.7 if low_protein else 1)
            request(args.api, "PUT", f"/api/v1/diary/entries/{entry_id}", token, {
                "date": str(day), "meal": meal, "kind": "QUICK", "amount": 1, "amountUnit": "SERVING",
                "quick": {"name": name, "kcal": round(kcal * scale), "proteinG": round(protein * protein_scale),
                          "carbsG": round(carbs * scale), "fatG": round(fat * scale)},
            })
            entries += 1
        request(args.api, "PUT", f"/api/v1/diary/{day}/water", token, {"ml": rng.choice([1500, 2000, 2250, 2500, 3000])})
    print(f"Seeded {weigh_ins} weigh-ins and {entries} food entries over 4 weeks.")


if __name__ == "__main__":
    main()
