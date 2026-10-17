package com.progression.social;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.progression.common.WeightUnit;
import com.progression.user.AppUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request and response bodies for the friends and leaderboard APIs. */
public final class SocialDtos {

	private SocialDtos() {
	}

	/** The public face of a user: what friends and searchers see. */
	public record UserSummary(UUID id, String username, String displayName) {

		static UserSummary from(AppUser user) {
			return new UserSummary(user.getId(), user.getUsername(), user.getDisplayName());
		}
	}

	public record UserSearchResult(UserSummary user, RelationshipStatus relationship) {
	}

	public record SendRequestBody(@NotBlank @Size(max = 21) String username) {
	}

	/** A pending request, from the current user's point of view. */
	public record FriendRequestResponse(UUID id, UserSummary user, Instant createdAt) {
	}

	public record FriendRequestsResponse(List<FriendRequestResponse> incoming, List<FriendRequestResponse> outgoing) {
	}

	/**
	 * A friend in the friends list.
	 *
	 * @param shareWorkouts whether this friend lets friends see their individual workouts
	 */
	public record FriendResponse(
			UserSummary user,
			Instant friendsSince,
			boolean shareWorkouts,
			int currentStreakWeeks,
			int workoutsLast4Weeks,
			Instant lastWorkoutAt) {
	}

	public record InviteResponse(String code) {
	}

	public record InvitePreviewResponse(UserSummary user, RelationshipStatus relationship) {
	}

	/** Result of sending a request or using an invite: either still pending or now friends. */
	public record ConnectResponse(UserSummary user, RelationshipStatus relationship) {
	}

	// ------------------------------------------------------------------ leaderboards

	/**
	 * Ranking by consistency: weekly streak first, then workouts in the last 4
	 * weeks. Everyone can compete on this regardless of strength, so it names a winner.
	 *
	 * @param rank   1-based, with ties sharing a rank
	 * @param winner true for everyone tied at rank 1 (when they've trained at all)
	 */
	public record ConsistencyEntry(UserSummary user, boolean you, int rank, boolean winner,
			int currentStreakWeeks, int workoutsLast4Weeks) {
	}

	public record ConsistencyLeaderboardResponse(List<ConsistencyEntry> entries) {
	}

	/** A lift that at least one person in the group has logged, offered as a strength-board option. */
	public record LeaderboardExercise(UUID id, String name, int participants) {
	}

	/**
	 * One person's best estimated 1RM on the chosen lift, with the set that
	 * produced it. Shown as a ranking without a winner: absolute strength
	 * mostly reflects body size and training age.
	 */
	public record StrengthEntry(UserSummary user, boolean you, int rank, double bestE1rmKg, BigDecimal weight,
			WeightUnit weightUnit, int reps, Instant achievedAt) {
	}

	public record StrengthLeaderboardResponse(LeaderboardExercise exercise, List<StrengthEntry> entries) {
	}
}
