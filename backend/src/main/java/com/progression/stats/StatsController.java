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
@Tag(name = "Stats", description = "Progress analytics and personal records")
public class StatsController {

	private final StatsService statsService;

	StatsController(StatsService statsService) {
		this.statsService = statsService;
	}

	@GetMapping("/api/v1/stats/summary")
	@Operation(summary = "Training summary over a time range: totals, comparison with the previous period, "
			+ "streak, weekly/monthly buckets and muscle-group split")
	public StatsSummaryResponse summary(CurrentUser user,
			@Parameter(description = "Range start (ISO-8601). Omit for all time.") @RequestParam(required = false) Instant from,
			@Parameter(description = "IANA time zone for week/month boundaries, e.g. America/New_York")
			@RequestParam(defaultValue = "UTC") String tz,
			@RequestParam(defaultValue = "AUTO") Bucket bucket) {
		return statsService.summary(user, from, tz, bucket);
	}

	@GetMapping("/api/v1/stats/exercises")
	@Operation(summary = "Every exercise the user has performed, with personal records and a recent trend")
	public List<ExerciseStatsResponse> exercises(CurrentUser user) {
		return statsService.exerciseStats(user);
	}

	@GetMapping("/api/v1/stats/exercises/{exerciseId}/progression")
	@Operation(summary = "Per-session time series for one exercise (e1RM, top set, volume, reps)")
	public ExerciseProgressionResponse progression(CurrentUser user, @PathVariable UUID exerciseId,
			@Parameter(description = "Range start (ISO-8601). Omit for all time.") @RequestParam(required = false) Instant from) {
		return statsService.progression(user, exerciseId, from);
	}

	@GetMapping("/api/v1/workouts/{workoutId}/records")
	@Operation(summary = "Personal records set in a workout, compared with all earlier workouts")
	public List<PersonalRecordResponse> workoutRecords(CurrentUser user, @PathVariable UUID workoutId) {
		return statsService.workoutRecords(user, workoutId);
	}
}
