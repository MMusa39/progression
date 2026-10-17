package com.progression.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Pure date logic behind the summary: buckets, gap filling and streaks. */
class StatsServiceTest {

	// Thursday 2026-10-15
	private static final LocalDate TODAY = LocalDate.of(2026, 10, 15);
	private static final LocalDate THIS_MONDAY = LocalDate.of(2026, 10, 12);

	@Nested
	class Streak {

		@Test
		void countsConsecutiveWeeksIncludingThisOne() {
			List<LocalDate> weeks = List.of(THIS_MONDAY, THIS_MONDAY.minusWeeks(1), THIS_MONDAY.minusWeeks(2));
			assertThat(StatsService.currentStreakWeeks(weeks, TODAY)).isEqualTo(3);
		}

		@Test
		void anUnfinishedWeekWithoutAWorkoutDoesNotBreakTheStreak() {
			List<LocalDate> weeks = List.of(THIS_MONDAY.minusWeeks(1), THIS_MONDAY.minusWeeks(2));
			assertThat(StatsService.currentStreakWeeks(weeks, TODAY)).isEqualTo(2);
		}

		@Test
		void aMissedWeekEndsTheStreak() {
			List<LocalDate> weeks = List.of(THIS_MONDAY, THIS_MONDAY.minusWeeks(2), THIS_MONDAY.minusWeeks(3));
			assertThat(StatsService.currentStreakWeeks(weeks, TODAY)).isEqualTo(1);
		}

		@Test
		void noRecentTrainingMeansNoStreak() {
			assertThat(StatsService.currentStreakWeeks(List.of(THIS_MONDAY.minusWeeks(5)), TODAY)).isZero();
			assertThat(StatsService.currentStreakWeeks(List.of(), TODAY)).isZero();
		}
	}

	@Nested
	class Buckets {

		private final ZoneId utc = ZoneId.of("UTC");

		@Test
		void autoUsesWeeksForShortRangesAndMonthsForLongOnes() {
			Instant now = Instant.parse("2026-10-15T12:00:00Z");
			assertThat(StatsService.resolveBucket(Bucket.AUTO, now.minusSeconds(86_400 * 90), now)).isEqualTo(Bucket.WEEK);
			assertThat(StatsService.resolveBucket(Bucket.AUTO, now.minusSeconds(86_400 * 365), now)).isEqualTo(Bucket.MONTH);
			assertThat(StatsService.resolveBucket(Bucket.MONTH, now.minusSeconds(86_400 * 7), now)).isEqualTo(Bucket.MONTH);
		}

		@Test
		void weeksStartOnMondayAndMonthsOnTheFirst() {
			assertThat(StatsService.bucketStart(TODAY, Bucket.WEEK)).isEqualTo(THIS_MONDAY);
			assertThat(StatsService.bucketStart(THIS_MONDAY, Bucket.WEEK)).isEqualTo(THIS_MONDAY);
			assertThat(StatsService.bucketStart(TODAY, Bucket.MONTH)).isEqualTo(LocalDate.of(2026, 10, 1));
		}

		@Test
		void fillsEmptyWeeksWithZeros() {
			var logged = List.of(new StatsSummaryResponse.BucketPoint(THIS_MONDAY.minusWeeks(2), 2, 10, 1000));

			var filled = StatsService.fillBuckets(logged, Instant.parse("2026-09-24T10:00:00Z"),
					Instant.parse("2026-10-15T10:00:00Z"), Bucket.WEEK, utc);

			assertThat(filled).extracting(StatsSummaryResponse.BucketPoint::start).containsExactly(
					LocalDate.of(2026, 9, 21), LocalDate.of(2026, 9, 28), LocalDate.of(2026, 10, 5), THIS_MONDAY);
			assertThat(filled).extracting(StatsSummaryResponse.BucketPoint::workouts).containsExactly(0, 2, 0, 0);
		}
	}
}
