package com.progression.nutrition;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.progression.food.Nutrients;

/**
 * How consistently someone hits their targets. Pure functions, unit-tested.
 *
 * <p>A day is <b>on target</b> when:
 * <ul>
 *   <li>calories are within ±10% of the target,</li>
 *   <li>protein reaches at least 90% of the target (it's a minimum; more is fine),</li>
 *   <li>carbs and fat are each within ±15%.</li>
 * </ul>
 * Only finished days count: today is shown but left out of averages and
 * adherence until it's over, so a half-logged morning doesn't read as a miss.
 * Days with nothing logged are gaps, not zeros.
 */
public final class NutritionTrends {

	static final double CALORIE_TOLERANCE = 0.10;
	static final double PROTEIN_MINIMUM = 0.90;
	static final double MACRO_TOLERANCE = 0.15;

	private NutritionTrends() {
	}

	/** The targets intake is compared against. */
	public record Goals(int calories, int proteinG, int carbsG, int fatG, int fiberG) {
	}

	/** The on-target rules, sent to the app so its charts draw the same bands. */
	public record Rules(double calorieTolerance, double proteinMinimum, double macroTolerance) {
		static final Rules DEFAULT = new Rules(CALORIE_TOLERANCE, PROTEIN_MINIMUM, MACRO_TOLERANCE);
	}

	/** One calendar day. {@code intake} is null when nothing was logged. */
	public record Day(LocalDate date, Nutrients intake) {
	}

	/** Number of finished, logged days that met each target. */
	public record OnTarget(int calories, int protein, int carbs, int fat) {
	}

	/**
	 * @param finishedDays  days in the range before today
	 * @param loggedDays    finished days with anything logged (the denominator for averages and adherence)
	 * @param loggingStreak consecutive days logged up to today (today still counts as "in progress")
	 * @param average       mean daily intake over logged days ({@code null} if none)
	 * @param onTarget      {@code null} without goals
	 */
	public record Summary(int finishedDays, int loggedDays, int loggingStreak, Nutrients average, OnTarget onTarget) {
	}

	static Summary summarize(List<Day> days, LocalDate today, Goals goals, int loggingStreak) {
		List<Day> finished = days.stream().filter(d -> d.date().isBefore(today)).toList();
		List<Nutrients> logged = finished.stream().map(Day::intake).filter(n -> n != null).toList();
		Nutrients average = null;
		if (!logged.isEmpty()) {
			Nutrients total = logged.stream().reduce(Nutrients.ZERO, Nutrients::plus);
			average = total.scaled(1.0 / logged.size()).rounded();
		}
		OnTarget onTarget = null;
		if (goals != null) {
			onTarget = new OnTarget(
					(int) logged.stream().filter(n -> within(n.kcal(), goals.calories(), CALORIE_TOLERANCE)).count(),
					(int) logged.stream().filter(n -> n.proteinG() >= goals.proteinG() * PROTEIN_MINIMUM).count(),
					(int) logged.stream().filter(n -> within(n.carbsG(), goals.carbsG(), MACRO_TOLERANCE)).count(),
					(int) logged.stream().filter(n -> within(n.fatG(), goals.fatG(), MACRO_TOLERANCE)).count());
		}
		return new Summary(finished.size(), logged.size(), loggingStreak, average, onTarget);
	}

	/**
	 * Consecutive logged days ending today. If today has nothing yet, the streak
	 * still counts up to yesterday: it only breaks once a whole day is missed.
	 */
	static int loggingStreak(List<LocalDate> loggedDays, LocalDate today) {
		Set<LocalDate> logged = new HashSet<>(loggedDays);
		LocalDate day = logged.contains(today) ? today : today.minusDays(1);
		int streak = 0;
		while (logged.contains(day)) {
			streak++;
			day = day.minusDays(1);
		}
		return streak;
	}

	static boolean within(double value, int target, double tolerance) {
		return target > 0 && Math.abs(value - target) <= target * tolerance;
	}
}
