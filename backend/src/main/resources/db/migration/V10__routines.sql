-- =============================================================================
-- V10: routines (workout templates): a named, ordered list of exercises with
-- target sets and a rep range, used to start workouts and guide progression.
-- =============================================================================

CREATE TABLE routine (
    id         uuid        PRIMARY KEY,                -- client-generated (idempotent PUT)
    user_id    uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name       text        NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    notes      text        CHECK (length(notes) <= 1000),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routine_user_idx ON routine (user_id);

CREATE TABLE routine_exercise (
    routine_id  uuid NOT NULL REFERENCES routine (id) ON DELETE CASCADE,
    position    int  NOT NULL CHECK (position >= 0),
    exercise_id uuid NOT NULL REFERENCES exercise (id),
    sets        int  NOT NULL CHECK (sets BETWEEN 1 AND 20),
    rep_min     int  NOT NULL CHECK (rep_min BETWEEN 1 AND 100),
    rep_max     int  NOT NULL CHECK (rep_max BETWEEN 1 AND 100),
    PRIMARY KEY (routine_id, position),
    CHECK (rep_max >= rep_min)
);
