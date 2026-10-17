package com.progression.stats;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
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
 * through {@link JdbcClient} instead of JPA: grouping, window functions and
 * {@code array_agg} are natural in SQL, and the results map straight onto
 * response records.
 *
 * <p>Timestamps are bound as {@link OffsetDateTime} in UTC, the type the
 * PostgreSQL driver supports for {@code timestamptz}.
 */
@Repository
class StatsRepository {

	/** Differences smaller than this are rounding noise, not a new record. */
	static final double RECORD_EPSILON = 0.005;

	private final JdbcClient jdbc;

	StatsRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Workouts with at least one working set, started in [from, to). */
	int workoutCount(UUID userId, Instant from, Instant to) {
		return jdbc.sql("""
				SELECT count(DISTINCT workout_id)::int
				FROM working_set
				WHERE user_id = :userId AND started_at >= :from AND started_at < :to
				""")
				.param("userId", userId)
				.param("from", utc(from))
				.param("to", utc(to))
				.query(Integer.class)
				.single();
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

	/** One point per workout that included the exercise, oldest first. */
	List<ExerciseProgressionResponse.Point> progression(UUID userId, UUID exerciseId, Instant from) {
		return jdbc.sql("""
				SELECT workout_id,
				       started_at,
				       round(max(e1rm_kg), 2)::float8                           AS best_e1rm_kg,
				       round(max(weight_kg), 2)::float8                         AS top_weight_kg,
				       (array_agg(reps ORDER BY weight_kg DESC, reps DESC))[1]  AS top_set_reps,
				       max(reps)                                                AS best_reps,
				       count(*)::int                                            AS set_count
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
						rs.getInt("best_reps"),
						rs.getInt("set_count")))
				.list();
	}

	/**
	 * Exercises performed since {@code from}, most recently performed first: their
	 * per-session bests within the range (for "how much did it move") and their
	 * all-time bests.
	 */
	List<ExerciseStatsResponse> exerciseStats(UUID userId, Instant from) {
		return jdbc.sql("""
				WITH sessions AS (
				    SELECT exercise_id, workout_id, started_at,
				           max(e1rm_kg) AS best_e1rm, max(weight_kg) AS heaviest, max(reps) AS best_reps
				    FROM working_set
				    WHERE user_id = :userId
				    GROUP BY exercise_id, workout_id, started_at
				)
				SELECT e.id, e.name, e.muscle_group, e.equipment,
				       count(*) FILTER (WHERE s.started_at >= :from)::int                    AS sessions,
				       max(s.started_at)                                                     AS last_performed_at,
				       array_agg(round(s.best_e1rm, 2)::float8 ORDER BY s.started_at)
				           FILTER (WHERE s.started_at >= :from)                              AS range_e1rm,
				       array_agg(s.best_reps ORDER BY s.started_at)
				           FILTER (WHERE s.started_at >= :from)                              AS range_reps,
				       round(max(s.best_e1rm), 2)::float8                                    AS best_e1rm_kg,
				       (array_agg(s.started_at ORDER BY s.best_e1rm DESC, s.started_at))[1]  AS best_e1rm_at,
				       round(max(s.heaviest), 2)::float8                                     AS heaviest_kg,
				       max(s.best_reps)                                                      AS best_reps
				FROM sessions s
				         JOIN exercise e ON e.id = s.exercise_id
				GROUP BY e.id, e.name, e.muscle_group, e.equipment
				HAVING count(*) FILTER (WHERE s.started_at >= :from) > 0
				ORDER BY last_performed_at DESC
				""")
				.param("userId", userId)
				.param("from", utc(from))
				.query((rs, n) -> new ExerciseStatsResponse(
						rs.getObject("id", UUID.class),
						rs.getString("name"),
						MuscleGroup.valueOf(rs.getString("muscle_group")),
						Equipment.valueOf(rs.getString("equipment")),
						rs.getInt("sessions"),
						instant(rs, "last_performed_at"),
						Arrays.asList((Double[]) rs.getArray("range_e1rm").getArray()),
						Arrays.asList((Integer[]) rs.getArray("range_reps").getArray()),
						rs.getDouble("best_e1rm_kg"),
						instant(rs, "best_e1rm_at"),
						rs.getDouble("heaviest_kg"),
						rs.getInt("best_reps")))
				.list();
	}

	/**
	 * Personal records achieved since {@code from}, newest first.
	 *
	 * <p>Each session's bests are compared with the running maximum of all
	 * <em>earlier</em> sessions of the same exercise (a window ending one row
	 * before the current one). A first-ever session has no earlier maximum, so
	 * the comparison is NULL and it never counts as a record. A session that set
	 * both kinds of record yields two rows.
	 */
	List<RecentRecordResponse> recentRecords(UUID userId, Instant from, int limit) {
		return jdbc.sql("""
				WITH sessions AS (
				    SELECT exercise_id, workout_id, started_at,
				           max(e1rm_kg)   AS e1rm,
				           max(weight_kg) AS heaviest,
				           (array_agg(weight      ORDER BY e1rm_kg DESC, weight_kg DESC))[1] AS e1rm_weight,
				           (array_agg(weight_unit ORDER BY e1rm_kg DESC, weight_kg DESC))[1] AS e1rm_unit,
				           (array_agg(reps        ORDER BY e1rm_kg DESC, weight_kg DESC))[1] AS e1rm_reps,
				           (array_agg(weight      ORDER BY weight_kg DESC, reps DESC))[1]    AS top_weight,
				           (array_agg(weight_unit ORDER BY weight_kg DESC, reps DESC))[1]    AS top_unit,
				           (array_agg(reps        ORDER BY weight_kg DESC, reps DESC))[1]    AS top_reps
				    FROM working_set
				    WHERE user_id = :userId
				    GROUP BY exercise_id, workout_id, started_at
				),
				running AS (
				    SELECT s.*,
				           max(e1rm) OVER earlier     AS previous_e1rm,
				           max(heaviest) OVER earlier AS previous_heaviest
				    FROM sessions s
				    WINDOW earlier AS (PARTITION BY exercise_id ORDER BY started_at
				                       ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
				)
				SELECT r.*, e.name
				FROM running r
				         JOIN exercise e ON e.id = r.exercise_id
				WHERE r.started_at >= :from
				  AND (r.e1rm > r.previous_e1rm + :epsilon OR r.heaviest > r.previous_heaviest + :epsilon)
				ORDER BY r.started_at DESC, e.name
				LIMIT :limit
				""")
				.param("userId", userId)
				.param("from", utc(from))
				.param("epsilon", RECORD_EPSILON)
				.param("limit", limit)
				.query((rs, n) -> {
					UUID exerciseId = rs.getObject("exercise_id", UUID.class);
					String name = rs.getString("name");
					UUID workoutId = rs.getObject("workout_id", UUID.class);
					Instant at = instant(rs, "started_at");
					List<RecentRecordResponse> rows = new ArrayList<>(2);
					double e1rm = rs.getDouble("e1rm");
					double previousE1rm = rs.getDouble("previous_e1rm");
					if (e1rm > previousE1rm + RECORD_EPSILON) {
						rows.add(new RecentRecordResponse(exerciseId, name, workoutId, at, RecordType.ESTIMATED_1RM,
								round(e1rm), round(previousE1rm), rs.getBigDecimal("e1rm_weight"),
								WeightUnit.valueOf(rs.getString("e1rm_unit")), rs.getInt("e1rm_reps")));
					}
					double heaviest = rs.getDouble("heaviest");
					double previousHeaviest = rs.getDouble("previous_heaviest");
					if (heaviest > previousHeaviest + RECORD_EPSILON) {
						rows.add(new RecentRecordResponse(exerciseId, name, workoutId, at, RecordType.HEAVIEST_WEIGHT,
								round(heaviest), round(previousHeaviest), rs.getBigDecimal("top_weight"),
								WeightUnit.valueOf(rs.getString("top_unit")), rs.getInt("top_reps")));
					}
					return rows;
				})
				.list()
				.stream()
				.flatMap(List::stream)
				.toList();
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
	record WorkoutSet(UUID exerciseId, String exerciseName, UUID setId, BigDecimal weight,
			WeightUnit weightUnit, int reps, double weightKg, double e1rmKg) {
	}

	List<WorkoutSet> workoutSets(UUID userId, UUID workoutId) {
		return jdbc.sql("""
				SELECT ws.exercise_id, e.name, ws.set_id, ws.weight, ws.weight_unit, ws.reps,
				       ws.weight_kg::float8 AS weight_kg, ws.e1rm_kg::float8 AS e1rm_kg
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
						rs.getDouble("e1rm_kg")))
				.list();
	}

	/** The user's bests on each exercise across all workouts started before {@code before}. */
	record PreviousBest(UUID exerciseId, double e1rmKg, double heaviestKg) {
	}

	Map<UUID, PreviousBest> previousBests(UUID userId, UUID excludeWorkoutId, Instant before,
			Collection<UUID> exerciseIds) {
		if (exerciseIds.isEmpty()) {
			return Map.of();
		}
		return jdbc.sql("""
				SELECT exercise_id, max(e1rm_kg)::float8 AS e1rm, max(weight_kg)::float8 AS heaviest
				FROM working_set
				WHERE user_id = :userId
				  AND started_at < :before
				  AND workout_id <> :excludeWorkoutId
				  AND exercise_id IN (:exerciseIds)
				GROUP BY exercise_id
				""")
				.param("userId", userId)
				.param("before", utc(before))
				.param("excludeWorkoutId", excludeWorkoutId)
				.param("exerciseIds", exerciseIds)
				.query((rs, n) -> new PreviousBest(
						rs.getObject("exercise_id", UUID.class), rs.getDouble("e1rm"), rs.getDouble("heaviest")))
				.list()
				.stream()
				.collect(Collectors.toMap(PreviousBest::exerciseId, Function.identity()));
	}

	static double round(double value) {
		return Math.round(value * 100) / 100.0;
	}

	private static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}

	private static Instant instant(ResultSet rs, String column) throws SQLException {
		OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
		return value == null ? null : value.toInstant();
	}
}
