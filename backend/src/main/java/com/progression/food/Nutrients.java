package com.progression.food;

/**
 * Energy and macronutrients for some amount of food. Foods store these per
 * 100 g; diary entries store them for the amount eaten.
 */
public record Nutrients(double kcal, double proteinG, double carbsG, double fatG, double fiberG) {

	public static final Nutrients ZERO = new Nutrients(0, 0, 0, 0, 0);

	public Nutrients scaled(double factor) {
		return new Nutrients(kcal * factor, proteinG * factor, carbsG * factor, fatG * factor, fiberG * factor);
	}

	public Nutrients plus(Nutrients other) {
		return new Nutrients(kcal + other.kcal, proteinG + other.proteinG, carbsG + other.carbsG, fatG + other.fatG,
				fiberG + other.fiberG);
	}

	/** One decimal place, the precision food labels use. */
	public Nutrients rounded() {
		return new Nutrients(r(kcal), r(proteinG), r(carbsG), r(fatG), r(fiberG));
	}

	private static double r(double v) {
		return Math.round(v * 10) / 10.0;
	}
}
