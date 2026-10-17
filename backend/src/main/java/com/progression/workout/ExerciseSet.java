package com.progression.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.progression.common.WeightUnit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * A single set: {@code weight × reps}. The database also keeps a generated
 * {@code weight_kg} column, used by the analytics queries; it isn't mapped here.
 */
@Entity
@Table(name = "exercise_set")
public class ExerciseSet {

	@Id
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "workout_exercise_id", nullable = false, updatable = false)
	private WorkoutExercise workoutExercise;

	@Column(nullable = false)
	private int position;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private SetType setType;

	@Column(nullable = false, precision = 7, scale = 2)
	private BigDecimal weight;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private WeightUnit weightUnit;

	@Column(nullable = false)
	private int reps;

	@Column(precision = 3, scale = 1)
	private BigDecimal rpe;

	private Instant completedAt;

	@Version
	private Long version;

	protected ExerciseSet() {
	}

	ExerciseSet(UUID id, WorkoutExercise workoutExercise) {
		this.id = id;
		this.workoutExercise = workoutExercise;
	}

	void update(int position, SetType setType, BigDecimal weight, WeightUnit weightUnit, int reps, BigDecimal rpe,
			Instant completedAt) {
		this.position = position;
		this.setType = setType;
		this.weight = weight;
		this.weightUnit = weightUnit;
		this.reps = reps;
		this.rpe = rpe;
		this.completedAt = completedAt;
	}

	public UUID getId() {
		return id;
	}

	public WorkoutExercise getWorkoutExercise() {
		return workoutExercise;
	}

	public int getPosition() {
		return position;
	}

	public SetType getSetType() {
		return setType;
	}

	public BigDecimal getWeight() {
		return weight;
	}

	public WeightUnit getWeightUnit() {
		return weightUnit;
	}

	public int getReps() {
		return reps;
	}

	public BigDecimal getRpe() {
		return rpe;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}
}
