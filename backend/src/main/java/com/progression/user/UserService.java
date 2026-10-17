package com.progression.user;

import com.progression.common.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

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
		return user; // managed entity: changes are flushed when the transaction commits
	}
}
