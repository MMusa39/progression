-- =============================================================================
-- V5: push notifications. Devices register Expo push tokens; users choose
-- which kinds of notification they want.
-- =============================================================================

-- One row per device. The token is the key because a device belongs to whoever
-- signed in on it last: registering an existing token moves it to the new user.
CREATE TABLE push_token (
    token        text        PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    platform     text        NOT NULL CHECK (platform IN ('IOS', 'ANDROID')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_token_user_idx ON push_token (user_id);

ALTER TABLE app_user
    ADD COLUMN notify_friend_requests boolean NOT NULL DEFAULT true,
    ADD COLUMN notify_friend_prs      boolean NOT NULL DEFAULT true;
