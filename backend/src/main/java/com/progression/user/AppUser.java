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

	void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	void setWeightUnit(WeightUnit weightUnit) {
		this.weightUnit = weightUnit;
	}
}
