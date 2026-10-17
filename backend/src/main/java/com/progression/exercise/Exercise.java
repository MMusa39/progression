package com.progression.exercise;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * An exercise definition such as "Bench Press". Either part of the built-in
 * catalog ({@code ownerId == null}, visible to everyone) or a custom exercise
 * created by, and visible only to, one user.
 */
@Entity
@Table(name = "exercise")
public class Exercise {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	/** Owning user's id, or {@code null} for catalog exercises. */
	@Column(updatable = false)
	private UUID ownerId;

	@Column(nullable = false)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private MuscleGroup muscleGroup;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Equipment equipment;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	protected Exercise() {
	}

	/** Creates a custom exercise owned by {@code ownerId}. */
	static Exercise custom(UUID ownerId, String name, MuscleGroup muscleGroup, Equipment equipment) {
		Exercise exercise = new Exercise();
		exercise.ownerId = ownerId;
		exercise.name = name;
		exercise.muscleGroup = muscleGroup;
		exercise.equipment = equipment;
		exercise.createdAt = Instant.now();
		return exercise;
	}

	public UUID getId() {
		return id;
	}

	public UUID getOwnerId() {
		return ownerId;
	}

	public String getName() {
		return name;
	}

	public MuscleGroup getMuscleGroup() {
		return muscleGroup;
	}

	public Equipment getEquipment() {
		return equipment;
	}

	public boolean isCustom() {
		return ownerId != null;
	}
}
