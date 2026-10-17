-- =============================================================================
-- V9: optional custom macro targets (e.g. from a coach). When set, they replace
-- the calculated protein / carbs / fat, and calories follow from them
-- (4 kcal/g protein and carbs, 9 kcal/g fat). All three or none.
-- =============================================================================

ALTER TABLE nutrition_profile
    ADD COLUMN custom_protein_g int CHECK (custom_protein_g BETWEEN 0 AND 600),
    ADD COLUMN custom_carbs_g   int CHECK (custom_carbs_g BETWEEN 0 AND 1500),
    ADD COLUMN custom_fat_g     int CHECK (custom_fat_g BETWEEN 0 AND 600),
    ADD CONSTRAINT nutrition_profile_custom_all_or_none CHECK (
        (custom_protein_g IS NULL) = (custom_carbs_g IS NULL)
        AND (custom_carbs_g IS NULL) = (custom_fat_g IS NULL));
