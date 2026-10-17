package com.progression.body;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

class WeightTrendTest {

	private static final LocalDate D0 = LocalDate.of(2026, 9, 1);

	@Test
	void firstReadingSeedsTheTrendAndEachReadingPullsItTenPercent() {
		var points = WeightTrend.compute(List.of(
				new WeightTrend.Reading(D0, 80.0),
				new WeightTrend.Reading(D0.plusDays(1), 81.0)));

		assertThat(points.get(0).trendKg()).isEqualTo(80.0);
		assertThat(points.get(1).trendKg()).isCloseTo(80.1, within(1e-9));
	}

	@Test
	void gapsCompoundTheSmoothing() {
		var points = WeightTrend.compute(List.of(
				new WeightTrend.Reading(D0, 80.0),
				new WeightTrend.Reading(D0.plusDays(3), 81.0))); // 3 days later: pull = 1 - 0.9³ = 27.1%

		assertThat(points.get(1).trendKg()).isCloseTo(80.271, within(1e-9));
	}

	@Test
	void noiseIsSmoothedWhileRealChangeComesThrough() {
		List<WeightTrend.Reading> readings = new ArrayList<>();
		for (int day = 0; day < 42; day++) {
			double real = 90 - day * (0.5 / 7);                  // losing 0.5 kg/week
			double noise = (day % 2 == 0 ? 1 : -1) * 0.8;        // ±0.8 kg daily swings
			readings.add(new WeightTrend.Reading(D0.plusDays(day), real + noise));
		}
		var points = WeightTrend.compute(readings);

		assertThat(WeightTrend.weeklyChangeKg(points)).isCloseTo(-0.5, within(0.1));
		// The trend's day-to-day movement is far smaller than the raw ±0.8 kg swings.
		double maxStep = 0;
		for (int i = 30; i < points.size(); i++) {
			maxStep = Math.max(maxStep, Math.abs(points.get(i).trendKg() - points.get(i - 1).trendKg()));
		}
		assertThat(maxStep).isLessThan(0.25);
	}

	@Test
	void weeklyChangeNeedsTwoWeeksOfHistory() {
		var points = WeightTrend.compute(List.of(
				new WeightTrend.Reading(D0, 80.0),
				new WeightTrend.Reading(D0.plusDays(10), 79.0)));
		assertThat(WeightTrend.weeklyChangeKg(points)).isNull();
	}

	@Test
	void trendOnReturnsTheLatestValueOnOrBeforeADate() {
		var points = WeightTrend.compute(List.of(
				new WeightTrend.Reading(D0, 80.0),
				new WeightTrend.Reading(D0.plusDays(5), 79.0)));
		assertThat(WeightTrend.trendOn(points, D0.plusDays(3))).isEqualTo(80.0);
		assertThat(WeightTrend.trendOn(points, D0.minusDays(1))).isNull();
	}
}
