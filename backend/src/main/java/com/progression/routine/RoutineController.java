package com.progression.routine;

import java.util.List;
import java.util.UUID;

import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/routines")
@Tag(name = "Routines", description = "Reusable workout plans: exercises with target sets and rep ranges")
public class RoutineController {

	private final RoutineService routines;

	RoutineController(RoutineService routines) {
		this.routines = routines;
	}

	@GetMapping
	@Operation(summary = "Your routines")
	public List<RoutineService.RoutineResponse> list(CurrentUser me) {
		return routines.list(me.id());
	}

	@GetMapping("/{id}")
	public RoutineService.RoutineResponse get(CurrentUser me, @PathVariable UUID id) {
		return routines.get(me.id(), id);
	}

	@PutMapping("/{id}")
	@Operation(summary = "Create or replace a routine (client-generated id)")
	public RoutineService.RoutineResponse save(CurrentUser me, @PathVariable UUID id,
			@Validated @RequestBody RoutineService.RoutineRequest request) {
		return routines.save(me.id(), id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(CurrentUser me, @PathVariable UUID id) {
		routines.delete(me.id(), id);
	}
}
