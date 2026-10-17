package com.progression.workout;

import java.util.UUID;

import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exercise-centric views of workout data. These are served under
 * {@code /exercises} but live in the workout package because they query workouts.
 */
@RestController
@RequestMapping("/api/v1/exercises/{exerciseId}")
@Tag(name = "Exercises")
public class ExerciseHistoryController {

	private final WorkoutService workoutService;

	ExerciseHistoryController(WorkoutService workoutService) {
		this.workoutService = workoutService;
	}

	@GetMapping("/last-performance")
	@Operation(summary = "Sets from the most recent workout that included this exercise",
			description = "Returns 204 No Content if the user has never performed it. Pass "
					+ "excludeWorkoutId (the workout being logged) so it doesn't report itself.")
	public ResponseEntity<LastPerformanceResponse> lastPerformance(CurrentUser user, @PathVariable UUID exerciseId,
			@RequestParam(required = false) UUID excludeWorkoutId) {
		return workoutService.lastPerformance(user, exerciseId, excludeWorkoutId)
				.map(ResponseEntity::ok)
				.orElseGet(() -> ResponseEntity.noContent().build());
	}
}
