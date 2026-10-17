package com.progression.user;

import java.time.Instant;
import java.util.UUID;

import com.progression.common.WeightUnit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A Progression user. Identity (sign-up, passwords, MFA) lives in the identity
 * provider; this row only links the provider's subject id to app data and
 * stores app preferences.
 */
@Entity
@Table(name = "app_user")
public class AppUser {

	@Id
	private UUID id;

	/** The {@code sub} claim of the user's access token. Unique and never changes. */
	@Column(name = "cognito_sub", nullable = false, updatable = false)
	private String subject;

	private String email;

	private String displayName;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private WeightUnit weightUnit;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	/** Unique lowercase handle, shown as @username. {@code null} until the user picks one. */
	private String username;

	/** Whether friends may see individual workouts. PRs are always shared with friends. */
	@Column(nullable = false)
	private boolean shareWorkouts = true;

	/** Secret part of the user's invite link; {@code null} until first requested. */
	private String inviteCode;

	/** Push when someone sends or accepts a friend request. */
	@Column(nullable = false)
	private boolean notifyFriendRequests = true;

	/** Push when a friend sets a personal record. */
	@Column(nullable = false)
	private boolean notifyFriendPrs = true;

	/** Required by JPA. Users are created with {@link AppUserRepository#insertIfAbsent}. */
	protected AppUser() {
	}

	public UUID getId() {
		return id;
	}

	public String getSubject() {
		return subject;
	}

	public String getEmail() {
		return email;
	}

	public String getDisplayName() {
		return displayName;
	}

	public WeightUnit getWeightUnit() {
		return weightUnit;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public String getUsername() {
		return username;
	}

	public boolean isShareWorkouts() {
		return shareWorkouts;
	}

	public String getInviteCode() {
		return inviteCode;
	}

	public boolean isNotifyFriendRequests() {
		return notifyFriendRequests;
	}

	public boolean isNotifyFriendPrs() {
		return notifyFriendPrs;
	}

	void setNotifyFriendRequests(boolean notifyFriendRequests) {
		this.notifyFriendRequests = notifyFriendRequests;
	}

	void setNotifyFriendPrs(boolean notifyFriendPrs) {
		this.notifyFriendPrs = notifyFriendPrs;
	}

	/** Name to show other people: display name, else @username. */
	public String publicName() {
		if (displayName != null && !displayName.isBlank()) {
			return displayName;
		}
		return username != null ? "@" + username : "A friend";
	}

	void setUsername(String username) {
		this.username = username;
	}

	void setShareWorkouts(boolean shareWorkouts) {
		this.shareWorkouts = shareWorkouts;
	}

	void setInviteCode(String inviteCode) {
		this.inviteCode = inviteCode;
	}

	void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	void setWeightUnit(WeightUnit weightUnit) {
		this.weightUnit = weightUnit;
	}
}
