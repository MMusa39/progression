package com.progression.exercise;

import java.util.List;

import com.progression.common.error.ConflictException;
import com.progression.user.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExerciseService {

	private final ExerciseRepository exercises;

	ExerciseService(ExerciseRepository exercises) {
		this.exercises = exercises;
	}

	/**
	 * Case-insensitive substring search over the exercises visible to the user.
	 * A blank query returns everything (the catalog is small enough to send in one
	 * response; the app caches it).
	 */
	@Transactional(readOnly = true)
	public List<Exercise> search(CurrentUser user, String query) {
		String term = query == null ? "" : query.trim().toLowerCase();
		return exercises.searchVisible(user.id(), "%" + escapeLike(term) + "%");
	}

	@Transactional
	public Exercise createCustom(CurrentUser user, CreateExerciseRequest request) {
		String name = request.name().trim();
		if (exercises.existsVisibleByName(user.id(), name)) {
			throw new ConflictException("An exercise named '" + name + "' already exists");
		}
		return exercises.save(Exercise.custom(user.id(), name, request.muscleGroup(), request.equipment()));
	}

	/** Escapes LIKE wildcards so a search for "50%" matches the literal text. */
	private static String escapeLike(String term) {
		return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}
}
