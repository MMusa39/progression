package com.progression.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import com.progression.food.Nutrients;
import org.junit.jupiter.api.Test;

class NutritionTrendsTest {

	private static final LocalDate TODAY = LocalDate.of(2026, 10, 17);
	private static final NutritionTrends.Goals GOALS = new NutritionTrends.Goals(2000, 150, 200, 60, 28);

	private static NutritionTrends.Day day(int daysAgo, double kcal, double protein, double carbs, double fat) {
		return new NutritionTrends.Day(TODAY.minusDays(daysAgo), new Nutrients(kcal, protein, carbs, fat, 0));
	}

	@Test
	void countsEachTargetSeparatelyOverLoggedFinishedDays() {
		var days = List.of(
				day(4, 2150, 160, 210, 62),               // all on target (calories +7.5%)
				day(3, 2300, 130, 260, 60),               // calories +15%, protein 87%, carbs +30%: only fat hits
				new NutritionTrends.Day(TODAY.minusDays(2), null), // nothing logged: a gap, not a miss
				day(1, 1850, 140, 185, 52),               // calories −7.5%, protein 93%, carbs −7.5%, fat −13%
				day(0, 600, 40, 60, 20));                 // today: in progress, not counted

		var summary = NutritionTrends.summarize(days, TODAY, GOALS, 2);

		assertThat(summary.finishedDays()).isEqualTo(4);
		assertThat(summary.loggedDays()).isEqualTo(3);
		assertThat(summary.onTarget()).isEqualTo(new NutritionTrends.OnTarget(2, 2, 2, 3));
		assertThat(summary.average().kcal()).isEqualTo(2100.0);
		assertThat(summary.loggingStreak()).isEqualTo(2);
	}

	@Test
	void withoutGoalsThereIsIntakeButNoAdherence() {
		var summary = NutritionTrends.summarize(List.of(day(1, 2000, 150, 200, 60)), TODAY, null, 1);
		assertThat(summary.onTarget()).isNull();
		assertThat(summary.average().proteinG()).isEqualTo(150.0);
	}

	@Test
	void noLoggedDaysMeansNoAverage() {
		var summary = NutritionTrends.summarize(List.of(new NutritionTrends.Day(TODAY.minusDays(1), null)), TODAY, GOALS, 0);
		assertThat(summary.average()).isNull();
		assertThat(summary.onTarget()).isEqualTo(new NutritionTrends.OnTarget(0, 0, 0, 0));
	}

	@Test
	void streakSurvivesAnUnloggedTodayButNotAMissedDay() {
		assertThat(NutritionTrends.loggingStreak(List.of(TODAY, TODAY.minusDays(1), TODAY.minusDays(2)), TODAY)).isEqualTo(3);
		assertThat(NutritionTrends.loggingStreak(List.of(TODAY.minusDays(1), TODAY.minusDays(2)), TODAY)).isEqualTo(2);
		assertThat(NutritionTrends.loggingStreak(List.of(TODAY.minusDays(2), TODAY.minusDays(3)), TODAY)).isZero();
		assertThat(NutritionTrends.loggingStreak(List.of(), TODAY)).isZero();
	}
}
