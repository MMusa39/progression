package com.progression.routine;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class RoutineRepository {

	private final JdbcClient jdbc;

	RoutineRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	record RoutineRow(UUID id, String name, String notes) {
	}

	record ExerciseRow(UUID routineId, int position, UUID exerciseId, String exerciseName, String muscleGroup,
			String equipment, int sets, int repMin, int repMax) {
	}

	List<RoutineRow> list(UUID userId) {
		return jdbc.sql("SELECT id, name, notes FROM routine WHERE user_id = :userId ORDER BY lower(name)")
				.param("userId", userId)
				.query(RoutineRow.class)
				.list();
	}

	Optional<RoutineRow> find(UUID userId, UUID id) {
		return jdbc.sql("SELECT id, name, notes FROM routine WHERE id = :id AND user_id = :userId")
				.param("id", id)
				.param("userId", userId)
				.query(RoutineRow.class)
				.optional();
	}

	boolean existsForOtherUser(UUID userId, UUID id) {
		return jdbc.sql("SELECT count(*) > 0 FROM routine WHERE id = :id AND user_id <> :userId")
				.param("id", id).param("userId", userId).query(Boolean.class).single();
	}

	List<ExerciseRow> exercises(Collection<UUID> routineIds) {
		if (routineIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("""
				SELECT re.routine_id, re.position, re.exercise_id, e.name AS exercise_name, e.muscle_group, e.equipment,
				       re.sets, re.rep_min, re.rep_max
				FROM routine_exercise re JOIN exercise e ON e.id = re.exercise_id
				WHERE re.routine_id IN (:ids) ORDER BY re.routine_id, re.position
				""")
				.param("ids", routineIds)
				.query(ExerciseRow.class)
				.list();
	}

	/** How many of these exercises the user may use: catalog exercises or their own. */
	int countUsable(UUID userId, Collection<UUID> exerciseIds) {
		return jdbc.sql("SELECT count(*) FROM exercise WHERE id IN (:ids) AND (owner_id IS NULL OR owner_id = :userId)")
				.param("ids", exerciseIds).param("userId", userId).query(Integer.class).single();
	}

	/** Creates or fully replaces a routine and its exercise list. */
	void upsert(UUID userId, UUID id, String name, String notes, List<ExerciseRow> exercises) {
		jdbc.sql("""
				INSERT INTO routine (id, user_id, name, notes) VALUES (:id, :userId, :name, :notes)
				ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, notes = EXCLUDED.notes, updated_at = now()
				""")
				.param("id", id).param("userId", userId).param("name", name).param("notes", notes)
				.update();
		jdbc.sql("DELETE FROM routine_exercise WHERE routine_id = :id").param("id", id).update();
		for (ExerciseRow e : exercises) {
			jdbc.sql("""
					INSERT INTO routine_exercise (routine_id, position, exercise_id, sets, rep_min, rep_max)
					VALUES (:routineId, :position, :exerciseId, :sets, :repMin, :repMax)
					""")
					.param("routineId", id).param("position", e.position()).param("exerciseId", e.exerciseId())
					.param("sets", e.sets()).param("repMin", e.repMin()).param("repMax", e.repMax())
					.update();
		}
	}

	void delete(UUID userId, UUID id) {
		jdbc.sql("DELETE FROM routine WHERE id = :id AND user_id = :userId").param("id", id).param("userId", userId).update();
	}
}
