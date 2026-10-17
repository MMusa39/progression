package com.progression.social;

import java.util.List;
import java.util.UUID;

import com.progression.social.SocialDtos.ConsistencyLeaderboardResponse;
import com.progression.social.SocialDtos.LeaderboardExercise;
import com.progression.social.SocialDtos.StrengthLeaderboardResponse;
import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/leaderboards")
@Tag(name = "Leaderboards", description = "Rankings among you and your friends")
public class LeaderboardController {

	private final LeaderboardService leaderboards;

	LeaderboardController(LeaderboardService leaderboards) {
		this.leaderboards = leaderboards;
	}

	@GetMapping("/consistency")
	@Operation(summary = "Ranked by weekly streak, then workouts in the last 4 weeks; names a winner")
	public ConsistencyLeaderboardResponse consistency(CurrentUser me, @RequestParam(defaultValue = "UTC") String tz) {
		return leaderboards.consistency(me, tz);
	}

	@GetMapping("/strength/exercises")
	@Operation(summary = "Lifts available for the strength board (logged by anyone in your group)")
	public List<LeaderboardExercise> strengthExercises(CurrentUser me) {
		return leaderboards.strengthExercises(me);
	}

	@GetMapping("/strength")
	@Operation(summary = "Best estimated 1RM per person on one lift (defaults to the most shared lift); no winner")
	public StrengthLeaderboardResponse strength(CurrentUser me, @RequestParam(required = false) UUID exerciseId) {
		return leaderboards.strength(me, exerciseId);
	}
}
