package com.progression.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Unit a weight was entered in. Users choose a preferred unit, and every set records its own. */
public enum WeightUnit {
	LB,
	KG;

	/** Exact international definition of the pound. */
	public static final BigDecimal KG_PER_LB = new BigDecimal("0.45359237");

	/**
	 * Converts a weight in this unit to kilograms. Mirrors the {@code weight_kg}
	 * generated column in the database, for calculations done in Java.
	 */
	public BigDecimal toKg(BigDecimal weight) {
		return switch (this) {
			case KG -> weight;
			case LB -> weight.multiply(KG_PER_LB).setScale(3, RoundingMode.HALF_UP);
		};
	}
}
