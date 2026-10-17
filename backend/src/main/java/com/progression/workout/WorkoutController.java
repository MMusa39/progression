package com.progression.workout;

import java.util.UUID;

import com.progression.common.web.PageResponse;
import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workouts")
@Tag(name = "Workouts", description = "Logging workouts and browsing history")
public class WorkoutController {

	private final WorkoutService workoutService;

	WorkoutController(WorkoutService workoutService) {
		this.workoutService = workoutService;
	}

	@GetMapping
	@Operation(summary = "Workout history, newest first (cursor-paginated)")
	public PageResponse<WorkoutSummaryResponse> list(CurrentUser user,
			@RequestParam(required = false) String cursor,
			@RequestParam(required = false) Integer limit) {
		return workoutService.list(user, cursor, limit);
	}

	@GetMapping("/{id}")
	@Operation(summary = "Get a full workout with exercises and sets")
	public WorkoutResponse get(CurrentUser user, @PathVariable UUID id) {
		return workoutService.get(user, id);
	}

	@PutMapping("/{id}")
	@Operation(summary = "Create or replace a workout (idempotent)",
			description = "Returns 201 when the workout is created, 200 when it is updated, "
					+ "and 409 if the server holds a newer version (by updatedAt).")
	public ResponseEntity<WorkoutResponse> save(CurrentUser user, @PathVariable UUID id,
			@Validated @RequestBody WorkoutRequest request) {
		WorkoutService.SaveResult result = workoutService.save(user, id, request);
		return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.workout());
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Delete a workout (idempotent)")
	public void delete(CurrentUser user, @PathVariable UUID id) {
		workoutService.delete(user, id);
	}
}
