package com.progression.body;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Smoothed weight trend: an exponentially weighted moving average of daily
 * weigh-ins.
 *
 * <p>Scale weight swings 1–2 kg day to day with water, salt and food in the
 * gut, which hides real change. Each new weigh-in moves the trend 10% of the way
 * toward the reading (the smoothing used by The Hacker's Diet and Happy Scale),
 * so noise averages out and real change shows within a week or two.
 *
 * <p>Missed days are handled by compounding: a reading after a 3-day gap pulls
 * the trend as far as three consecutive daily readings would
 * ({@code 1 − 0.9³ ≈ 27%}), so sparse logging still converges.
 */
public final class WeightTrend {

	/** Share of the gap between trend and reading closed per day. */
	static final double DAILY_SMOOTHING = 0.1;

	private WeightTrend() {
	}

	public record Reading(LocalDate date, double kg) {
	}

	public record Point(LocalDate date, double kg, double trendKg) {
	}

	/** @param readings weigh-ins sorted by date ascending, at most one per day */
	public static List<Point> compute(List<Reading> readings) {
		List<Point> points = new ArrayList<>(readings.size());
		Double trend = null;
		LocalDate previous = null;
		for (Reading reading : readings) {
			if (trend == null) {
				trend = reading.kg(); // the first reading seeds the trend
			}
			else {
				long gap = Math.max(1, ChronoUnit.DAYS.between(previous, reading.date()));
				double pull = 1 - Math.pow(1 - DAILY_SMOOTHING, gap);
				trend = trend + pull * (reading.kg() - trend);
			}
			previous = reading.date();
			points.add(new Point(reading.date(), reading.kg(), trend));
		}
		return points;
	}

	/**
	 * Trend change per week over (about) the last two weeks, or {@code null}
	 * when there isn't two weeks of history yet.
	 */
	public static Double weeklyChangeKg(List<Point> points) {
		if (points.size() < 2) {
			return null;
		}
		Point latest = points.getLast();
		Point base = null;
		for (Point p : points) {
			if (!p.date().isAfter(latest.date().minusDays(14))) {
				base = p; // latest point at least 14 days before the newest one
			}
		}
		if (base == null) {
			return null;
		}
		long days = ChronoUnit.DAYS.between(base.date(), latest.date());
		return (latest.trendKg() - base.trendKg()) / days * 7;
	}

	/** Trend value as of {@code date}: the trend at the last weigh-in on or before it. */
	public static Double trendOn(List<Point> points, LocalDate date) {
		Double value = null;
		for (Point p : points) {
			if (p.date().isAfter(date)) {
				break;
			}
			value = p.trendKg();
		}
		return value;
	}
}
