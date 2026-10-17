package com.progression.social;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

	/** The row linking two users, in whichever direction it was created. */
	@Query("""
			select f from Friendship f
			where (f.requesterId = :a and f.addresseeId = :b) or (f.requesterId = :b and f.addresseeId = :a)
			""")
	Optional<Friendship> findBetween(UUID a, UUID b);

	@Query("""
			select f from Friendship f
			where f.status = com.progression.social.FriendshipStatus.ACCEPTED
			  and (f.requesterId = :userId or f.addresseeId = :userId)
			""")
	List<Friendship> findAccepted(UUID userId);

	@Query("""
			select f from Friendship f
			where (f.requesterId = :userId or f.addresseeId = :userId)
			  and f.status = com.progression.social.FriendshipStatus.PENDING
			order by f.createdAt desc
			""")
	List<Friendship> findPending(UUID userId);
}
