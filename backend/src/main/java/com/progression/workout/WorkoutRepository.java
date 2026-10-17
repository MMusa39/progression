package com.progression.workout;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface WorkoutRepository extends JpaRepository<Workout, UUID> {

	/** First page of a user's history, newest first. */
	List<Workout> findByUserIdOrderByStartedAtDescIdDesc(UUID userId, Limit limit);

	/**
	 * The page after a cursor ({@code startedAt}, {@code id}), using keyset
	 * pagination: it seeks past the last row seen instead of skipping N rows with
	 * OFFSET. Pages stay stable when new workouts are added, and each page costs one
	 * index range scan on {@code workout_user_started_idx}.
	 */
	@Query("""
			select w from Workout w
			where w.userId = :userId
			  and (w.startedAt < :startedAt or (w.startedAt = :startedAt and w.id < :id))
			order by w.startedAt desc, w.id desc
			""")
	List<Workout> findPageAfter(UUID userId, Instant startedAt, UUID id, Limit limit);

	/**
	 * Deletes a workout in one statement. Exercises and sets go with it through
	 * the database's {@code ON DELETE CASCADE}, rather than JPA loading and deleting
	 * each row individually.
	 */
	@Modifying
	@Query("delete from Workout w where w.id = :id and w.userId = :userId")
	int deleteByIdAndUserId(UUID id, UUID userId);
}
