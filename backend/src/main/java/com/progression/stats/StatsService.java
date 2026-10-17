package com.progression.stats;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.NotFoundException;
import com.progression.exercise.Exercise;
import com.progression.exercise.ExerciseRepository;
import com.progression.user.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Progress analytics focused on what a lifter acts on: is each lift getting
 * stronger, which personal records were set, and is training consistent.
 * Everything is computed on demand from logged sets (see {@code working_set}).
 */
@Service
public class StatsService {

	/** Upper bound for "from the range start until now (and beyond, for clock skew)". */
	private static final Instant FAR_FUTURE = Instant.parse("9999-01-01T00:00:00Z");

	static final int RECENT_RECORDS_LIMIT = 30;

	private final StatsRepository stats;
	private final ExerciseRepository exercises;
	private final Clock clock;

	StatsService(StatsRepository stats, ExerciseRepository exercises, Clock clock) {
		this.stats = stats;
		this.exercises = exercises;
		this.clock = clock;
	}

	// ------------------------------------------------------------------ consistency

	/**
	 * @param from   start of the range, or {@code null} for all time
	 * @param zoneId IANA time zone of the user, so weeks follow their calendar
	 */
	@Transactional(readOnly = true)
	public StatsSummaryResponse summary(CurrentUser user, Instant from, String zoneId) {
		ZoneId zone = parseZone(zoneId);
		Instant now = clock.instant();
		validateFrom(from, now);

		int workouts = stats.workoutCount(user.id(), from != null ? from : Instant.EPOCH, FAR_FUTURE);
		Integer previous = null;
		if (from != null) {
			// The equally long window just before the range, e.g. the 4 weeks before "last 4 weeks".
			previous = stats.workoutCount(user.id(), from.minus(Duration.between(from, now)), from);
		}
		int streak = Streaks.currentStreakWeeks(stats.activeWeeks(user.id(), zone.getId()), LocalDate.now(clock.withZone(zone)));
		return new StatsSummaryResponse(from, workouts, previous, streak);
	}

	// ------------------------------------------------------------------ strength

	/** Exercises performed in the range, with how they moved and their all-time bests. */
	@Transactional(readOnly = true)
	public List<ExerciseStatsResponse> exerciseStats(CurrentUser user, Instant from) {
		validateFrom(from, clock.instant());
		return stats.exerciseStats(user.id(), from != null ? from : Instant.EPOCH);
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

	/** Personal records set within the range, newest first. */
	@Transactional(readOnly = true)
	public List<RecentRecordResponse> recentRecords(CurrentUser user, Instant from) {
		return recentRecordsOf(user.id(), from);
	}

	/** Records of any user (e.g. a friend); the caller must already have checked access. */
	@Transactional(readOnly = true)
	public List<RecentRecordResponse> recentRecordsOf(UUID userId, Instant from) {
		validateFrom(from, clock.instant());
		return stats.recentRecords(userId, from != null ? from : Instant.EPOCH, RECENT_RECORDS_LIMIT);
	}

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
			if (bestE1rm.e1rmKg() > before.e1rmKg() + StatsRepository.RECORD_EPSILON) {
				records.add(record(bestE1rm, RecordType.ESTIMATED_1RM, bestE1rm.e1rmKg(), before.e1rmKg()));
			}

			StatsRepository.WorkoutSet heaviest = sets.stream()
					.max(Comparator.comparingDouble(StatsRepository.WorkoutSet::weightKg)
							.thenComparingInt(StatsRepository.WorkoutSet::reps))
					.orElseThrow();
			if (heaviest.weightKg() > before.heaviestKg() + StatsRepository.RECORD_EPSILON) {
				records.add(record(heaviest, RecordType.HEAVIEST_WEIGHT, heaviest.weightKg(), before.heaviestKg()));
			}
		});
		return records;
	}

	private static PersonalRecordResponse record(StatsRepository.WorkoutSet set, RecordType type, double value,
			double previous) {
		return new PersonalRecordResponse(set.exerciseId(), set.exerciseName(), type, set.setId(),
				StatsRepository.round(value), StatsRepository.round(previous), set.weight(), set.weightUnit(), set.reps());
	}

	// ------------------------------------------------------------------ helpers

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
