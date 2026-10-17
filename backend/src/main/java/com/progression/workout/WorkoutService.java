package com.progression.workout;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.ConflictException;
import com.progression.common.error.NotFoundException;
import com.progression.common.web.PageResponse;
import com.progression.exercise.Exercise;
import com.progression.exercise.ExerciseRepository;
import com.progression.user.CurrentUser;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business logic for workouts. Methods return response DTOs rather than
 * entities, so lazy associations are read while the transaction is still open.
 */
@Service
public class WorkoutService {

	static final int DEFAULT_PAGE_SIZE = 20;
	static final int MAX_PAGE_SIZE = 50;

	/** Stands in for "exclude nothing" in queries that take an id to exclude. */
	private static final UUID NO_WORKOUT = new UUID(0, 0);

	private final WorkoutRepository workouts;
	private final WorkoutExerciseRepository workoutExercises;
	private final ExerciseRepository exercises;

	WorkoutService(WorkoutRepository workouts, WorkoutExerciseRepository workoutExercises,
			ExerciseRepository exercises) {
		this.workouts = workouts;
		this.workoutExercises = workoutExercises;
		this.exercises = exercises;
	}

	/** Result of an upsert: the saved workout, and whether it was newly created (201) or updated (200). */
	public record SaveResult(WorkoutResponse workout, boolean created) {
	}

	@Transactional(readOnly = true)
	public WorkoutResponse get(CurrentUser user, UUID workoutId) {
		return WorkoutResponse.from(findOwned(user, workoutId));
	}

	/**
	 * Creates or fully replaces a workout. This is the heart of offline sync
	 * (ADR 0003):
	 * <ul>
	 *   <li><b>Idempotent:</b> sending the same request twice leaves the same
	 *       state, so a client may blindly retry after a timeout.</li>
	 *   <li><b>Last-write-wins:</b> a request whose {@code updatedAt} is older
	 *       than the stored copy is rejected with 409, so a stale device can't
	 *       overwrite newer data.</li>
	 *   <li><b>Reconciliation by id:</b> exercises and sets that already exist are
	 *       updated in place, new ids are inserted, and missing ids are deleted.</li>
	 * </ul>
	 */
	@Transactional
	public SaveResult save(CurrentUser user, UUID workoutId, WorkoutRequest request) {
		validateStructure(request);
		Instant updatedAt = toDbPrecision(request.updatedAt());

		Workout workout = workouts.findById(workoutId).orElse(null);
		boolean created = workout == null;
		if (created) {
			workout = new Workout(workoutId, user.id());
		}
		else {
			if (!workout.getUserId().equals(user.id())) {
				// Same response as a missing workout: never confirm that another user's id exists.
				throw new NotFoundException("Workout not found");
			}
			if (workout.getUpdatedAt().isAfter(updatedAt)) {
				throw new ConflictException("The server has a newer version of this workout (updated "
						+ workout.getUpdatedAt() + "). Fetch it before saving again.");
			}
		}

		Map<UUID, Exercise> exerciseDefinitions = loadExerciseDefinitions(user, request);
		workout.updateDetails(request.name().trim(), toDbPrecision(request.startedAt()),
				toDbPrecision(request.endedAt()), request.notes(), updatedAt);
		applyExercises(workout, request.exercises(), exerciseDefinitions);

		// Flush now so constraint violations surface here as exceptions the error
		// handler understands, rather than during commit.
		if (created) {
			workouts.saveAndFlush(workout);
		}
		else {
			workouts.flush();
		}
		return new SaveResult(WorkoutResponse.from(workout), created);
	}

	/** Deleting is idempotent: deleting a workout that is already gone still succeeds. */
	@Transactional
	public void delete(CurrentUser user, UUID workoutId) {
		workouts.deleteByIdAndUserId(workoutId, user.id());
	}

	/**
	 * One page of the user's history, newest first.
	 *
	 * @param cursor {@code nextCursor} from the previous page, or {@code null} for the first page
	 */
	@Transactional(readOnly = true)
	public PageResponse<WorkoutSummaryResponse> list(CurrentUser user, String cursor, Integer pageSize) {
		int size = pageSize == null ? DEFAULT_PAGE_SIZE : Math.clamp(pageSize, 1, MAX_PAGE_SIZE);
		// Ask for one extra row: if it comes back, there is another page.
		Limit limit = Limit.of(size + 1);

		List<Workout> rows;
		if (cursor == null || cursor.isBlank()) {
			rows = workouts.findByUserIdOrderByStartedAtDescIdDesc(user.id(), limit);
		}
		else {
			WorkoutCursor after = WorkoutCursor.decode(cursor);
			rows = workouts.findPageAfter(user.id(), after.startedAt(), after.id(), limit);
		}

		boolean hasMore = rows.size() > size;
		List<Workout> page = hasMore ? rows.subList(0, size) : rows;
		String nextCursor = hasMore ? WorkoutCursor.of(page.getLast()).encode() : null;
		return new PageResponse<>(page.stream().map(WorkoutSummaryResponse::from).toList(), nextCursor);
	}

	/**
	 * The most recent time the user performed {@code exerciseId}, ignoring
	 * {@code excludeWorkoutId} (pass the in-progress workout so it doesn't report itself).
	 */
	@Transactional(readOnly = true)
	public Optional<LastPerformanceResponse> lastPerformance(CurrentUser user, UUID exerciseId,
			UUID excludeWorkoutId) {
		UUID exclude = excludeWorkoutId == null ? NO_WORKOUT : excludeWorkoutId;
		return workoutExercises.findRecentPerformances(user.id(), exerciseId, exclude, Limit.of(1))
				.stream()
				.findFirst()
				.map(LastPerformanceResponse::from);
	}

	private Workout findOwned(CurrentUser user, UUID workoutId) {
		return workouts.findById(workoutId)
				.filter(workout -> workout.getUserId().equals(user.id()))
				.orElseThrow(() -> new NotFoundException("Workout not found"));
	}

	/** Rules that bean validation can't express: date ordering and duplicate ids. */
	private static void validateStructure(WorkoutRequest request) {
		if (request.endedAt() != null && request.endedAt().isBefore(request.startedAt())) {
			throw new BadRequestException("endedAt must not be before startedAt");
		}
		Set<UUID> seen = new HashSet<>();
		for (WorkoutRequest.ExerciseEntry exercise : request.exercises()) {
			if (!seen.add(exercise.id())) {
				throw new BadRequestException("Duplicate id in request: " + exercise.id());
			}
			for (WorkoutRequest.SetEntry set : exercise.sets()) {
				if (!seen.add(set.id())) {
					throw new BadRequestException("Duplicate id in request: " + set.id());
				}
			}
		}
	}

	/**
	 * Loads every exercise definition the request references in one query, and
	 * rejects ids that don't exist or belong to another user's custom exercises.
	 */
	private Map<UUID, Exercise> loadExerciseDefinitions(CurrentUser user, WorkoutRequest request) {
		Set<UUID> ids = request.exercises().stream()
				.map(WorkoutRequest.ExerciseEntry::exerciseId)
				.collect(Collectors.toSet());
		if (ids.isEmpty()) {
			return Map.of();
		}
		Map<UUID, Exercise> found = exercises.findVisibleByIds(user.id(), ids).stream()
				.collect(Collectors.toMap(Exercise::getId, Function.identity()));
		ids.removeAll(found.keySet());
		if (!ids.isEmpty()) {
			throw new BadRequestException("Unknown exercise id(s): " + ids);
		}
		return found;
	}

	/**
	 * Updates the workout's exercises to match the request, reusing existing
	 * entities by id so unchanged rows are not deleted and re-inserted.
	 *
	 * <p>Limitation: ids are matched within their parent only. Moving an existing
	 * set to a different exercise under the same id results in a 409 (duplicate
	 * key). The app always gives new sets new ids, so this doesn't happen in practice.
	 */
	private static void applyExercises(Workout workout, List<WorkoutRequest.ExerciseEntry> requested,
			Map<UUID, Exercise> definitions) {
		Map<UUID, WorkoutExercise> existing = indexById(workout.getExercises(), WorkoutExercise::getId);
		List<WorkoutExercise> result = new ArrayList<>(requested.size());

		for (int position = 0; position < requested.size(); position++) {
			WorkoutRequest.ExerciseEntry entry = requested.get(position);
			WorkoutExercise workoutExercise = existing.get(entry.id());
			if (workoutExercise == null) {
				workoutExercise = new WorkoutExercise(entry.id(), workout);
			}
			workoutExercise.update(definitions.get(entry.exerciseId()), position, entry.notes());
			applySets(workoutExercise, entry.sets());
			result.add(workoutExercise);
		}
		workout.replaceExercises(result);
	}

	private static void applySets(WorkoutExercise workoutExercise, List<WorkoutRequest.SetEntry> requested) {
		Map<UUID, ExerciseSet> existing = indexById(workoutExercise.getSets(), ExerciseSet::getId);
		List<ExerciseSet> result = new ArrayList<>(requested.size());

		for (int position = 0; position < requested.size(); position++) {
			WorkoutRequest.SetEntry entry = requested.get(position);
			ExerciseSet set = existing.get(entry.id());
			if (set == null) {
				set = new ExerciseSet(entry.id(), workoutExercise);
			}
			set.update(position, entry.setType(), entry.weight(), entry.weightUnit(), entry.reps(), entry.rpe(),
					toDbPrecision(entry.completedAt()));
			result.add(set);
		}
		workoutExercise.replaceSets(result);
	}

	private static <T> Map<UUID, T> indexById(List<T> items, Function<T, UUID> id) {
		Map<UUID, T> index = new HashMap<>();
		items.forEach(item -> index.put(id.apply(item), item));
		return index;
	}

	/**
	 * PostgreSQL stores timestamps to the microsecond, while Java can carry
	 * nanoseconds. Truncating up front means the value we compare and return is
	 * exactly the value stored.
	 */
	private static Instant toDbPrecision(Instant instant) {
		return instant == null ? null : instant.truncatedTo(ChronoUnit.MICROS);
	}
}
