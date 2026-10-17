-- =============================================================================
-- V7: nutrition: goal profile, foods (Open Food Facts cache + custom foods),
-- recipes, the food diary, and water. All private to the user.
-- =============================================================================

-- Inputs for calorie and macro targets (Mifflin-St Jeor + activity factor).
CREATE TABLE nutrition_profile (
    user_id        uuid         PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    sex            text         NOT NULL CHECK (sex IN ('MALE', 'FEMALE', 'UNSPECIFIED')),
    birth_year     int          NOT NULL CHECK (birth_year BETWEEN 1900 AND 2100),
    height_cm      numeric(5,1) NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
    activity_level text         NOT NULL CHECK (activity_level IN ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE')),
    goal_weight_kg numeric(6,2) NOT NULL CHECK (goal_weight_kg BETWEEN 30 AND 300),
    goal_date      date         NOT NULL,
    -- Adjust the calorie target from logged intake vs. the actual weight trend.
    adaptive       boolean      NOT NULL DEFAULT true,
    updated_at     timestamptz  NOT NULL DEFAULT now()
);

-- A food's nutrition per 100 g (or ml). Two kinds:
--   OPEN_FOOD_FACTS: cached from the public database, shared by everyone (owner_id NULL)
--   CUSTOM:          created by one user, visible only to them
CREATE TABLE food (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid         REFERENCES app_user (id) ON DELETE CASCADE,
    source        text         NOT NULL CHECK (source IN ('OPEN_FOOD_FACTS', 'CUSTOM')),
    barcode       text,
    name          text         NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
    brand         text,
    serving_g     numeric(7,2) CHECK (serving_g > 0),
    serving_label text,
    kcal_100g     numeric(7,2) NOT NULL CHECK (kcal_100g >= 0),
    protein_100g  numeric(6,2) NOT NULL DEFAULT 0 CHECK (protein_100g >= 0),
    carbs_100g    numeric(6,2) NOT NULL DEFAULT 0 CHECK (carbs_100g >= 0),
    fat_100g      numeric(6,2) NOT NULL DEFAULT 0 CHECK (fat_100g >= 0),
    fiber_100g    numeric(6,2) NOT NULL DEFAULT 0 CHECK (fiber_100g >= 0),
    created_at    timestamptz  NOT NULL DEFAULT now(),
    CHECK ((source = 'CUSTOM') = (owner_id IS NOT NULL))
);
CREATE UNIQUE INDEX food_off_barcode_uq ON food (barcode) WHERE source = 'OPEN_FOOD_FACTS';
CREATE INDEX food_owner_idx ON food (owner_id) WHERE owner_id IS NOT NULL;

-- A reusable recipe: ingredients (food + grams) divided into servings.
CREATE TABLE recipe (
    id         uuid         PRIMARY KEY,              -- client-generated
    owner_id   uuid         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name       text         NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    servings   numeric(5,2) NOT NULL CHECK (servings > 0),
    updated_at timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX recipe_owner_idx ON recipe (owner_id);

CREATE TABLE recipe_ingredient (
    recipe_id uuid         NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
    position  int          NOT NULL CHECK (position >= 0),
    food_id   uuid         NOT NULL REFERENCES food (id),
    grams     numeric(7,2) NOT NULL CHECK (grams > 0),
    PRIMARY KEY (recipe_id, position)
);

-- One line in the food diary. Nutrition is snapshotted when logged, so later
-- changes to a food or recipe never rewrite past days.
CREATE TABLE food_log_entry (
    id          uuid         PRIMARY KEY,             -- client-generated (idempotent PUT)
    user_id     uuid         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    logged_on   date         NOT NULL,                -- the user's local calendar date
    meal        text         NOT NULL CHECK (meal IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
    kind        text         NOT NULL CHECK (kind IN ('FOOD', 'RECIPE', 'QUICK')),
    food_id     uuid         REFERENCES food (id) ON DELETE SET NULL,
    recipe_id   uuid         REFERENCES recipe (id) ON DELETE SET NULL,
    name        text         NOT NULL,
    amount      numeric(7,2) NOT NULL CHECK (amount > 0),
    amount_unit text         NOT NULL CHECK (amount_unit IN ('G', 'SERVING')),
    kcal        numeric(7,1) NOT NULL CHECK (kcal >= 0),
    protein_g   numeric(6,1) NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
    carbs_g     numeric(6,1) NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
    fat_g       numeric(6,1) NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
    fiber_g     numeric(6,1) NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
    created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX food_log_user_day_idx ON food_log_entry (user_id, logged_on);

CREATE TABLE water_intake (
    user_id   uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    logged_on date NOT NULL,
    ml        int  NOT NULL CHECK (ml BETWEEN 0 AND 20000),
    PRIMARY KEY (user_id, logged_on)
);
