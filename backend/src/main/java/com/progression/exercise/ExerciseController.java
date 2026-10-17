package com.progression.exercise;

import java.util.List;

import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/exercises")
@Tag(name = "Exercises", description = "Built-in exercise catalog and the user's custom exercises")
public class ExerciseController {

	private final ExerciseService exerciseService;

	ExerciseController(ExerciseService exerciseService) {
		this.exerciseService = exerciseService;
	}

	@GetMapping
	@Operation(summary = "List or search exercises visible to the current user")
	public List<ExerciseResponse> search(CurrentUser user, @RequestParam(required = false) String query) {
		return exerciseService.search(user, query).stream().map(ExerciseResponse::from).toList();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Create a custom exercise")
	public ExerciseResponse create(CurrentUser user, @Validated @RequestBody CreateExerciseRequest request) {
		return ExerciseResponse.from(exerciseService.createCustom(user, request));
	}
}
