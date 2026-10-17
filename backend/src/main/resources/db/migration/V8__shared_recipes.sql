-- =============================================================================
-- V8: recipes can be shared with friends (opt-in, per recipe). A friend saves
-- a copy into their own recipes; copied_from stops them saving it twice.
-- =============================================================================

ALTER TABLE recipe ADD COLUMN shared boolean NOT NULL DEFAULT false;
ALTER TABLE recipe ADD COLUMN copied_from uuid REFERENCES recipe (id) ON DELETE SET NULL;

CREATE INDEX recipe_shared_idx ON recipe (owner_id) WHERE shared;
CREATE UNIQUE INDEX recipe_copy_uq ON recipe (owner_id, copied_from) WHERE copied_from IS NOT NULL;
