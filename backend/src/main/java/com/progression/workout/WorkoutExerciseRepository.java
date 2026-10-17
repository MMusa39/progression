package com.progression.workout;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface WorkoutExerciseRepository extends JpaRepository<WorkoutExercise, UUID> {

	/**
	 * The user's most recent performances of an exercise, newest workout first,
	 * skipping {@code excludeWorkoutId} (normally the workout currently being logged).
	 */
	@Query("""
			select we from WorkoutExercise we join we.workout w
			where w.userId = :userId
			  and we.exercise.id = :exerciseId
			  and w.id <> :excludeWorkoutId
			order by w.startedAt desc, we.position asc
			""")
	List<WorkoutExercise> findRecentPerformances(UUID userId, UUID exerciseId, UUID excludeWorkoutId, Limit limit);
}
