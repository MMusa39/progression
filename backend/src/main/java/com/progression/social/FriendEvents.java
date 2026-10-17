package com.progression.social;

import java.util.UUID;

/**
 * Domain events published when friendships change. Other modules (e.g.
 * notifications) listen for these, so the social module doesn't depend on them.
 */
public final class FriendEvents {

	private FriendEvents() {
	}

	/** {@code requesterId} asked {@code addresseeId} to be friends. */
	public record RequestSent(UUID requesterId, UUID addresseeId) {
	}

	/** {@code accepterId} accepted {@code requesterId}'s request (or used their invite). */
	public record RequestAccepted(UUID accepterId, UUID requesterId) {
	}
}
