package com.progression.social;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.progression.social.SocialDtos.ConsistencyEntry;
import com.progression.social.SocialDtos.ConsistencyLeaderboardResponse;
import com.progression.social.SocialDtos.LeaderboardExercise;
import com.progression.social.SocialDtos.StrengthEntry;
import com.progression.social.SocialDtos.StrengthLeaderboardResponse;
import com.progression.social.SocialDtos.UserSummary;
import com.progression.stats.Streaks;
import com.progression.user.AppUser;
import com.progression.user.CurrentUser;
import com.progression.user.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Leaderboards among the current user and their friends.
 *
 * <ul>
 *   <li><b>Consistency</b> (weekly streak, then workouts in the last 4 weeks)
 *       crowns a winner: anyone can win it by showing up.</li>
 *   <li><b>Strength</b> (best estimated 1RM per lift) is a ranking to browse,
 *       deliberately without a winner, since absolute strength mostly reflects
 *       body size and years of training.</li>
 * </ul>
 */
@Service
public class LeaderboardService {

	private final FriendService friends;
	private final UserService users;
	private final SocialStatsRepository socialStats;
	private final Clock clock;

	LeaderboardService(FriendService friends, UserService users, SocialStatsRepository socialStats, Clock clock) {
		this.friends = friends;
		this.users = users;
		this.socialStats = socialStats;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public ConsistencyLeaderboardResponse consistency(CurrentUser me, String zoneId) {
		ZoneId zone = FriendService.parseZone(zoneId);
		List<UUID> group = group(me);
		Map<UUID, SocialStatsRepository.Activity> activity = socialStats
				.activity(group, zone.getId(), clock.instant().minus(FriendService.RECENT_WINDOW)).stream()
				.collect(Collectors.toMap(SocialStatsRepository.Activity::userId, Function.identity()));
		LocalDate today = LocalDate.now(clock.withZone(zone));

		List<Score> scores = users.findAllById(group).stream()
				.map(user -> {
					var a = activity.get(user.getId());
					return new Score(user,
							a == null ? 0 : Streaks.currentStreakWeeks(a.activeWeeks(), today),
							a == null ? 0 : a.workoutsSince());
				})
				.sorted(Comparator.comparingInt(Score::streak).reversed()
						.thenComparing(Comparator.comparingInt(Score::workouts).reversed())
						.thenComparing(s -> s.user().getUsername(), Comparator.nullsLast(Comparator.naturalOrder())))
				.toList();

		List<ConsistencyEntry> entries = new ArrayList<>();
		for (int i = 0; i < scores.size(); i++) {
			Score s = scores.get(i);
			// Standard competition ranking: ties share a rank (1, 1, 3).
			int rank = i > 0 && scores.get(i - 1).ties(s) ? entries.get(i - 1).rank() : i + 1;
			boolean trained = s.streak() > 0 || s.workouts() > 0;
			entries.add(new ConsistencyEntry(UserSummary.from(s.user()), s.user().getId().equals(me.id()), rank,
					rank == 1 && trained, s.streak(), s.workouts()));
		}
		return new ConsistencyLeaderboardResponse(entries);
	}

	/** One person's consistency: weekly streak first, then recent workouts as the tiebreaker. */
	private record Score(AppUser user, int streak, int workouts) {

		boolean ties(Score other) {
			return streak == other.streak && workouts == other.workouts;
		}
	}

	/** Lifts anyone in the group has logged, most widely shared first. */
	@Transactional(readOnly = true)
	public List<LeaderboardExercise> strengthExercises(CurrentUser me) {
		return socialStats.sharedExercises(group(me));
	}

	/**
	 * Best estimated 1RM per person on one lift. Defaults to the lift the most
	 * people in the group have logged.
	 */
	@Transactional(readOnly = true)
	public StrengthLeaderboardResponse strength(CurrentUser me, UUID exerciseId) {
		List<UUID> group = group(me);
		List<LeaderboardExercise> options = socialStats.sharedExercises(group);
		LeaderboardExercise exercise = exerciseId == null
				? options.stream().findFirst().orElse(null)
				: options.stream().filter(o -> o.id().equals(exerciseId)).findFirst().orElse(null);
		if (exercise == null) {
			return new StrengthLeaderboardResponse(null, List.of());
		}

		List<SocialStatsRepository.StrengthRow> rows = socialStats.strength(group, exercise.id());
		Map<UUID, AppUser> people = users.findAllById(rows.stream().map(SocialStatsRepository.StrengthRow::userId).toList())
				.stream().collect(Collectors.toMap(AppUser::getId, Function.identity()));
		List<StrengthEntry> entries = new ArrayList<>();
		for (int i = 0; i < rows.size(); i++) {
			var row = rows.get(i);
			int rank = i > 0 && rows.get(i - 1).bestE1rmKg() == row.bestE1rmKg() ? entries.get(i - 1).rank() : i + 1;
			entries.add(new StrengthEntry(UserSummary.from(people.get(row.userId())), row.userId().equals(me.id()), rank,
					row.bestE1rmKg(), row.weight(), row.weightUnit(), row.reps(), row.achievedAt()));
		}
		return new StrengthLeaderboardResponse(exercise, entries);
	}

	/** The current user plus their friends. */
	private List<UUID> group(CurrentUser me) {
		List<UUID> group = new ArrayList<>(friends.friendIds(me.id()));
		group.add(me.id());
		return group;
	}
}
