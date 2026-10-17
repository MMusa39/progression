package com.progression.social;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A friend request or an accepted friendship between two users. There is at
 * most one row per pair, enforced by a unique index on the unordered pair
 * (see V4 migration).
 */
@Entity
@Table(name = "friendship")
public class Friendship {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID requesterId;

	@Column(nullable = false, updatable = false)
	private UUID addresseeId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private FriendshipStatus status;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	private Instant acceptedAt;

	protected Friendship() {
	}

	static Friendship request(UUID requesterId, UUID addresseeId, Instant now) {
		Friendship friendship = new Friendship();
		friendship.requesterId = requesterId;
		friendship.addresseeId = addresseeId;
		friendship.status = FriendshipStatus.PENDING;
		friendship.createdAt = now;
		return friendship;
	}

	void accept(Instant now) {
		if (status != FriendshipStatus.ACCEPTED) {
			status = FriendshipStatus.ACCEPTED;
			acceptedAt = now;
		}
	}

	/** The user on the other side of this friendship from {@code userId}. */
	UUID otherThan(UUID userId) {
		return requesterId.equals(userId) ? addresseeId : requesterId;
	}

	boolean isAccepted() {
		return status == FriendshipStatus.ACCEPTED;
	}

	public UUID getId() {
		return id;
	}

	public UUID getRequesterId() {
		return requesterId;
	}

	public UUID getAddresseeId() {
		return addresseeId;
	}

	public FriendshipStatus getStatus() {
		return status;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getAcceptedAt() {
		return acceptedAt;
	}
}
