package com.progression.stats;

/** Size of the time buckets in a summary chart. */
public enum Bucket {
	WEEK,
	MONTH,
	/** Let the server choose: weekly for spans up to ~6 months, monthly beyond. */
	AUTO;

	/** The PostgreSQL {@code date_trunc} unit for this bucket. */
	String sqlUnit() {
		return switch (this) {
			case WEEK -> "week";
			case MONTH -> "month";
			case AUTO -> throw new IllegalStateException("AUTO must be resolved first");
		};
	}
}
