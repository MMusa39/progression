package com.progression.stats;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Stats", description = "Strength progress, personal records and consistency")
public class StatsController {

	private static final String FROM_DESCRIPTION = "Range start (ISO-8601). Omit for all time.";

	private final StatsService statsService;

	StatsController(StatsService statsService) {
		this.statsService = statsService;
	}

	@GetMapping("/api/v1/stats/summary")
	@Operation(summary = "Workouts in the range (and the previous period) plus the current weekly streak")
	public StatsSummaryResponse summary(CurrentUser user,
			@Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false) Instant from,
			@Parameter(description = "IANA time zone for week boundaries, e.g. America/New_York")
			@RequestParam(defaultValue = "UTC") String tz) {
		return statsService.summary(user, from, tz);
	}

	@GetMapping("/api/v1/stats/exercises")
	@Operation(summary = "Exercises performed in the range: per-session bests in the range and all-time records")
	public List<ExerciseStatsResponse> exercises(CurrentUser user,
			@Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false) Instant from) {
		return statsService.exerciseStats(user, from);
	}

	@GetMapping("/api/v1/stats/exercises/{exerciseId}/progression")
	@Operation(summary = "Per-session time series for one exercise (estimated 1RM, top set, reps)")
	public ExerciseProgressionResponse progression(CurrentUser user, @PathVariable UUID exerciseId,
			@Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false) Instant from) {
		return statsService.progression(user, exerciseId, from);
	}

	@GetMapping("/api/v1/stats/records")
	@Operation(summary = "Personal records set within the range, newest first")
	public List<RecentRecordResponse> records(CurrentUser user,
			@Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false) Instant from) {
		return statsService.recentRecords(user, from);
	}

	@GetMapping("/api/v1/workouts/{workoutId}/records")
	@Operation(summary = "Personal records set in a workout, compared with all earlier workouts")
	public List<PersonalRecordResponse> workoutRecords(CurrentUser user, @PathVariable UUID workoutId) {
		return statsService.workoutRecords(user, workoutId);
	}
}
