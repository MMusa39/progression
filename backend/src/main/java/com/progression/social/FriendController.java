package com.progression.social;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.progression.common.web.PageResponse;
import com.progression.social.SocialDtos.ConnectResponse;
import com.progression.social.SocialDtos.FriendRequestsResponse;
import com.progression.social.SocialDtos.FriendResponse;
import com.progression.social.SocialDtos.InvitePreviewResponse;
import com.progression.social.SocialDtos.InviteResponse;
import com.progression.social.SocialDtos.SendRequestBody;
import com.progression.social.SocialDtos.UserSearchResult;
import com.progression.stats.RecentRecordResponse;
import com.progression.stats.StatsService;
import com.progression.user.CurrentUser;
import com.progression.workout.WorkoutResponse;
import com.progression.workout.WorkoutService;
import com.progression.workout.WorkoutSummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Friends", description = "Mutual friendships, invites, and viewing friends' training")
public class FriendController {

	private final FriendService friends;
	private final WorkoutService workouts;
	private final StatsService stats;

	FriendController(FriendService friends, WorkoutService workouts, StatsService stats) {
		this.friends = friends;
		this.workouts = workouts;
		this.stats = stats;
	}

	@GetMapping("/users/search")
	@Operation(summary = "Find people by username prefix, with your relationship to each")
	public List<UserSearchResult> search(CurrentUser me, @RequestParam("q") String query) {
		return friends.search(me, query);
	}

	// ------------------------------------------------------------------ requests

	@GetMapping("/friends/requests")
	@Operation(summary = "Pending friend requests, incoming and outgoing")
	public FriendRequestsResponse requests(CurrentUser me) {
		return friends.requests(me);
	}

	@PostMapping("/friends/requests")
	@Operation(summary = "Send a friend request by username (accepts theirs if they already asked you)")
	public ConnectResponse sendRequest(CurrentUser me, @Validated @RequestBody SendRequestBody body) {
		return friends.sendRequest(me, body.username());
	}

	@PostMapping("/friends/requests/{requestId}/accept")
	@Operation(summary = "Accept an incoming friend request")
	public ConnectResponse accept(CurrentUser me, @PathVariable UUID requestId) {
		return friends.accept(me, requestId);
	}

	@DeleteMapping("/friends/requests/{requestId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Decline an incoming request or cancel an outgoing one")
	public void removeRequest(CurrentUser me, @PathVariable UUID requestId) {
		friends.removeRequest(me, requestId);
	}

	// ------------------------------------------------------------------ invites

	@GetMapping("/friends/invite")
	@Operation(summary = "Your invite code (created on first use)")
	public InviteResponse invite(CurrentUser me) {
		return friends.invite(me);
	}

	@PostMapping("/friends/invite/reset")
	@Operation(summary = "Replace your invite code; previously shared links stop working")
	public InviteResponse resetInvite(CurrentUser me) {
		return friends.resetInvite(me);
	}

	@GetMapping("/friends/invite/{code}")
	@Operation(summary = "Who an invite code belongs to")
	public InvitePreviewResponse previewInvite(CurrentUser me, @PathVariable String code) {
		return friends.previewInvite(me, code);
	}

	@PostMapping("/friends/invite/{code}")
	@Operation(summary = "Use an invite code: become friends with its owner immediately")
	public ConnectResponse acceptInvite(CurrentUser me, @PathVariable String code) {
		return friends.acceptInvite(me, code);
	}

	// ------------------------------------------------------------------ friends

	@GetMapping("/friends")
	@Operation(summary = "Your friends, with their streak and recent activity")
	public List<FriendResponse> list(CurrentUser me, @RequestParam(defaultValue = "UTC") String tz) {
		return friends.friends(me, tz);
	}

	@GetMapping("/friends/{friendId}")
	@Operation(summary = "One friend's profile summary")
	public FriendResponse friend(CurrentUser me, @PathVariable UUID friendId, @RequestParam(defaultValue = "UTC") String tz) {
		return friends.friend(me, friendId, tz);
	}

	@DeleteMapping("/friends/{friendId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Remove a friend")
	public void unfriend(CurrentUser me, @PathVariable UUID friendId) {
		friends.unfriend(me, friendId);
	}

	@GetMapping("/friends/{friendId}/records")
	@Operation(summary = "A friend's personal records in a range (always shared with friends)")
	public List<RecentRecordResponse> friendRecords(CurrentUser me, @PathVariable UUID friendId,
			@RequestParam(required = false) Instant from) {
		friends.requireFriends(me.id(), friendId);
		return stats.recentRecordsOf(friendId, from);
	}

	@GetMapping("/friends/{friendId}/workouts")
	@Operation(summary = "A friend's workout history (403 if they share PRs only)")
	public PageResponse<WorkoutSummaryResponse> friendWorkouts(CurrentUser me, @PathVariable UUID friendId,
			@RequestParam(required = false) String cursor, @RequestParam(required = false) Integer limit) {
		friends.requireWorkoutAccess(me.id(), friendId);
		return workouts.listForOwner(friendId, cursor, limit);
	}

	@GetMapping("/friends/{friendId}/workouts/{workoutId}")
	@Operation(summary = "One of a friend's workouts (403 if they share PRs only)")
	public WorkoutResponse friendWorkout(CurrentUser me, @PathVariable UUID friendId, @PathVariable UUID workoutId) {
		friends.requireWorkoutAccess(me.id(), friendId);
		return workouts.getForOwner(friendId, workoutId);
	}
}
