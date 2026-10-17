package com.progression.workout;

/** The kind of set. Only working-type sets count toward volume and personal records. */
public enum SetType {
	/** Lighter preparatory set. Excluded from PRs and volume. */
	WARMUP,
	/** A regular set at working weight. */
	WORKING,
	/** Reduced-weight set performed immediately after another. */
	DROP,
	/** A set taken to muscular failure. */
	FAILURE;

	public boolean countsTowardStats() {
		return this != WARMUP;
	}
}
