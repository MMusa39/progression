package com.progression.stats;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.NotFoundException;
import com.progression.exercise.Exercise;
import com.progression.exercise.ExerciseRepository;
import com.progression.user.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Progress analytics: summaries, per-exercise time series, and personal records.
 * All values are computed on demand from logged sets (see {@code working_set}).
 */
@Service
public class StatsService {

	/** AUTO buckets switch from weekly to monthly bars beyond this span (~6 months). */
	static final Duration WEEKLY_BUCKET_LIMIT = Duration.ofDays(7 * 26);

	/** Differences smaller than this are rounding noise, not a new record. */
	private static final double RECORD_EPSILON = 0.005;

	private final StatsRepository stats;
	private final ExerciseRepository exercises;
	private final Clock clock;

	StatsService(StatsRepository stats, ExerciseRepository exercises, Clock clock) {
		this.stats = stats;
		this.exercises = exercises;
		this.clock = clock;
	}

	// ------------------------------------------------------------------ summary

	/**
	 * @param from   start of the range, or {@code null} for all time
	 * @param zoneId IANA time zone of the user, used for week/month boundaries
	 * @param bucket requested bucket size, or AUTO
	 */
	@Transactional(readOnly = true)
	public StatsSummaryResponse summary(CurrentUser user, Instant from, String zoneId, Bucket bucket) {
		ZoneId zone = parseZone(zoneId);
		Instant now = clock.instant();
		validateFrom(from, now);

		Instant rangeStart = from != null ? from : stats.firstWorkoutAt(user.id()).orElse(now);
		Bucket resolved = resolveBucket(bucket, rangeStart, now);

		List<StatsSummaryResponse.BucketPoint> filled = fillBuckets(
				stats.buckets(user.id(), rangeStart, StatsRepository.FAR_FUTURE, resolved, zone.getId()),
				rangeStart, now, resolved, zone);

		StatsSummaryResponse.Totals totals = stats.totals(user.id(), rangeStart, StatsRepository.FAR_FUTURE);
		StatsSummaryResponse.Totals previous = null;
		if (from != null) {
			// The equally long window just before the range, e.g. the 4 weeks before "last 4 weeks".
			Duration length = Duration.between(from, now);
			previous = stats.totals(user.id(), from.minus(length), from);
		}

		return new StatsSummaryResponse(
				from,
				resolved,
				totals,
				previous,
				currentStreakWeeks(stats.activeWeeks(user.id(), zone.getId()), LocalDate.now(clock.withZone(zone))),
				filled,
				stats.muscleGroups(user.id(), rangeStart, StatsRepository.FAR_FUTURE));
	}

	static Bucket resolveBucket(Bucket requested, Instant rangeStart, Instant now) {
		if (requested != Bucket.AUTO) {
			return requested;
		}
		return Duration.between(rangeStart, now).compareTo(WEEKLY_BUCKET_LIMIT) <= 0 ? Bucket.WEEK : Bucket.MONTH;
	}

	/**
	 * Returns one bucket per week/month from the range start to the current one,
	 * using zeros where nothing was logged. Leaving empty weeks out would
	 * visually compress time and hide breaks in training.
	 */
	static List<StatsSummaryResponse.BucketPoint> fillBuckets(List<StatsSummaryResponse.BucketPoint> nonEmpty,
			Instant rangeStart, Instant now, Bucket bucket, ZoneId zone) {
		Map<LocalDate, StatsSummaryResponse.BucketPoint> byStart = nonEmpty.stream()
				.collect(Collectors.toMap(StatsSummaryResponse.BucketPoint::start, Function.identity()));

		LocalDate cursor = bucketStart(LocalDate.ofInstant(rangeStart, zone), bucket);
		LocalDate last = bucketStart(LocalDate.ofInstant(now, zone), bucket);
		List<StatsSummaryResponse.BucketPoint> result = new ArrayList<>();
		while (!cursor.isAfter(last)) {
			result.add(byStart.getOrDefault(cursor, new StatsSummaryResponse.BucketPoint(cursor, 0, 0, 0)));
			cursor = bucket == Bucket.WEEK ? cursor.plusWeeks(1) : cursor.plusMonths(1);
		}
		return result;
	}

	static LocalDate bucketStart(LocalDate date, Bucket bucket) {
		return bucket == Bucket.WEEK
				? date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
				: date.withDayOfMonth(1);
	}

	/**
	 * Consecutive training weeks ending this week. If nothing has been logged
	 * yet this week, the streak counts up to last week: the week isn't over, so
	 * the streak isn't broken yet.
	 *
	 * @param activeWeeks Mondays of weeks with a workout, newest first
	 */
	static int currentStreakWeeks(List<LocalDate> activeWeeks, LocalDate today) {
		LocalDate thisWeek = bucketStart(today, Bucket.WEEK);
		Set<LocalDate> active = Set.copyOf(activeWeeks);
		LocalDate cursor = active.contains(thisWeek) ? thisWeek : thisWeek.minusWeeks(1);
		int streak = 0;
		while (active.contains(cursor)) {
			streak++;
			cursor = cursor.minusWeeks(1);
		}
		return streak;
	}

	// ------------------------------------------------------------------ exercises

	@Transactional(readOnly = true)
	public List<ExerciseStatsResponse> exerciseStats(CurrentUser user) {
		return stats.exerciseStats(user.id());
	}

	@Transactional(readOnly = true)
	public ExerciseProgressionResponse progression(CurrentUser user, UUID exerciseId, Instant from) {
		validateFrom(from, clock.instant());
		Exercise exercise = exercises.findVisibleByIds(user.id(), List.of(exerciseId)).stream()
				.findFirst()
				.orElseThrow(() -> new NotFoundException("Exercise not found"));
		return new ExerciseProgressionResponse(
				exercise.getId(),
				exercise.getName(),
				exercise.getMuscleGroup(),
				exercise.getEquipment(),
				stats.progression(user.id(), exerciseId, from != null ? from : Instant.EPOCH));
	}

	// ------------------------------------------------------------------ personal records

	/**
	 * Personal records set in one workout, compared against every workout that
	 * started before it. An exercise performed for the first time sets no records:
	 * there's nothing to beat yet, and "everything is a PR" would make the
	 * celebration meaningless.
	 */
	@Transactional(readOnly = true)
	public List<PersonalRecordResponse> workoutRecords(CurrentUser user, UUID workoutId) {
		Instant startedAt = stats.workoutStartedAt(user.id(), workoutId)
				.orElseThrow(() -> new NotFoundException("Workout not found"));

		Map<UUID, List<StatsRepository.WorkoutSet>> setsByExercise = stats.workoutSets(user.id(), workoutId).stream()
				.collect(Collectors.groupingBy(StatsRepository.WorkoutSet::exerciseId, LinkedHashMap::new, Collectors.toList()));
		Map<UUID, StatsRepository.PreviousBest> previous = stats.previousBests(user.id(), workoutId, startedAt,
				setsByExercise.keySet());

		List<PersonalRecordResponse> records = new ArrayList<>();
		setsByExercise.forEach((exerciseId, sets) -> {
			StatsRepository.PreviousBest before = previous.get(exerciseId);
			if (before == null) {
				return; // first time doing this exercise
			}

			StatsRepository.WorkoutSet bestE1rm = sets.stream()
					.max(Comparator.comparingDouble(StatsRepository.WorkoutSet::e1rmKg)
							.thenComparingDouble(StatsRepository.WorkoutSet::weightKg))
					.orElseThrow();
			if (bestE1rm.e1rmKg() > before.e1rmKg() + RECORD_EPSILON) {
				records.add(record(bestE1rm, RecordType.ESTIMATED_1RM, bestE1rm.e1rmKg(), before.e1rmKg()));
			}

			StatsRepository.WorkoutSet heaviest = sets.stream()
					.max(Comparator.comparingDouble(StatsRepository.WorkoutSet::weightKg)
							.thenComparingInt(StatsRepository.WorkoutSet::reps))
					.orElseThrow();
			if (heaviest.weightKg() > before.heaviestKg() + RECORD_EPSILON) {
				records.add(record(heaviest, RecordType.HEAVIEST_WEIGHT, heaviest.weightKg(), before.heaviestKg()));
			}

			double volume = sets.stream().mapToDouble(StatsRepository.WorkoutSet::volumeKg).sum();
			if (volume > before.sessionVolumeKg() + RECORD_EPSILON) {
				records.add(new PersonalRecordResponse(exerciseId, sets.getFirst().exerciseName(),
						RecordType.SESSION_VOLUME, null, round(volume), round(before.sessionVolumeKg()), null, null, null));
			}
		});
		return records;
	}

	private static PersonalRecordResponse record(StatsRepository.WorkoutSet set, RecordType type, double value,
			double previous) {
		return new PersonalRecordResponse(set.exerciseId(), set.exerciseName(), type, set.setId(), round(value),
				round(previous), set.weight(), set.weightUnit(), set.reps());
	}

	// ------------------------------------------------------------------ helpers

	private static double round(double value) {
		return Math.round(value * 100) / 100.0;
	}

	private static ZoneId parseZone(String zoneId) {
		if (zoneId == null || zoneId.isBlank()) {
			return ZoneId.of("UTC");
		}
		try {
			return ZoneId.of(zoneId);
		}
		catch (DateTimeException ex) {
			throw new BadRequestException("Unknown time zone: " + zoneId);
		}
	}

	private static void validateFrom(Instant from, Instant now) {
		if (from != null && from.isAfter(now)) {
			throw new BadRequestException("'from' must not be in the future");
		}
	}
}
