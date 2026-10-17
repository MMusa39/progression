-- =============================================================================
-- V4: friends. Users pick a unique @username, connect through mutual friend
-- requests or an invite link, and choose whether friends can see their
-- workouts (personal records are always shared with friends).
-- =============================================================================

ALTER TABLE app_user
    -- Lowercase handle used to find and identify people. NULL until the user picks one.
    ADD COLUMN username       text,
    -- When false, friends see PRs and consistency but not individual workouts.
    ADD COLUMN share_workouts boolean NOT NULL DEFAULT true,
    -- Secret for the user's invite link; regenerating it revokes old links.
    ADD COLUMN invite_code    text;

ALTER TABLE app_user
    ADD CONSTRAINT app_user_username_format CHECK (username ~ '^[a-z0-9_.]{3,20}$');
CREATE UNIQUE INDEX app_user_username_uq    ON app_user (username);
CREATE UNIQUE INDEX app_user_invite_code_uq ON app_user (invite_code);

-- One row per pair of users: a pending request or an accepted friendship.
CREATE TABLE friendship (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    addressee_id uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    status       text        NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    accepted_at  timestamptz,
    CHECK (requester_id <> addressee_id)
);

-- At most one row per pair, whichever direction the request went
-- (A→B and B→A are the same friendship).
CREATE UNIQUE INDEX friendship_pair_uq
    ON friendship (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX friendship_requester_idx ON friendship (requester_id, status);
CREATE INDEX friendship_addressee_idx ON friendship (addressee_id, status);
