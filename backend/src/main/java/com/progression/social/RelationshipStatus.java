package com.progression.social;

/** How the current user relates to another user, from the current user's point of view. */
public enum RelationshipStatus {
	NONE,
	/** The current user sent a request that hasn't been answered. */
	REQUEST_SENT,
	/** The other user sent the current user a request. */
	REQUEST_RECEIVED,
	FRIENDS
}
