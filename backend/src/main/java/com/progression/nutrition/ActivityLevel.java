package com.progression.nutrition;

/** Multiplier from resting energy (BMR) to total daily energy (TDEE). */
public enum ActivityLevel {
	/** Desk job, little exercise. */
	SEDENTARY(1.2),
	/** Light exercise 1–3 days a week. */
	LIGHT(1.375),
	/** Exercise 3–5 days a week. */
	MODERATE(1.55),
	/** Hard exercise 6–7 days a week. */
	ACTIVE(1.725),
	/** Physical job plus training. */
	VERY_ACTIVE(1.9);

	final double factor;

	ActivityLevel(double factor) {
		this.factor = factor;
	}
}
