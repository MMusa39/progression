package com.progression.workout;

/** The kind of set. Warm-ups are excluded from set counts, charts and personal records. */
public enum SetType {
	/** Lighter preparatory set. Excluded from statistics. */
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
