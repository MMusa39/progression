package com.progression.account;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The user's rights over their own data: take a full copy of it, or delete it.
 * Both are App Store requirements (account deletion) and good practice (export).
 */
@Service
public class AccountService {

	private static final Logger log = LoggerFactory.getLogger(AccountService.class);

	private final JdbcClient jdbc;

	AccountService(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * Permanently deletes the user and everything they own. Every user table
	 * references {@code app_user} with {@code ON DELETE CASCADE}. Recipes and
	 * workouts go first: they reference the user's custom foods and exercises,
	 * and PostgreSQL checks those references as each cascaded row is deleted, so
	 * the order within a single cascading statement isn't guaranteed to work.
	 * Friends' saved copies of shared recipes are theirs and stay.
	 */
	@Transactional
	public void delete(UUID userId) {
		jdbc.sql("DELETE FROM recipe WHERE owner_id = :id").param("id", userId).update();
		jdbc.sql("DELETE FROM workout WHERE user_id = :id").param("id", userId).update();
		int rows = jdbc.sql("DELETE FROM app_user WHERE id = :id").param("id", userId).update();
		if (rows > 0) {
			log.info("Deleted account {}", userId);
		}
	}

	/**
	 * Everything the user has stored, as one JSON document, built by PostgreSQL
	 * ({@code jsonb_build_object} / {@code jsonb_agg}) so it stays in step with the
	 * schema without a mapping layer. Internal ids that mean nothing outside the
	 * app (identity-provider subject, invite code, version counters) are left out.
	 */
	@Transactional(readOnly = true)
	public String export(UUID userId) {
		return jdbc.sql(EXPORT_SQL).param("id", userId).query(String.class).single();
	}

	private static final String EXPORT_SQL = """
			SELECT jsonb_build_object(
			  'format', 'progression-export-v1',
			  'exportedAt', now(),
			  'account', (SELECT to_jsonb(u) - 'cognito_sub' - 'invite_code' FROM app_user u WHERE u.id = :id),
			  'workouts', coalesce((
			    SELECT jsonb_agg(jsonb_build_object(
			      'id', w.id, 'name', w.name, 'startedAt', w.started_at, 'endedAt', w.ended_at, 'notes', w.notes,
			      'exercises', (
			        SELECT coalesce(jsonb_agg(jsonb_build_object(
			          'exercise', e.name, 'notes', we.notes,
			          'sets', (
			            SELECT coalesce(jsonb_agg(jsonb_build_object(
			              'type', s.set_type, 'weight', s.weight, 'unit', s.weight_unit, 'reps', s.reps, 'rpe', s.rpe,
			              'completedAt', s.completed_at) ORDER BY s.position), '[]'::jsonb)
			            FROM exercise_set s WHERE s.workout_exercise_id = we.id)
			        ) ORDER BY we.position), '[]'::jsonb)
			        FROM workout_exercise we JOIN exercise e ON e.id = we.exercise_id WHERE we.workout_id = w.id)
			    ) ORDER BY w.started_at)
			    FROM workout w WHERE w.user_id = :id), '[]'::jsonb),
			  'customExercises', coalesce((
			    SELECT jsonb_agg(jsonb_build_object('name', name, 'muscleGroup', muscle_group, 'equipment', equipment) ORDER BY name)
			    FROM exercise WHERE owner_id = :id), '[]'::jsonb),
			  'bodyWeights', coalesce((
			    SELECT jsonb_agg(jsonb_build_object('date', measured_on, 'weight', weight, 'unit', weight_unit) ORDER BY measured_on)
			    FROM body_weight_entry WHERE user_id = :id), '[]'::jsonb),
			  'nutritionProfile', (SELECT to_jsonb(p) - 'user_id' FROM nutrition_profile p WHERE p.user_id = :id),
			  'customFoods', coalesce((
			    SELECT jsonb_agg(to_jsonb(f) - 'owner_id' - 'source' ORDER BY f.name)
			    FROM food f WHERE f.owner_id = :id), '[]'::jsonb),
			  'recipes', coalesce((
			    SELECT jsonb_agg(jsonb_build_object(
			      'name', r.name, 'servings', r.servings, 'shared', r.shared,
			      'ingredients', (
			        SELECT coalesce(jsonb_agg(jsonb_build_object('food', f.name, 'grams', i.grams) ORDER BY i.position), '[]'::jsonb)
			        FROM recipe_ingredient i JOIN food f ON f.id = i.food_id WHERE i.recipe_id = r.id)
			    ) ORDER BY r.name)
			    FROM recipe r WHERE r.owner_id = :id), '[]'::jsonb),
			  'foodDiary', coalesce((
			    SELECT jsonb_agg(jsonb_build_object(
			      'date', logged_on, 'meal', meal, 'name', name, 'amount', amount, 'unit', amount_unit,
			      'kcal', kcal, 'proteinG', protein_g, 'carbsG', carbs_g, 'fatG', fat_g, 'fiberG', fiber_g
			    ) ORDER BY logged_on, created_at)
			    FROM food_log_entry WHERE user_id = :id), '[]'::jsonb),
			  'water', coalesce((
			    SELECT jsonb_agg(jsonb_build_object('date', logged_on, 'ml', ml) ORDER BY logged_on)
			    FROM water_intake WHERE user_id = :id), '[]'::jsonb),
			  'friends', coalesce((
			    SELECT jsonb_agg(jsonb_build_object('username', u.username, 'since', f.accepted_at) ORDER BY u.username)
			    FROM friendship f
			    JOIN app_user u ON u.id = CASE WHEN f.requester_id = :id THEN f.addressee_id ELSE f.requester_id END
			    WHERE (f.requester_id = :id OR f.addressee_id = :id) AND f.status = 'ACCEPTED'), '[]'::jsonb)
			)::text
			""";
}
