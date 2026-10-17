-- =============================================================================
-- V6: body-weight tracking. One weigh-in per user per calendar day; logging
-- again the same day replaces it. Private to the user (never shared with friends).
-- =============================================================================

CREATE TABLE body_weight_entry (
    user_id     uuid         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    -- The user's local calendar date of the weigh-in (not an instant).
    measured_on date         NOT NULL,
    weight      numeric(6,2) NOT NULL CHECK (weight > 0 AND weight < 1500),
    weight_unit text         NOT NULL CHECK (weight_unit IN ('LB', 'KG')),
    weight_kg   numeric(7,3) GENERATED ALWAYS AS (
                    CASE WHEN weight_unit = 'LB' THEN weight * 0.45359237 ELSE weight END
                ) STORED,
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, measured_on)
);
