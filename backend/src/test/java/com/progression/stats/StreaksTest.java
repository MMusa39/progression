package com.progression.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Pure date logic behind the weekly streak. */
class StreaksTest {

	// Thursday 2026-10-15
	private static final LocalDate TODAY = LocalDate.of(2026, 10, 15);
	private static final LocalDate THIS_MONDAY = LocalDate.of(2026, 10, 12);

	@Nested
	class Streak {

		@Test
		void countsConsecutiveWeeksIncludingThisOne() {
			List<LocalDate> weeks = List.of(THIS_MONDAY, THIS_MONDAY.minusWeeks(1), THIS_MONDAY.minusWeeks(2));
			assertThat(Streaks.currentStreakWeeks(weeks, TODAY)).isEqualTo(3);
		}

		@Test
		void anUnfinishedWeekWithoutAWorkoutDoesNotBreakTheStreak() {
			List<LocalDate> weeks = List.of(THIS_MONDAY.minusWeeks(1), THIS_MONDAY.minusWeeks(2));
			assertThat(Streaks.currentStreakWeeks(weeks, TODAY)).isEqualTo(2);
		}

		@Test
		void aMissedWeekEndsTheStreak() {
			List<LocalDate> weeks = List.of(THIS_MONDAY, THIS_MONDAY.minusWeeks(2), THIS_MONDAY.minusWeeks(3));
			assertThat(Streaks.currentStreakWeeks(weeks, TODAY)).isEqualTo(1);
		}

		@Test
		void noRecentTrainingMeansNoStreak() {
			assertThat(Streaks.currentStreakWeeks(List.of(THIS_MONDAY.minusWeeks(5)), TODAY)).isZero();
			assertThat(Streaks.currentStreakWeeks(List.of(), TODAY)).isZero();
		}
	}
}
