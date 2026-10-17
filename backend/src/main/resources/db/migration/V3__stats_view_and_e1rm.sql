-- =============================================================================
-- V3: building blocks for progress analytics.
--
-- Every statistic (charts, personal records, weekly volume) is computed from
-- the raw sets on demand. Nothing derived is stored, so editing an old workout
-- automatically corrects every chart and PR (see docs/data-model.md).
-- =============================================================================

-- Estimated one-rep max: the most weight the lifter could likely lift once,
-- extrapolated from a set of several reps. Epley formula: w × (1 + reps / 30).
-- A single rep is already a 1RM, so it's returned as-is (Epley would inflate it by 3%).
-- Defined once here so every query, and therefore every chart and PR, agrees.
CREATE FUNCTION estimated_one_rep_max(weight_kg numeric, reps int)
    RETURNS numeric
    LANGUAGE sql
    IMMUTABLE
    PARALLEL SAFE
RETURN CASE
           WHEN reps IS NULL OR reps <= 0 THEN NULL
           WHEN reps = 1 THEN weight_kg
           ELSE weight_kg * (1 + reps / 30.0)
       END;

-- The sets that count toward statistics: completed, non-warm-up, at least one rep.
-- Flattened with their workout and exercise, so analytics queries read like
-- "SELECT ... FROM working_set WHERE user_id = ?". PostgreSQL inlines simple views
-- into the calling query, so the existing indexes are still used.
CREATE VIEW working_set AS
SELECT w.user_id,
       w.id                                       AS workout_id,
       w.started_at,
       we.id                                      AS workout_exercise_id,
       we.exercise_id,
       s.id                                       AS set_id,
       s.set_type,
       s.weight,
       s.weight_unit,
       s.weight_kg,
       s.reps,
       s.weight_kg * s.reps                       AS volume_kg,
       estimated_one_rep_max(s.weight_kg, s.reps) AS e1rm_kg
FROM workout w
         JOIN workout_exercise we ON we.workout_id = w.id
         JOIN exercise_set s ON s.workout_exercise_id = we.id
WHERE s.set_type <> 'WARMUP'
  AND s.completed_at IS NOT NULL
  AND s.reps > 0;
