package com.progression.exercise;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Every query here is scoped to what one user can see: the catalog
 * ({@code ownerId is null}) plus their own custom exercises.
 */
public interface ExerciseRepository extends JpaRepository<Exercise, UUID> {

	/**
	 * Visible exercises whose name contains {@code pattern}, alphabetically.
	 * {@code pattern} must already be a lower-case SQL LIKE pattern with
	 * wildcards escaped (see {@link ExerciseService#search}).
	 */
	@Query("""
			select e from Exercise e
			where (e.ownerId is null or e.ownerId = :userId)
			  and lower(e.name) like :pattern escape '\\'
			order by e.name
			""")
	List<Exercise> searchVisible(UUID userId, String pattern);

	@Query("""
			select e from Exercise e
			where e.id in :ids and (e.ownerId is null or e.ownerId = :userId)
			""")
	List<Exercise> findVisibleByIds(UUID userId, Collection<UUID> ids);

	/** True if the name clashes, case-insensitively, with a catalog exercise or one of the user's own. */
	@Query("""
			select count(e) > 0 from Exercise e
			where (e.ownerId is null or e.ownerId = :userId) and lower(e.name) = lower(:name)
			""")
	boolean existsVisibleByName(UUID userId, String name);
}
