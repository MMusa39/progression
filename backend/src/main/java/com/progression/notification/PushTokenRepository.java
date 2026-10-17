package com.progression.notification;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class PushTokenRepository {

	private final JdbcClient jdbc;

	PushTokenRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * Saves a device token for a user. If the token was registered to someone
	 * else (another account signed in on this phone before), it moves to this user.
	 */
	void register(UUID userId, String token, String platform) {
		jdbc.sql("""
				INSERT INTO push_token (token, user_id, platform)
				VALUES (:token, :userId, :platform)
				ON CONFLICT (token) DO UPDATE
				    SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now()
				""")
				.param("token", token)
				.param("userId", userId)
				.param("platform", platform)
				.update();
	}

	/** Removes a token, but only if it belongs to {@code userId} (no one can unregister someone else's device). */
	void unregister(UUID userId, String token) {
		jdbc.sql("DELETE FROM push_token WHERE token = :token AND user_id = :userId")
				.param("token", token)
				.param("userId", userId)
				.update();
	}

	record Device(UUID userId, String token) {
	}

	List<Device> devicesOf(Collection<UUID> userIds) {
		if (userIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("SELECT user_id, token FROM push_token WHERE user_id IN (:userIds)")
				.param("userIds", userIds)
				.query((rs, n) -> new Device(rs.getObject("user_id", UUID.class), rs.getString("token")))
				.list();
	}

	void deleteTokens(Collection<String> tokens) {
		if (!tokens.isEmpty()) {
			jdbc.sql("DELETE FROM push_token WHERE token IN (:tokens)").param("tokens", tokens).update();
		}
	}
}
