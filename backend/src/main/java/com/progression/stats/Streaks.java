package com.progression.stats;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Collection;
import java.util.Set;

/** Weekly training streaks, shared by the Progress tab and the friends leaderboard. */
public final class Streaks {

	private Streaks() {
	}

	/**
	 * Consecutive training weeks ending this week. If nothing has been logged
	 * yet this week, the streak counts up to last week: the week isn't over, so
	 * the streak isn't broken yet.
	 *
	 * @param activeWeeks Mondays of weeks with at least one workout
	 * @param today       today in the relevant time zone
	 */
	public static int currentStreakWeeks(Collection<LocalDate> activeWeeks, LocalDate today) {
		LocalDate thisWeek = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
		Set<LocalDate> active = Set.copyOf(activeWeeks);
		LocalDate cursor = active.contains(thisWeek) ? thisWeek : thisWeek.minusWeeks(1);
		int streak = 0;
		while (active.contains(cursor)) {
			streak++;
			cursor = cursor.minusWeeks(1);
		}
		return streak;
	}
}
