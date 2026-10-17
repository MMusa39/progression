package com.progression.body;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.progression.common.WeightUnit;
import com.progression.common.error.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Weigh-ins and the smoothed trend. Body weight is private: no friend-facing API reads it. */
@Service
public class BodyWeightService {

	private final BodyWeightRepository weights;

	BodyWeightService(BodyWeightRepository weights) {
		this.weights = weights;
	}

	public record Entry(LocalDate date, BigDecimal weight, WeightUnit weightUnit, double weightKg, double trendKg) {
	}

	/**
	 * @param entries          weigh-ins on or after {@code from}, oldest first, each with its trend value
	 * @param currentTrendKg   trend as of the latest weigh-in, or {@code null} with no data
	 * @param weeklyChangeKg   trend change per week over the last ~2 weeks, or {@code null}
	 * @param changeInRangeKg  trend change from the first to the last entry in the range
	 */
	public record History(List<Entry> entries, Double currentTrendKg, Double weeklyChangeKg, Double changeInRangeKg) {
	}

	@Transactional
	public void log(UUID userId, LocalDate date, BigDecimal weight, WeightUnit unit, LocalDate today) {
		if (date.isAfter(today.plusDays(1))) { // +1 day of slack for time-zone differences
			throw new BadRequestException("Weigh-ins can't be in the future.");
		}
		weights.upsert(userId, date, weight, unit);
	}

	@Transactional
	public void delete(UUID userId, LocalDate date) {
		weights.delete(userId, date);
	}

	/** The trend is computed over the full history, so the first points in a range are already warmed up. */
	@Transactional(readOnly = true)
	public History history(UUID userId, LocalDate from) {
		List<BodyWeightRepository.Row> rows = weights.all(userId);
		List<WeightTrend.Point> points = trend(rows);

		List<Entry> entries = new java.util.ArrayList<>();
		for (int i = 0; i < rows.size(); i++) {
			var row = rows.get(i);
			if (from == null || !row.date().isBefore(from)) {
				entries.add(new Entry(row.date(), row.weight(), row.unit(), round(row.weightKg()), round(points.get(i).trendKg())));
			}
		}
		Double current = points.isEmpty() ? null : round(points.getLast().trendKg());
		Double weekly = WeightTrend.weeklyChangeKg(points);
		Double change = entries.size() > 1 ? round(entries.getLast().trendKg() - entries.getFirst().trendKg()) : null;
		return new History(entries, current, weekly == null ? null : round(weekly), change);
	}

	/** The full trend series, for other features (e.g. adaptive calorie targets). */
	@Transactional(readOnly = true)
	public List<WeightTrend.Point> trendSeries(UUID userId) {
		return trend(weights.all(userId));
	}

	private static List<WeightTrend.Point> trend(List<BodyWeightRepository.Row> rows) {
		return WeightTrend.compute(rows.stream().map(r -> new WeightTrend.Reading(r.date(), r.weightKg())).toList());
	}

	private static double round(double value) {
		return Math.round(value * 100) / 100.0;
	}
}
