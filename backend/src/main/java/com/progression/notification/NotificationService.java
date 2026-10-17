package com.progression.notification;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;

import com.progression.social.FriendEvents;
import com.progression.social.FriendService;
import com.progression.stats.PersonalRecordResponse;
import com.progression.stats.RecordType;
import com.progression.stats.StatsService;
import com.progression.user.AppUser;
import com.progression.user.UserService;
import com.progression.workout.WorkoutSavedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Turns domain events into push notifications.
 *
 * <ul>
 *   <li><b>After commit:</b> listeners run only once the triggering transaction
 *       has committed, so nobody is notified about something that was rolled back.</li>
 *   <li><b>Async:</b> sending happens off the request thread, so the user's
 *       request never waits on Expo.</li>
 *   <li><b>Respects preferences:</b> each recipient's toggles are checked per notification type.</li>
 * </ul>
 */
@Service
public class NotificationService {

	private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

	/** Back-filled or edited old workouts don't notify friends. */
	static final Duration PR_NOTIFICATION_WINDOW = Duration.ofHours(48);

	private final PushTokenRepository tokens;
	private final PushSender sender;
	private final UserService users;
	private final FriendService friends;
	private final StatsService stats;
	private final Clock clock;

	NotificationService(PushTokenRepository tokens, PushSender sender, UserService users, FriendService friends,
			StatsService stats, Clock clock) {
		this.tokens = tokens;
		this.sender = sender;
		this.users = users;
		this.friends = friends;
		this.stats = stats;
		this.clock = clock;
	}

	@Async
	@TransactionalEventListener(fallbackExecution = true)
	public void onFriendRequest(FriendEvents.RequestSent event) {
		AppUser requester = users.findById(event.requesterId()).orElse(null);
		if (requester == null) {
			return;
		}
		notify(List.of(event.addresseeId()), AppUser::isNotifyFriendRequests,
				"New friend request",
				requester.publicName() + " wants to be friends. Compare streaks and PRs.",
				Map.of("type", "friend_request", "path", "/friends"));
	}

	@Async
	@TransactionalEventListener(fallbackExecution = true)
	public void onFriendAccepted(FriendEvents.RequestAccepted event) {
		AppUser accepter = users.findById(event.accepterId()).orElse(null);
		if (accepter == null) {
			return;
		}
		notify(List.of(event.requesterId()), AppUser::isNotifyFriendRequests,
				"You're now friends with " + accepter.publicName(),
				"See how your streaks compare on the leaderboard.",
				Map.of("type", "friend_accepted", "path", "/friends/" + event.accepterId()));
	}

	/**
	 * When someone saves a new, recent workout that set personal records,
	 * tells their friends once: "Sam set a new PR: Bench Press · 225 lb × 3".
	 * Edits and retries of the same workout don't notify again ({@code created} is false).
	 */
	@Async
	@TransactionalEventListener(fallbackExecution = true)
	public void onWorkoutSaved(WorkoutSavedEvent event) {
		if (!event.created() || event.startedAt().isBefore(clock.instant().minus(PR_NOTIFICATION_WINDOW))) {
			return;
		}
		List<PersonalRecordResponse> records = stats.workoutRecordsOf(event.userId(), event.workoutId());
		if (records.isEmpty()) {
			return;
		}
		List<UUID> friendIds = friends.friendIds(event.userId());
		AppUser lifter = users.findById(event.userId()).orElse(null);
		if (friendIds.isEmpty() || lifter == null) {
			return;
		}
		notify(friendIds, AppUser::isNotifyFriendPrs,
				lifter.publicName() + " set a new PR",
				describe(records),
				Map.of("type", "friend_pr", "path", "/friends/" + event.userId()));
	}

	/** "Bench Press · 225 lb × 3", plus "and 2 more lifts" when several lifts set records. */
	static String describe(List<PersonalRecordResponse> records) {
		PersonalRecordResponse headline = records.stream()
				.filter(r -> r.type() == RecordType.HEAVIEST_WEIGHT)
				.findFirst()
				.orElse(records.getFirst());
		String set = headline.weight() != null
				? " · " + plain(headline.weight()) + " " + headline.weightUnit().name().toLowerCase() + " × " + headline.reps()
				: "";
		long otherLifts = records.stream().map(PersonalRecordResponse::exerciseId).distinct().count() - 1;
		return headline.exerciseName() + set + (otherLifts > 0 ? " and " + otherLifts + " more lift" + (otherLifts > 1 ? "s" : "") : "");
	}

	private static String plain(BigDecimal weight) {
		return weight.stripTrailingZeros().toPlainString();
	}

	private void notify(Collection<UUID> recipientIds, Predicate<AppUser> wantsIt, String title, String body,
			Map<String, Object> data) {
		List<UUID> willing = users.findAllById(recipientIds).stream().filter(wantsIt).map(AppUser::getId).toList();
		List<PushMessage> messages = tokens.devicesOf(willing).stream()
				.map(device -> new PushMessage(device.token(), title, body, data))
				.toList();
		if (messages.isEmpty()) {
			return;
		}
		List<String> dead = sender.send(messages);
		if (!dead.isEmpty()) {
			tokens.deleteTokens(dead);
			log.info("Removed {} unregistered push token(s)", dead.size());
		}
	}
}
