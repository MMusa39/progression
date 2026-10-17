package com.progression.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface AppUserRepository extends JpaRepository<AppUser, UUID> {

	Optional<AppUser> findBySubject(String subject);

	/**
	 * Creates the user row if none exists for this subject. Race-safe: if two
	 * first requests from a new user arrive at the same time, {@code ON CONFLICT DO
	 * NOTHING} lets exactly one insert succeed and the other becomes a no-op,
	 * instead of failing on the unique constraint.
	 */
	@Modifying
	@Query(value = """
			INSERT INTO app_user (cognito_sub, email)
			VALUES (:subject, :email)
			ON CONFLICT (cognito_sub) DO NOTHING
			""", nativeQuery = true)
	void insertIfAbsent(String subject, String email);
}
