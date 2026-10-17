package com.progression.routine;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Routines: reusable workout plans with target sets and a rep range per exercise. */
@Service
public class RoutineService {

	private final RoutineRepository routines;

	RoutineService(RoutineRepository routines) {
		this.routines = routines;
	}

	public record ExerciseRequest(
			@NotNull UUID exerciseId,
			@NotNull @Min(1) @Max(20) Integer sets,
			@NotNull @Min(1) @Max(100) Integer repMin,
			@NotNull @Min(1) @Max(100) Integer repMax) {
	}

	public record RoutineRequest(
			@NotBlank @Size(max = 100) String name,
			@Size(max = 1000) String notes,
			@NotEmpty @Size(max = 30) List<@Valid @NotNull ExerciseRequest> exercises) {
	}

	public record RoutineExercise(UUID exerciseId, String exerciseName, String muscleGroup, String equipment, int sets,
			int repMin, int repMax) {
	}

	public record RoutineResponse(UUID id, String name, String notes, List<RoutineExercise> exercises) {
	}

	@Transactional(readOnly = true)
	public List<RoutineResponse> list(UUID userId) {
		return describe(routines.list(userId));
	}

	@Transactional(readOnly = true)
	public RoutineResponse get(UUID userId, UUID id) {
		return describe(List.of(routines.find(userId, id).orElseThrow(() -> new NotFoundException("Routine not found")))).getFirst();
	}

	/** Creates or replaces a routine (client-generated id, idempotent like workouts). */
	@Transactional
	public RoutineResponse save(UUID userId, UUID id, RoutineRequest request) {
		if (routines.existsForOtherUser(userId, id)) {
			throw new NotFoundException("Routine not found");
		}
		Set<UUID> exerciseIds = new HashSet<>();
		List<RoutineRepository.ExerciseRow> rows = new ArrayList<>();
		for (int i = 0; i < request.exercises().size(); i++) {
			var e = request.exercises().get(i);
			if (e.repMax() < e.repMin()) {
				throw new BadRequestException("The top of a rep range can't be below the bottom.");
			}
			exerciseIds.add(e.exerciseId());
			rows.add(new RoutineRepository.ExerciseRow(id, i, e.exerciseId(), null, null, null, e.sets(), e.repMin(), e.repMax()));
		}
		if (routines.countUsable(userId, exerciseIds) != exerciseIds.size()) {
			throw new BadRequestException("A routine exercise doesn't exist.");
		}
		String notes = request.notes() == null || request.notes().isBlank() ? null : request.notes().trim();
		routines.upsert(userId, id, request.name().trim(), notes, rows);
		return get(userId, id);
	}

	@Transactional
	public void delete(UUID userId, UUID id) {
		routines.delete(userId, id);
	}

	private List<RoutineResponse> describe(List<RoutineRepository.RoutineRow> rows) {
		Map<UUID, List<RoutineRepository.ExerciseRow>> byRoutine = routines
				.exercises(rows.stream().map(RoutineRepository.RoutineRow::id).toList())
				.stream().collect(Collectors.groupingBy(RoutineRepository.ExerciseRow::routineId));
		return rows.stream().map(r -> new RoutineResponse(r.id(), r.name(), r.notes(),
				byRoutine.getOrDefault(r.id(), List.of()).stream()
						.map(e -> new RoutineExercise(e.exerciseId(), e.exerciseName(), e.muscleGroup(), e.equipment(), e.sets(),
								e.repMin(), e.repMax()))
						.toList()))
				.toList();
	}
}
