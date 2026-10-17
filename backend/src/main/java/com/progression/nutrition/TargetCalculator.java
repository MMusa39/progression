package com.progression.nutrition;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Daily calorie and macro targets from body stats and a weight goal. Pure
 * functions with no I/O, so every rule is unit-tested.
 *
 * <ol>
 *   <li><b>Energy expenditure:</b> Mifflin-St Jeor BMR × activity factor = TDEE
 *       (or an observed TDEE when adaptive data is available).</li>
 *   <li><b>Goal:</b> the daily surplus/deficit that reaches the goal weight by the
 *       goal date, using ~7,700 kcal per kg of body weight.</li>
 *   <li><b>Safety:</b> loss is capped at 1% of body weight per week, gain at 0.5%,
 *       and calories never go below a floor (1,200 F / 1,500 M / 1,350 unspecified),
 *       the common clinical guidance for unsupervised dieting. When a cap
 *       applies, the result says so and projects a realistic goal date.</li>
 *   <li><b>Macros:</b> protein 1.8 g/kg of reference weight (the goal weight when
 *       losing, current weight otherwise), fat 27% of calories (at least 0.6 g/kg),
 *       carbs fill the rest. Fiber 14 g per 1,000 kcal; water 35 ml/kg.</li>
 * </ol>
 *
 * <p>Custom macros ({@link #withCustomMacros}) replace step 4, and calories follow
 * from them; the pace and projected date are then recomputed from those calories.
 */
public final class TargetCalculator {

	static final double KCAL_PER_KG = 7700;
	static final double MAX_WEEKLY_LOSS_FRACTION = 0.01;
	static final double MAX_WEEKLY_GAIN_FRACTION = 0.005;
	static final double MAINTAIN_BAND_KG = 0.5;

	private TargetCalculator() {
	}

	public enum Goal {
		LOSE, MAINTAIN, GAIN
	}

	public record Inputs(Sex sex, int age, double heightCm, ActivityLevel activity, double currentKg, double goalKg,
			LocalDate goalDate, LocalDate today, Double observedTdee, double observedWeight) {
	}

	/**
	 * @param tdeeSource      FORMULA, or ADAPTIVE when observed intake vs. weight trend informed it
	 * @param dailyDeltaKcal  planned surplus (+) or deficit (−) vs. TDEE
	 * @param weeklyRateKg    resulting expected weight change per week
	 * @param rateCapped      the requested timeline was faster than the safe limit
	 * @param atCalorieFloor  the calorie floor stopped the target going lower
	 * @param projectedGoalDate when the goal weight is reached at this rate ({@code null} when maintaining)
	 * @param mode            CALCULATED, or CUSTOM when the user set their own macros
	 */
	public record Targets(int calories, int proteinG, int carbsG, int fatG, int fiberG, int waterMl, int bmr,
			int formulaTdee, int tdee, String tdeeSource, int dailyDeltaKcal, double weeklyRateKg, Goal goal,
			boolean rateCapped, boolean atCalorieFloor, LocalDate projectedGoalDate, String mode) {
	}

	/** Macro targets the user chose themselves. */
	public record CustomMacros(int proteinG, int carbsG, int fatG) {

		public int calories() {
			return proteinG * 4 + carbsG * 4 + fatG * 9;
		}
	}

	/**
	 * Replaces the calculated macros with the user's own. Calories are 4/4/9 kcal per
	 * gram, and the expected weekly change and goal date follow from those calories
	 * versus maintenance. No caps apply: the user chose these numbers, so the app
	 * reports the consequence instead of overriding it.
	 */
	public static Targets withCustomMacros(Targets calculated, CustomMacros custom, Inputs in) {
		int calories = custom.calories();
		double delta = calories - calculated.tdee();
		double weeklyRate = delta * 7 / KCAL_PER_KG;
		double diffKg = in.goalKg() - in.currentKg();
		LocalDate projected = null;
		if (calculated.goal() != Goal.MAINTAIN && Math.abs(weeklyRate) > 0.01 && Math.signum(weeklyRate) == Math.signum(diffKg)) {
			projected = in.today().plusDays((long) Math.ceil(Math.abs(diffKg) / Math.abs(weeklyRate) * 7));
		}
		return new Targets(calories, custom.proteinG(), custom.carbsG(), custom.fatG(),
				(int) Math.round(14 * calories / 1000.0), calculated.waterMl(), calculated.bmr(), calculated.formulaTdee(),
				calculated.tdee(), calculated.tdeeSource(), (int) Math.round(delta), Math.round(weeklyRate * 100) / 100.0,
				calculated.goal(), false, false, projected, "CUSTOM");
	}

	public static double bmr(Sex sex, double kg, double cm, int age) {
		double offset = switch (sex) {
			case MALE -> 5;
			case FEMALE -> -161;
			case UNSPECIFIED -> -78;
		};
		return 10 * kg + 6.25 * cm - 5 * age + offset;
	}

	static int calorieFloor(Sex sex) {
		return switch (sex) {
			case MALE -> 1500;
			case FEMALE -> 1200;
			case UNSPECIFIED -> 1350;
		};
	}

	public static Targets compute(Inputs in) {
		double bmr = bmr(in.sex(), in.currentKg(), in.heightCm(), in.age());
		double formulaTdee = bmr * in.activity().factor;
		double tdee = formulaTdee;
		String source = "FORMULA";
		if (in.observedTdee() != null && in.observedWeight() > 0) {
			// Keep observed values plausible: incomplete logging shouldn't produce absurd targets.
			double observed = Math.clamp(in.observedTdee(), formulaTdee * 0.7, formulaTdee * 1.3);
			tdee = in.observedWeight() * observed + (1 - in.observedWeight()) * formulaTdee;
			source = "ADAPTIVE";
		}

		double diffKg = in.goalKg() - in.currentKg();
		Goal goal = Math.abs(diffKg) < MAINTAIN_BAND_KG ? Goal.MAINTAIN : diffKg < 0 ? Goal.LOSE : Goal.GAIN;

		double delta = 0;
		boolean capped = false;
		if (goal != Goal.MAINTAIN) {
			long days = Math.max(7, ChronoUnit.DAYS.between(in.today(), in.goalDate()));
			double desired = diffKg * KCAL_PER_KG / days;
			double maxDeficit = MAX_WEEKLY_LOSS_FRACTION * in.currentKg() * KCAL_PER_KG / 7;
			double maxSurplus = MAX_WEEKLY_GAIN_FRACTION * in.currentKg() * KCAL_PER_KG / 7;
			delta = Math.clamp(desired, -maxDeficit, maxSurplus);
			capped = Math.abs(delta - desired) > 1 || !in.goalDate().isAfter(in.today());
		}

		double calories = tdee + delta;
		boolean atFloor = false;
		int floor = calorieFloor(in.sex());
		if (calories < floor) {
			calories = floor;
			delta = calories - tdee;
			atFloor = true;
			capped = true;
		}

		double weeklyRate = delta * 7 / KCAL_PER_KG;
		LocalDate projected = null;
		if (goal != Goal.MAINTAIN && Math.abs(weeklyRate) > 0.01 && Math.signum(weeklyRate) == Math.signum(diffKg)) {
			projected = in.today().plusDays((long) Math.ceil(Math.abs(diffKg) / Math.abs(weeklyRate) * 7));
		}

		double referenceKg = goal == Goal.LOSE ? in.goalKg() : in.currentKg();
		int protein = roundTo(1.8 * referenceKg, 5);
		int fat = (int) Math.round(Math.max(0.27 * calories / 9, 0.6 * referenceKg));
		int carbs = (int) Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

		return new Targets(
				roundTo(calories, 10), protein, carbs, fat,
				(int) Math.round(14 * calories / 1000),
				roundTo(35 * in.currentKg(), 250),
				(int) Math.round(bmr), (int) Math.round(formulaTdee), (int) Math.round(tdee), source,
				(int) Math.round(delta), Math.round(weeklyRate * 100) / 100.0, goal, capped, atFloor, projected, "CALCULATED");
	}

	private static int roundTo(double value, int step) {
		return (int) (Math.round(value / step) * step);
	}
}
