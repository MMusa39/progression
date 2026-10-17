package com.progression.workout;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import com.progression.exercise.Exercise;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/** One exercise performed within a workout, holding its ordered sets. */
@Entity
@Table(name = "workout_exercise")
public class WorkoutExercise {

	@Id
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "workout_id", nullable = false, updatable = false)
	private Workout workout;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "exercise_id", nullable = false)
	private Exercise exercise;

	@Column(nullable = false)
	private int position;

	private String notes;

	@Version
	private Long version;

	@OneToMany(mappedBy = "workoutExercise", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("position ASC")
	private List<ExerciseSet> sets = new ArrayList<>();

	protected WorkoutExercise() {
	}

	WorkoutExercise(UUID id, Workout workout) {
		this.id = id;
		this.workout = workout;
	}

	void update(Exercise exercise, int position, String notes) {
		this.exercise = exercise;
		this.position = position;
		this.notes = notes;
	}

	/** See {@link Workout#replaceExercises}: same orphan-removal reasoning. */
	void replaceSets(List<ExerciseSet> replacement) {
		sets.clear();
		sets.addAll(replacement);
	}

	public UUID getId() {
		return id;
	}

	public Workout getWorkout() {
		return workout;
	}

	public Exercise getExercise() {
		return exercise;
	}

	public int getPosition() {
		return position;
	}

	public String getNotes() {
		return notes;
	}

	public List<ExerciseSet> getSets() {
		return Collections.unmodifiableList(sets);
	}
}
