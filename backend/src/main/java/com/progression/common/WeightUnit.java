package com.progression.common;

/**
 * Unit a weight was entered in. Users choose a preferred unit, and every set
 * records its own. Conversions for analytics happen in the database
 * ({@code exercise_set.weight_kg}), so the stored value is always exactly
 * what the user typed.
 */
public enum WeightUnit {
	LB,
	KG
}
