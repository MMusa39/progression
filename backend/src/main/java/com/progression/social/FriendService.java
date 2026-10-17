package com.progression.social;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.ForbiddenException;
import com.progression.common.error.NotFoundException;
import com.progression.social.SocialDtos.ConnectResponse;
import com.progression.social.SocialDtos.FriendRequestResponse;
import com.progression.social.SocialDtos.FriendRequestsResponse;
import com.progression.social.SocialDtos.FriendResponse;
import com.progression.social.SocialDtos.InvitePreviewResponse;
import com.progression.social.SocialDtos.UserSearchResult;
import com.progression.social.SocialDtos.UserSummary;
import com.progression.stats.Streaks;
import com.progression.user.AppUser;
import com.progression.user.CurrentUser;
import com.progression.user.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mutual friendships: requests, invites, the friends list, and the access rules
 * other features use before showing one user's data to another.
 *
 * <h2>Privacy rules</h2>
 * <ul>
 *   <li>Nothing is visible to someone who isn't an accepted friend. Non-friends get
 *       404, so the API never confirms what a stranger has logged.</li>
 *   <li>Friends always see personal records and consistency (streak, workouts).</li>
 *   <li>Individual workouts are visible only if the owner has {@code shareWorkouts} on.
 *       Otherwise friends get 403 with an explanation.</li>
 * </ul>
 */
@Service
public class FriendService {

	static final Duration RECENT_WINDOW = Duration.ofDays(28);
	private static final int SEARCH_LIMIT = 20;

	private final FriendshipRepository friendships;
	private final UserService users;
	private final SocialStatsRepository socialStats;
	private final Clock clock;

	FriendService(FriendshipRepository friendships, UserService users, SocialStatsRepository socialStats, Clock clock) {
		this.friendships = friendships;
		this.users = users;
		this.socialStats = socialStats;
		this.clock = clock;
	}

	// ------------------------------------------------------------------ finding people

	@Transactional(readOnly = true)
	public List<UserSearchResult> search(CurrentUser me, String query) {
		if (query == null || query.trim().replace("@", "").length() < 2) {
			return List.of();
		}
		Map<UUID, RelationshipStatus> relationships = relationships(me.id());
		return users.searchByUsername(query, me.id(), SEARCH_LIMIT).stream()
				.map(user -> new UserSearchResult(UserSummary.from(user),
						relationships.getOrDefault(user.getId(), RelationshipStatus.NONE)))
				.toList();
	}

	// ------------------------------------------------------------------ requests

	/**
	 * Sends a friend request to {@code @username}. If they had already asked the
	 * current user, this accepts their request instead. Repeating a request is a no-op.
	 */
	@Transactional
	public ConnectResponse sendRequest(CurrentUser me, String username) {
		requireUsername(me);
		AppUser target = users.findByUsername(username)
				.orElseThrow(() -> new NotFoundException("No one goes by @" + username.replace("@", "")));
		if (target.getId().equals(me.id())) {
			throw new BadRequestException("You can't add yourself as a friend.");
		}
		Friendship friendship = friendships.findBetween(me.id(), target.getId()).orElse(null);
		if (friendship == null) {
			friendships.save(Friendship.request(me.id(), target.getId(), clock.instant()));
			return new ConnectResponse(UserSummary.from(target), RelationshipStatus.REQUEST_SENT);
		}
		if (!friendship.isAccepted() && friendship.getAddresseeId().equals(me.id())) {
			friendship.accept(clock.instant()); // they asked first: sending back means yes
		}
		return new ConnectResponse(UserSummary.from(target), relationshipOf(friendship, me.id()));
	}

	@Transactional(readOnly = true)
	public FriendRequestsResponse requests(CurrentUser me) {
		List<Friendship> pending = friendships.findPending(me.id());
		Map<UUID, AppUser> people = usersById(pending.stream().map(f -> f.otherThan(me.id())).toList());
		List<FriendRequestResponse> incoming = new ArrayList<>();
		List<FriendRequestResponse> outgoing = new ArrayList<>();
		for (Friendship f : pending) {
			AppUser other = people.get(f.otherThan(me.id()));
			if (other == null) {
				continue;
			}
			var response = new FriendRequestResponse(f.getId(), UserSummary.from(other), f.getCreatedAt());
			(f.getAddresseeId().equals(me.id()) ? incoming : outgoing).add(response);
		}
		return new FriendRequestsResponse(incoming, outgoing);
	}

	@Transactional
	public ConnectResponse accept(CurrentUser me, UUID requestId) {
		requireUsername(me);
		Friendship friendship = friendships.findById(requestId)
				.filter(f -> f.getAddresseeId().equals(me.id()) && !f.isAccepted())
				.orElseThrow(() -> new NotFoundException("Friend request not found"));
		friendship.accept(clock.instant());
		AppUser requester = users.findById(friendship.getRequesterId()).orElseThrow();
		return new ConnectResponse(UserSummary.from(requester), RelationshipStatus.FRIENDS);
	}

	/** Declines an incoming request or cancels an outgoing one. Idempotent. */
	@Transactional
	public void removeRequest(CurrentUser me, UUID requestId) {
		friendships.findById(requestId)
				.filter(f -> !f.isAccepted())
				.filter(f -> f.getRequesterId().equals(me.id()) || f.getAddresseeId().equals(me.id()))
				.ifPresent(friendships::delete);
	}

	/** Ends a friendship. Idempotent. */
	@Transactional
	public void unfriend(CurrentUser me, UUID friendId) {
		friendships.findBetween(me.id(), friendId).filter(Friendship::isAccepted).ifPresent(friendships::delete);
	}

	// ------------------------------------------------------------------ invite links

	@Transactional
	public SocialDtos.InviteResponse invite(CurrentUser me) {
		return new SocialDtos.InviteResponse(users.inviteCode(me.id()));
	}

	@Transactional
	public SocialDtos.InviteResponse resetInvite(CurrentUser me) {
		return new SocialDtos.InviteResponse(users.resetInviteCode(me.id()));
	}

	@Transactional(readOnly = true)
	public InvitePreviewResponse previewInvite(CurrentUser me, String code) {
		AppUser owner = inviteOwner(code);
		RelationshipStatus status = owner.getId().equals(me.id()) ? RelationshipStatus.NONE
				: relationships(me.id()).getOrDefault(owner.getId(), RelationshipStatus.NONE);
		return new InvitePreviewResponse(UserSummary.from(owner), status);
	}

	/**
	 * Uses someone's invite link. Sharing the link is the owner's consent, so
	 * this connects the two users immediately, with no request to accept.
	 */
	@Transactional
	public ConnectResponse acceptInvite(CurrentUser me, String code) {
		requireUsername(me);
		AppUser owner = inviteOwner(code);
		if (owner.getId().equals(me.id())) {
			throw new BadRequestException("That's your own invite link. Share it with a friend.");
		}
		Instant now = clock.instant();
		Friendship friendship = friendships.findBetween(me.id(), owner.getId())
				.orElseGet(() -> friendships.save(Friendship.request(owner.getId(), me.id(), now)));
		friendship.accept(now);
		return new ConnectResponse(UserSummary.from(owner), RelationshipStatus.FRIENDS);
	}

	private AppUser inviteOwner(String code) {
		return users.findByInviteCode(code)
				.orElseThrow(() -> new NotFoundException("This invite link isn't valid anymore. Ask your friend for a new one."));
	}

	// ------------------------------------------------------------------ friends

	@Transactional(readOnly = true)
	public List<FriendResponse> friends(CurrentUser me, String zoneId) {
		List<Friendship> accepted = friendships.findAccepted(me.id());
		Map<UUID, Instant> since = accepted.stream()
				.collect(Collectors.toMap(f -> f.otherThan(me.id()), f -> f.getAcceptedAt() != null ? f.getAcceptedAt() : f.getCreatedAt()));
		return describe(since, zoneId).stream()
				.sorted(Comparator.comparing((FriendResponse f) -> f.user().username(), Comparator.nullsLast(Comparator.naturalOrder())))
				.toList();
	}

	@Transactional(readOnly = true)
	public FriendResponse friend(CurrentUser me, UUID friendId, String zoneId) {
		Friendship friendship = requireFriendship(me.id(), friendId);
		Instant since = friendship.getAcceptedAt() != null ? friendship.getAcceptedAt() : friendship.getCreatedAt();
		return describe(Map.of(friendId, since), zoneId).stream().findFirst()
				.orElseThrow(() -> new NotFoundException("Friend not found"));
	}

	private List<FriendResponse> describe(Map<UUID, Instant> friendsSince, String zoneId) {
		if (friendsSince.isEmpty()) {
			return List.of();
		}
		ZoneId zone = parseZone(zoneId);
		Instant now = clock.instant();
		Map<UUID, SocialStatsRepository.Activity> activity = socialStats
				.activity(friendsSince.keySet(), zone.getId(), now.minus(RECENT_WINDOW)).stream()
				.collect(Collectors.toMap(SocialStatsRepository.Activity::userId, Function.identity()));
		LocalDate today = LocalDate.now(clock.withZone(zone));

		return users.findAllById(friendsSince.keySet()).stream()
				.map(user -> {
					var a = activity.get(user.getId());
					return new FriendResponse(
							UserSummary.from(user),
							friendsSince.get(user.getId()),
							user.isShareWorkouts(),
							a == null ? 0 : Streaks.currentStreakWeeks(a.activeWeeks(), today),
							a == null ? 0 : a.workoutsSince(),
							a == null ? null : a.lastWorkoutAt());
				})
				.toList();
	}

	// ------------------------------------------------------------------ access rules for other features

	/** Ids of the user's accepted friends. */
	@Transactional(readOnly = true)
	public List<UUID> friendIds(UUID userId) {
		return friendships.findAccepted(userId).stream().map(f -> f.otherThan(userId)).toList();
	}

	/** 404 unless the two users are friends. */
	@Transactional(readOnly = true)
	public void requireFriends(UUID me, UUID other) {
		requireFriendship(me, other);
	}

	/** 404 unless friends; 403 if the friend shares PRs only. */
	@Transactional(readOnly = true)
	public void requireWorkoutAccess(UUID me, UUID friendId) {
		requireFriendship(me, friendId);
		AppUser friend = users.findById(friendId).orElseThrow(() -> new NotFoundException("Friend not found"));
		if (!friend.isShareWorkouts()) {
			throw new ForbiddenException("@" + friend.getUsername() + " shares personal records only, not workouts.");
		}
	}

	private Friendship requireFriendship(UUID me, UUID other) {
		return friendships.findBetween(me, other)
				.filter(Friendship::isAccepted)
				.orElseThrow(() -> new NotFoundException("Friend not found"));
	}

	// ------------------------------------------------------------------ helpers

	private Map<UUID, RelationshipStatus> relationships(UUID me) {
		Map<UUID, RelationshipStatus> result = new HashMap<>();
		friendships.findAccepted(me).forEach(f -> result.put(f.otherThan(me), RelationshipStatus.FRIENDS));
		friendships.findPending(me).forEach(f -> result.put(f.otherThan(me), relationshipOf(f, me)));
		return result;
	}

	private static RelationshipStatus relationshipOf(Friendship f, UUID me) {
		if (f.isAccepted()) {
			return RelationshipStatus.FRIENDS;
		}
		return f.getRequesterId().equals(me) ? RelationshipStatus.REQUEST_SENT : RelationshipStatus.REQUEST_RECEIVED;
	}

	private Map<UUID, AppUser> usersById(List<UUID> ids) {
		return users.findAllById(ids).stream().collect(Collectors.toMap(AppUser::getId, Function.identity()));
	}

	/** Friends find each other by @username, so it must be set before connecting. */
	private void requireUsername(CurrentUser me) {
		AppUser user = users.findById(me.id()).orElseThrow(() -> new NotFoundException("User not found"));
		if (user.getUsername() == null) {
			throw new BadRequestException("Choose a username first, so friends can find you.");
		}
	}

	static ZoneId parseZone(String zoneId) {
		if (zoneId == null || zoneId.isBlank()) {
			return ZoneId.of("UTC");
		}
		try {
			return ZoneId.of(zoneId);
		}
		catch (DateTimeException ex) {
			throw new BadRequestException("Unknown time zone: " + zoneId);
		}
	}
}
