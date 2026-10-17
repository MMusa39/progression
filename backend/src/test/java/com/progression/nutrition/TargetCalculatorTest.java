package com.progression.nutrition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class TargetCalculatorTest {

	private static final LocalDate TODAY = LocalDate.of(2026, 10, 17);

	private static TargetCalculator.Inputs inputs(Sex sex, double current, double goal, int weeks, Double observed, double weight) {
		return new TargetCalculator.Inputs(sex, 30, 180, ActivityLevel.MODERATE, current, goal, TODAY.plusWeeks(weeks), TODAY,
				observed, weight);
	}

	@Test
	void mifflinStJeor() {
		// 10×80 + 6.25×180 − 5×30 + 5 = 1,780
		assertThat(TargetCalculator.bmr(Sex.MALE, 80, 180, 30)).isEqualTo(1780);
		assertThat(TargetCalculator.bmr(Sex.FEMALE, 80, 180, 30)).isEqualTo(1614);
	}

	@Test
	void moderateLossWithinTheSafeRate() {
		// 80 → 76 kg in 16 weeks = 0.25 kg/week: well under the 0.8 kg/week cap.
		var t = TargetCalculator.compute(inputs(Sex.MALE, 80, 76, 16, null, 0));

		assertThat(t.goal()).isEqualTo(TargetCalculator.Goal.LOSE);
		assertThat(t.tdee()).isEqualTo(2759);                     // 1,780 × 1.55
		assertThat(t.dailyDeltaKcal()).isBetween(-280, -270);      // 4 × 7,700 / 112 days
		assertThat(t.calories()).isEqualTo(2480);
		assertThat(t.rateCapped()).isFalse();
		assertThat(t.weeklyRateKg()).isCloseTo(-0.25, within(0.01));
		assertThat(t.projectedGoalDate()).isEqualTo(TODAY.plusWeeks(16));
	}

	@Test
	void anAggressiveTimelineIsCappedAndGivesARealisticDate() {
		// 80 → 70 kg in 4 weeks would be 2.5 kg/week; the cap is 1% = 0.8 kg/week.
		var t = TargetCalculator.compute(inputs(Sex.MALE, 80, 70, 4, null, 0));

		assertThat(t.rateCapped()).isTrue();
		assertThat(t.weeklyRateKg()).isCloseTo(-0.8, within(0.01));
		assertThat(t.projectedGoalDate()).isAfter(TODAY.plusWeeks(12));
	}

	@Test
	void caloriesNeverGoBelowTheFloor() {
		var t = new TargetCalculator.Inputs(Sex.FEMALE, 40, 155, ActivityLevel.SEDENTARY, 55, 45, TODAY.plusWeeks(4), TODAY, null, 0);
		var targets = TargetCalculator.compute(t);

		assertThat(targets.calories()).isEqualTo(1200);
		assertThat(targets.atCalorieFloor()).isTrue();
	}

	@Test
	void maintainingWithinHalfAKilo() {
		var t = TargetCalculator.compute(inputs(Sex.MALE, 80, 80.3, 10, null, 0));
		assertThat(t.goal()).isEqualTo(TargetCalculator.Goal.MAINTAIN);
		assertThat(t.calories()).isEqualTo(2760);
		assertThat(t.projectedGoalDate()).isNull();
	}

	@Test
	void gainIsCappedAtHalfAPercentPerWeek() {
		var t = TargetCalculator.compute(inputs(Sex.MALE, 70, 80, 4, null, 0));
		assertThat(t.goal()).isEqualTo(TargetCalculator.Goal.GAIN);
		assertThat(t.weeklyRateKg()).isCloseTo(0.35, within(0.01));
		assertThat(t.rateCapped()).isTrue();
	}

	@Test
	void adaptiveBlendsObservedExpenditureAndClampsOutliers() {
		var full = TargetCalculator.compute(inputs(Sex.MALE, 80, 80, 10, 3000.0, 1.0));
		assertThat(full.tdeeSource()).isEqualTo("ADAPTIVE");
		assertThat(full.tdee()).isEqualTo(3000);

		var half = TargetCalculator.compute(inputs(Sex.MALE, 80, 80, 10, 3000.0, 0.5));
		assertThat(half.tdee()).isBetween(2878, 2881); // halfway between 2,759 and 3,000

		var absurd = TargetCalculator.compute(inputs(Sex.MALE, 80, 80, 10, 900.0, 1.0));
		assertThat(absurd.tdee()).isEqualTo((int) Math.round(2759.0 * 0.7)); // clamped to 70% of formula
	}

	@Test
	void macrosAddUpAndProteinFollowsGoalWeightWhenLosing() {
		var t = TargetCalculator.compute(inputs(Sex.MALE, 100, 85, 30, null, 0));

		assertThat(t.proteinG()).isEqualTo(155); // 1.8 × 85 kg, rounded to 5
		int kcalFromMacros = t.proteinG() * 4 + t.carbsG() * 4 + t.fatG() * 9;
		assertThat(kcalFromMacros).isCloseTo(t.calories(), within(15));
		assertThat(t.fiberG()).isGreaterThan(25);
		assertThat(t.waterMl()).isEqualTo(3500); // 35 ml × 100 kg
	}

	@Test
	void customMacrosSetCaloriesAndTheResultingPace() {
		var in = inputs(Sex.MALE, 80, 76, 16, null, 0);
		var calculated = TargetCalculator.compute(in);
		var t = TargetCalculator.withCustomMacros(calculated, new TargetCalculator.CustomMacros(180, 200, 60), in);

		assertThat(t.mode()).isEqualTo("CUSTOM");
		assertThat(t.calories()).isEqualTo(180 * 4 + 200 * 4 + 60 * 9); // 2,060
		assertThat(t.proteinG()).isEqualTo(180);
		assertThat(t.tdee()).isEqualTo(calculated.tdee());
		assertThat(t.dailyDeltaKcal()).isEqualTo(2060 - calculated.tdee());
		assertThat(t.weeklyRateKg()).isNegative();
		assertThat(t.projectedGoalDate()).isAfter(TODAY);
		assertThat(t.rateCapped()).isFalse();
	}

	@Test
	void customMacrosThatMoveAwayFromTheGoalHaveNoProjectedDate() {
		var in = inputs(Sex.MALE, 80, 76, 16, null, 0);
		var t = TargetCalculator.withCustomMacros(TargetCalculator.compute(in), new TargetCalculator.CustomMacros(200, 450, 100), in);
		assertThat(t.weeklyRateKg()).isPositive(); // 3,500 kcal is a surplus while trying to lose
		assertThat(t.projectedGoalDate()).isNull();
	}
}
