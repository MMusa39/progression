package com.progression.user;

import java.security.SecureRandom;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.ConflictException;
import com.progression.common.error.NotFoundException;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

	/** Same rule as the database check constraint {@code app_user_username_format}. */
	private static final Pattern USERNAME = Pattern.compile("^[a-z0-9_.]{3,20}$");

	/** Invite-code alphabet without look-alike characters (0/O, 1/I/L). */
	private static final char[] CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();
	private static final int CODE_LENGTH = 8;
	private static final SecureRandom RANDOM = new SecureRandom();

	private final AppUserRepository users;

	UserService(AppUserRepository users) {
		this.users = users;
	}

	/**
	 * Returns the user for an identity-provider subject, creating them on their
	 * first request ("just-in-time provisioning"). The common case, a returning
	 * user, costs a single indexed lookup.
	 */
	@Transactional
	public AppUser provision(String subject, String email) {
		return users.findBySubject(subject).orElseGet(() -> {
			users.insertIfAbsent(subject, email);
			return users.findBySubject(subject).orElseThrow();
		});
	}

	@Transactional(readOnly = true)
	public AppUser get(CurrentUser currentUser) {
		return users.findById(currentUser.id())
				.orElseThrow(() -> new NotFoundException("User not found"));
	}

	/** Applies a partial update: only fields present in the request change. */
	@Transactional
	public AppUser update(CurrentUser currentUser, UpdateUserRequest request) {
		AppUser user = get(currentUser);
		if (request.displayName() != null) {
			String trimmed = request.displayName().trim();
			user.setDisplayName(trimmed.isEmpty() ? null : trimmed);
		}
		if (request.weightUnit() != null) {
			user.setWeightUnit(request.weightUnit());
		}
		if (request.shareWorkouts() != null) {
			user.setShareWorkouts(request.shareWorkouts());
		}
		if (request.notifyFriendRequests() != null) {
			user.setNotifyFriendRequests(request.notifyFriendRequests());
		}
		if (request.notifyFriendPrs() != null) {
			user.setNotifyFriendPrs(request.notifyFriendPrs());
		}
		if (request.username() != null) {
			String username = normalizeUsername(request.username());
			if (!USERNAME.matcher(username).matches()) {
				throw new BadRequestException("Usernames are 3–20 characters: letters, numbers, underscores and dots.");
			}
			users.findByUsername(username)
					.filter(other -> !other.getId().equals(user.getId()))
					.ifPresent(other -> {
						throw new ConflictException("@" + username + " is taken. Try another username.");
					});
			user.setUsername(username);
		}
		return user; // managed entity: changes are flushed when the transaction commits
	}

	// ------------------------------------------------------------------ lookups for the social features

	@Transactional(readOnly = true)
	public Optional<AppUser> findByUsername(String username) {
		return users.findByUsername(normalizeUsername(username));
	}

	@Transactional(readOnly = true)
	public Optional<AppUser> findById(UUID id) {
		return users.findById(id);
	}

	@Transactional(readOnly = true)
	public List<AppUser> findAllById(Collection<UUID> ids) {
		return users.findAllById(ids);
	}

	/** Prefix search on usernames, excluding the searcher. */
	@Transactional(readOnly = true)
	public List<AppUser> searchByUsername(String query, UUID excludeId, int limit) {
		String prefix = normalizeUsername(query)
				.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
		return users.searchByUsernamePrefix(prefix, excludeId, Limit.of(limit));
	}

	// ------------------------------------------------------------------ invite links

	/** The user's invite code, created on first use. */
	@Transactional
	public String inviteCode(UUID userId) {
		AppUser user = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
		if (user.getInviteCode() == null) {
			user.setInviteCode(newInviteCode());
		}
		return user.getInviteCode();
	}

	/** Replaces the user's invite code, so previously shared links stop working. */
	@Transactional
	public String resetInviteCode(UUID userId) {
		AppUser user = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
		user.setInviteCode(newInviteCode());
		return user.getInviteCode();
	}

	@Transactional(readOnly = true)
	public Optional<AppUser> findByInviteCode(String code) {
		return users.findByInviteCode(code.trim().toUpperCase(Locale.ROOT));
	}

	private String newInviteCode() {
		String code;
		do {
			StringBuilder builder = new StringBuilder(CODE_LENGTH);
			for (int i = 0; i < CODE_LENGTH; i++) {
				builder.append(CODE_ALPHABET[RANDOM.nextInt(CODE_ALPHABET.length)]);
			}
			code = builder.toString();
		}
		while (users.existsByInviteCode(code)); // 31^8 ≈ 850 billion codes: collisions are vanishingly rare
		return code;
	}

	/** "@Mike_Lifts " → "mike_lifts". */
	static String normalizeUsername(String username) {
		String trimmed = username.trim().toLowerCase(Locale.ROOT);
		return trimmed.startsWith("@") ? trimmed.substring(1) : trimmed;
	}
}
