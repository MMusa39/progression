package com.progression.social;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.progression.common.WeightUnit;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Group statistics for the friends features: one query for everyone, not one per friend. */
@Repository
class SocialStatsRepository {

	private final JdbcClient jdbc;

	SocialStatsRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Per-user training activity for streaks and the consistency board. */
	record Activity(UUID userId, List<LocalDate> activeWeeks, int workoutsSince, Instant lastWorkoutAt) {
	}

	List<Activity> activity(Collection<UUID> userIds, String zone, Instant since) {
		if (userIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("""
				SELECT user_id,
				       array_agg(DISTINCT date_trunc('week', started_at AT TIME ZONE :zone)::date) AS weeks,
				       count(*) FILTER (WHERE started_at >= :since)::int                        AS recent,
				       max(started_at)                                                          AS last_workout
				FROM workout
				WHERE user_id IN (:userIds)
				GROUP BY user_id
				""")
				.param("zone", zone)
				.param("since", since.atOffset(ZoneOffset.UTC))
				.param("userIds", userIds)
				.query((rs, n) -> new Activity(
						rs.getObject("user_id", UUID.class),
						Arrays.stream((Date[]) rs.getArray("weeks").getArray()).map(Date::toLocalDate).toList(),
						rs.getInt("recent"),
						rs.getObject("last_workout", OffsetDateTime.class).toInstant()))
				.list();
	}

	/** Catalog lifts logged by anyone in the group, most widely shared first (bodyweight moves excluded). */
	List<SocialDtos.LeaderboardExercise> sharedExercises(Collection<UUID> userIds) {
		return jdbc.sql("""
				SELECT e.id, e.name, count(DISTINCT ws.user_id)::int AS participants
				FROM working_set ws
				         JOIN exercise e ON e.id = ws.exercise_id
				WHERE ws.user_id IN (:userIds)
				  AND e.owner_id IS NULL
				  AND e.equipment <> 'BODYWEIGHT'
				  AND ws.weight_kg > 0
				GROUP BY e.id, e.name
				ORDER BY participants DESC, e.name
				LIMIT 40
				""")
				.param("userIds", userIds)
				.query((rs, n) -> new SocialDtos.LeaderboardExercise(
						rs.getObject("id", UUID.class), rs.getString("name"), rs.getInt("participants")))
				.list();
	}

	record StrengthRow(UUID userId, double bestE1rmKg, BigDecimal weight, WeightUnit weightUnit, int reps,
			Instant achievedAt) {
	}

	/** Each person's all-time best estimated 1RM on one lift, strongest first. */
	List<StrengthRow> strength(Collection<UUID> userIds, UUID exerciseId) {
		return jdbc.sql("""
				SELECT user_id,
				       round(max(e1rm_kg), 2)::float8                                       AS best,
				       (array_agg(weight      ORDER BY e1rm_kg DESC, started_at))[1]        AS weight,
				       (array_agg(weight_unit ORDER BY e1rm_kg DESC, started_at))[1]        AS weight_unit,
				       (array_agg(reps        ORDER BY e1rm_kg DESC, started_at))[1]        AS reps,
				       (array_agg(started_at  ORDER BY e1rm_kg DESC, started_at))[1]        AS achieved_at
				FROM working_set
				WHERE user_id IN (:userIds) AND exercise_id = :exerciseId
				GROUP BY user_id
				ORDER BY best DESC
				""")
				.param("userIds", userIds)
				.param("exerciseId", exerciseId)
				.query((rs, n) -> new StrengthRow(
						rs.getObject("user_id", UUID.class),
						rs.getDouble("best"),
						rs.getBigDecimal("weight"),
						WeightUnit.valueOf(rs.getString("weight_unit")),
						rs.getInt("reps"),
						rs.getObject("achieved_at", OffsetDateTime.class).toInstant()))
				.list();
	}
}
