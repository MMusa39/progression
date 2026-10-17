package com.progression.stats;

/** Kinds of personal record tracked per exercise. */
public enum RecordType {
	/** Highest estimated one-rep max (strength, independent of rep count). */
	ESTIMATED_1RM,
	/** Heaviest weight lifted for at least one rep. */
	HEAVIEST_WEIGHT,
	/** Most total weight moved (Σ weight × reps) in one session. */
	SESSION_VOLUME
}
