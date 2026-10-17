package com.progression.nutrition;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class NutritionProfileRepository {

	private final JdbcClient jdbc;

	NutritionProfileRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** {@code customMacros} is null when targets are calculated. */
	record ProfileRow(Sex sex, int birthYear, double heightCm, ActivityLevel activity, double goalWeightKg,
			LocalDate goalDate, boolean adaptive, TargetCalculator.CustomMacros customMacros) {
	}

	Optional<ProfileRow> find(UUID userId) {
		return jdbc.sql("""
				SELECT sex, birth_year, height_cm::float8 AS height_cm, activity_level,
				       goal_weight_kg::float8 AS goal_weight_kg, goal_date, adaptive,
				       custom_protein_g, custom_carbs_g, custom_fat_g
				FROM nutrition_profile WHERE user_id = :userId
				""")
				.param("userId", userId)
				.query((rs, n) -> new ProfileRow(
						Sex.valueOf(rs.getString("sex")),
						rs.getInt("birth_year"),
						rs.getDouble("height_cm"),
						ActivityLevel.valueOf(rs.getString("activity_level")),
						rs.getDouble("goal_weight_kg"),
						rs.getObject("goal_date", LocalDate.class),
						rs.getBoolean("adaptive"),
						rs.getObject("custom_protein_g") == null ? null : new TargetCalculator.CustomMacros(
								rs.getInt("custom_protein_g"), rs.getInt("custom_carbs_g"), rs.getInt("custom_fat_g"))))
				.optional();
	}

	void upsert(UUID userId, ProfileRow p) {
		jdbc.sql("""
				INSERT INTO nutrition_profile (user_id, sex, birth_year, height_cm, activity_level, goal_weight_kg, goal_date, adaptive,
				                               custom_protein_g, custom_carbs_g, custom_fat_g)
				VALUES (:userId, :sex, :birthYear, :heightCm, :activity, :goalKg, :goalDate, :adaptive, :protein, :carbs, :fat)
				ON CONFLICT (user_id) DO UPDATE SET
				    sex = EXCLUDED.sex, birth_year = EXCLUDED.birth_year, height_cm = EXCLUDED.height_cm,
				    activity_level = EXCLUDED.activity_level, goal_weight_kg = EXCLUDED.goal_weight_kg,
				    goal_date = EXCLUDED.goal_date, adaptive = EXCLUDED.adaptive, custom_protein_g = EXCLUDED.custom_protein_g,
				    custom_carbs_g = EXCLUDED.custom_carbs_g, custom_fat_g = EXCLUDED.custom_fat_g, updated_at = now()
				""")
				.param("userId", userId)
				.param("sex", p.sex().name())
				.param("birthYear", p.birthYear())
				.param("heightCm", p.heightCm())
				.param("activity", p.activity().name())
				.param("goalKg", p.goalWeightKg())
				.param("goalDate", p.goalDate())
				.param("adaptive", p.adaptive())
				.param("protein", p.customMacros() == null ? null : p.customMacros().proteinG())
				.param("carbs", p.customMacros() == null ? null : p.customMacros().carbsG())
				.param("fat", p.customMacros() == null ? null : p.customMacros().fatG())
				.update();
	}
}
