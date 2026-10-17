package com.progression.stats;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.progression.common.WeightUnit;
import com.progression.exercise.Equipment;
import com.progression.exercise.MuscleGroup;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Analytics queries over the {@code working_set} view (V3 migration).
 *
 * <p>These are aggregate reports, not entity lookups, so they use plain SQL
 * through {@link JdbcClient} instead of JPA: grouping, {@code array_agg},
 * {@code date_trunc} and time zones are all natural in SQL, and the results map
 * straight onto response records.
 *
 * <p>Timestamps are bound as {@link OffsetDateTime} in UTC, the type the
 * PostgreSQL driver supports for {@code timestamptz}.
 */
@Repository
class StatsRepository {

	/** Upper bound used when a range is open-ended ("up to now and beyond"). */
	static final Instant FAR_FUTURE = Instant.parse("9999-01-01T00:00:00Z");

	private final JdbcClient jdbc;

	StatsRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** One point per workout that included the exercise, oldest first. */
	List<ExerciseProgressionResponse.Point> progression(UUID userId, UUID exerciseId, Instant from) {
		return jdbc.sql("""
				SELECT workout_id,
				       started_at,
				       round(max(e1rm_kg), 2)::float8                              AS best_e1rm_kg,
				       round(max(weight_kg), 2)::float8                            AS top_weight_kg,
				       (array_agg(reps ORDER BY weight_kg DESC, reps DESC))[1]     AS top_set_reps,
				       round(sum(volume_kg), 2)::float8                            AS volume_kg,
				       sum(reps)::int                                              AS total_reps,
				       max(reps)                                                   AS best_reps,
				       count(*)::int                                               AS set_count
				FROM working_set
				WHERE user_id = :userId AND exercise_id = :exerciseId AND started_at >= :from
				GROUP BY workout_id, started_at
				ORDER BY started_at
				""")
				.param("userId", userId)
				.param("exerciseId", exerciseId)
				.param("from", utc(from))
				.query((rs, n) -> new ExerciseProgressionResponse.Point(
						rs.getObject("workout_id", UUID.class),
						instant(rs, "started_at"),
						rs.getDouble("best_e1rm_kg"),
						rs.getDouble("top_weight_kg"),
						rs.getInt("top_set_reps"),
						rs.getDouble("volume_kg"),
						rs.getInt("total_reps"),
						rs.getInt("best_reps"),
						rs.getInt("set_count")))
				.list();
	}

	/**
	 * Totals per week or month. Bucket boundaries follow the user's local
	 * calendar ({@code AT TIME ZONE}), so a Sunday-night workout lands in the right week.
	 * Only non-empty buckets are returned; the service fills the gaps.
	 */
	List<StatsSummaryResponse.BucketPoint> buckets(UUID userId, Instant from, Instant to, Bucket bucket, String zone) {
		return jdbc.sql("""
				SELECT date_trunc(:unit, started_at AT TIME ZONE :zone)::date AS bucket_start,
				       count(DISTINCT workout_id)::int                        AS workouts,
				       count(*)::int                                          AS sets,
				       round(sum(volume_kg), 2)::float8                       AS volume_kg
				FROM working_set
				WHERE user_id = :userId AND started_at >= :from AND started_at < :to
				GROUP BY 1
				ORDER BY 1
				""")
				.param("unit", bucket.sqlUnit())
				.param("zone", zone)
				.param("userId", userId)
				.param("from", utc(from))
				.param("to", utc(to))
				.query((rs, n) -> new StatsSummaryResponse.BucketPoint(
						rs.getObject("bucket_start", LocalDate.class),
						rs.getInt("workouts"),
						rs.getInt("sets"),
						rs.getDouble("volume_kg")))
				.list();
	}

	StatsSummaryResponse.Totals totals(UUID userId, Instant from, Instant to) {
		return jdbc.sql("""
				SELECT count(DISTINCT workout_id)::int                 AS workouts,
				       count(*)::int                                   AS sets,
				       coalesce(sum(reps), 0)::int                     AS reps,
				       coalesce(round(sum(volume_kg), 2), 0)::float8   AS volume_kg
				FROM working_set
				WHERE user_id = :userId AND started_at >= :from AND started_at < :to
				""")
				.param("userId", userId)
				.param("from", utc(from))
				.param("to", utc(to))
				.query((rs, n) -> new StatsSummaryResponse.Totals(
						rs.getInt("workouts"), rs.getInt("sets"), rs.getInt("reps"), rs.getDouble("volume_kg")))
				.single();
	}

	List<StatsSummaryResponse.MuscleGroupSets> muscleGroups(UUID userId, Instant from, Instant to) {
		return jdbc.sql("""
				SELECT e.muscle_group, count(*)::int AS sets
				FROM working_set ws
				         JOIN exercise e ON e.id = ws.exercise_id
				WHERE ws.user_id = :userId AND ws.started_at >= :from AND ws.started_at < :to
				GROUP BY e.muscle_group
				ORDER BY sets DESC, e.muscle_group
				""")
				.param("userId", userId)
				.param("from", utc(from))
				.param("to", utc(to))
				.query((rs, n) -> new StatsSummaryResponse.MuscleGroupSets(
						MuscleGroup.valueOf(rs.getString("muscle_group")), rs.getInt("sets")))
				.list();
	}

	/** Mondays (in {@code zone}) of every week with at least one workout, newest first. */
	List<LocalDate> activeWeeks(UUID userId, String zone) {
		return jdbc.sql("""
				SELECT DISTINCT date_trunc('week', started_at AT TIME ZONE :zone)::date AS week
				FROM workout
				WHERE user_id = :userId
				ORDER BY week DESC
				""")
				.param("zone", zone)
				.param("userId", userId)
				.query((rs, n) -> rs.getObject("week", LocalDate.class))
				.list();
	}

	Optional<Instant> firstWorkoutAt(UUID userId) {
		return jdbc.sql("SELECT min(started_at) AS first FROM workout WHERE user_id = :userId")
				.param("userId", userId)
				.query((rs, n) -> Optional.ofNullable(rs.getObject("first", OffsetDateTime.class)).map(OffsetDateTime::toInstant))
				.single();
	}

	/** Per-exercise all-time records and recent trend, most recently performed first. */
	List<ExerciseStatsResponse> exerciseStats(UUID userId) {
		return jdbc.sql("""
				WITH sessions AS (
				    SELECT exercise_id, workout_id, started_at,
				           max(e1rm_kg) AS best_e1rm, max(weight_kg) AS heaviest, max(reps) AS best_reps,
				           -- 1 = most recent session of this exercise; used to keep the last 8 for the sparkline
				           row_number() OVER (PARTITION BY exercise_id ORDER BY started_at DESC) AS recency
				    FROM working_set
				    WHERE user_id = :userId
				    GROUP BY exercise_id, workout_id, started_at
				)
				SELECT e.id, e.name, e.muscle_group, e.equipment,
				       count(*)::int                                                         AS sessions,
				       max(s.started_at)                                                     AS last_performed_at,
				       round(max(s.best_e1rm), 2)::float8                                    AS best_e1rm_kg,
				       (array_agg(s.started_at ORDER BY s.best_e1rm DESC, s.started_at))[1]  AS best_e1rm_at,
				       round(max(s.heaviest), 2)::float8                                     AS heaviest_kg,
				       max(s.best_reps)                                                      AS best_reps,
				       array_agg(round(s.best_e1rm, 2)::float8 ORDER BY s.started_at)
				           FILTER (WHERE s.recency <= 8)                                     AS recent
				FROM sessions s
				         JOIN exercise e ON e.id = s.exercise_id
				GROUP BY e.id, e.name, e.muscle_group, e.equipment
				ORDER BY last_performed_at DESC
				""")
				.param("userId", userId)
				.query((rs, n) -> {
					List<Double> recent = Arrays.asList((Double[]) rs.getArray("recent").getArray()); // oldest first
					return new ExerciseStatsResponse(
							rs.getObject("id", UUID.class),
							rs.getString("name"),
							MuscleGroup.valueOf(rs.getString("muscle_group")),
							Equipment.valueOf(rs.getString("equipment")),
							rs.getInt("sessions"),
							instant(rs, "last_performed_at"),
							rs.getDouble("best_e1rm_kg"),
							instant(rs, "best_e1rm_at"),
							rs.getDouble("heaviest_kg"),
							rs.getInt("best_reps"),
							recent);
				})
				.list();
	}

	/** Start time of a workout, if it exists and belongs to the user. */
	Optional<Instant> workoutStartedAt(UUID userId, UUID workoutId) {
		return jdbc.sql("SELECT started_at FROM workout WHERE id = :id AND user_id = :userId")
				.param("id", workoutId)
				.param("userId", userId)
				.query((rs, n) -> instant(rs, "started_at"))
				.optional();
	}

	/** A working set from one workout, with the numbers needed for PR comparison. */
	record WorkoutSet(UUID exerciseId, String exerciseName, UUID setId, java.math.BigDecimal weight,
			WeightUnit weightUnit, int reps, double weightKg, double e1rmKg, double volumeKg) {
	}

	List<WorkoutSet> workoutSets(UUID userId, UUID workoutId) {
		return jdbc.sql("""
				SELECT ws.exercise_id, e.name, ws.set_id, ws.weight, ws.weight_unit, ws.reps,
				       ws.weight_kg::float8 AS weight_kg, ws.e1rm_kg::float8 AS e1rm_kg, ws.volume_kg::float8 AS volume_kg
				FROM working_set ws
				         JOIN exercise e ON e.id = ws.exercise_id
				WHERE ws.workout_id = :workoutId AND ws.user_id = :userId
				""")
				.param("workoutId", workoutId)
				.param("userId", userId)
				.query((rs, n) -> new WorkoutSet(
						rs.getObject("exercise_id", UUID.class),
						rs.getString("name"),
						rs.getObject("set_id", UUID.class),
						rs.getBigDecimal("weight"),
						WeightUnit.valueOf(rs.getString("weight_unit")),
						rs.getInt("reps"),
						rs.getDouble("weight_kg"),
						rs.getDouble("e1rm_kg"),
						rs.getDouble("volume_kg")))
				.list();
	}

	/** The user's bests on each exercise across all workouts started before {@code before}. */
	record PreviousBest(UUID exerciseId, double e1rmKg, double heaviestKg, double sessionVolumeKg) {
	}

	Map<UUID, PreviousBest> previousBests(UUID userId, UUID excludeWorkoutId, Instant before,
			Collection<UUID> exerciseIds) {
		if (exerciseIds.isEmpty()) {
			return Map.of();
		}
		return jdbc.sql("""
				WITH sessions AS (
				    SELECT exercise_id, workout_id,
				           max(e1rm_kg) AS e1rm, max(weight_kg) AS heaviest, sum(volume_kg) AS volume
				    FROM working_set
				    WHERE user_id = :userId
				      AND started_at < :before
				      AND workout_id <> :excludeWorkoutId
				      AND exercise_id IN (:exerciseIds)
				    GROUP BY exercise_id, workout_id
				)
				SELECT exercise_id, max(e1rm)::float8 AS e1rm, max(heaviest)::float8 AS heaviest, max(volume)::float8 AS volume
				FROM sessions
				GROUP BY exercise_id
				""")
				.param("userId", userId)
				.param("before", utc(before))
				.param("excludeWorkoutId", excludeWorkoutId)
				.param("exerciseIds", exerciseIds)
				.query((rs, n) -> new PreviousBest(
						rs.getObject("exercise_id", UUID.class),
						rs.getDouble("e1rm"),
						rs.getDouble("heaviest"),
						rs.getDouble("volume")))
				.list()
				.stream()
				.collect(Collectors.toMap(PreviousBest::exerciseId, Function.identity()));
	}

	private static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}

	private static Instant instant(ResultSet rs, String column) throws SQLException {
		OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
		return value == null ? null : value.toInstant();
	}
}
