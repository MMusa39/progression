package com.progression.food;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class DiaryRepository {

	private static final String COLUMNS = """
			id, logged_on, meal, kind, food_id, recipe_id, name, amount::float8 AS amount, amount_unit,
			kcal::float8 AS kcal, protein_g::float8 AS protein, carbs_g::float8 AS carbs,
			fat_g::float8 AS fat, fiber_g::float8 AS fiber, created_at
			""";

	private final JdbcClient jdbc;

	DiaryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	record EntryRow(UUID id, LocalDate date, String meal, String kind, UUID foodId, UUID recipeId, String name,
			double amount, String amountUnit, Nutrients nutrients) {
	}

	/** Who owns an entry id, if it exists (to stop one user overwriting another's entry). */
	Optional<UUID> ownerOf(UUID entryId) {
		return jdbc.sql("SELECT user_id FROM food_log_entry WHERE id = :id").param("id", entryId).query(UUID.class).optional();
	}

	void upsert(UUID userId, EntryRow e) {
		jdbc.sql("""
				INSERT INTO food_log_entry (id, user_id, logged_on, meal, kind, food_id, recipe_id, name, amount, amount_unit,
				                            kcal, protein_g, carbs_g, fat_g, fiber_g)
				VALUES (:id, :userId, :date, :meal, :kind, :foodId, :recipeId, :name, :amount, :unit,
				        :kcal, :protein, :carbs, :fat, :fiber)
				ON CONFLICT (id) DO UPDATE SET
				    logged_on = EXCLUDED.logged_on, meal = EXCLUDED.meal, kind = EXCLUDED.kind, food_id = EXCLUDED.food_id,
				    recipe_id = EXCLUDED.recipe_id, name = EXCLUDED.name, amount = EXCLUDED.amount,
				    amount_unit = EXCLUDED.amount_unit, kcal = EXCLUDED.kcal, protein_g = EXCLUDED.protein_g,
				    carbs_g = EXCLUDED.carbs_g, fat_g = EXCLUDED.fat_g, fiber_g = EXCLUDED.fiber_g
				""")
				.param("id", e.id())
				.param("userId", userId)
				.param("date", e.date())
				.param("meal", e.meal())
				.param("kind", e.kind())
				.param("foodId", e.foodId())
				.param("recipeId", e.recipeId())
				.param("name", e.name())
				.param("amount", e.amount())
				.param("unit", e.amountUnit())
				.param("kcal", e.nutrients().kcal())
				.param("protein", e.nutrients().proteinG())
				.param("carbs", e.nutrients().carbsG())
				.param("fat", e.nutrients().fatG())
				.param("fiber", e.nutrients().fiberG())
				.update();
	}

	void delete(UUID userId, UUID entryId) {
		jdbc.sql("DELETE FROM food_log_entry WHERE id = :id AND user_id = :userId").param("id", entryId).param("userId", userId).update();
	}

	List<EntryRow> day(UUID userId, LocalDate date) {
		return jdbc.sql("SELECT " + COLUMNS + " FROM food_log_entry WHERE user_id = :userId AND logged_on = :date ORDER BY created_at, id")
				.param("userId", userId)
				.param("date", date)
				.query(DiaryRepository::map)
				.list();
	}

	/** Copies entries from one day (optionally one meal) to another, with new ids. Returns how many were copied. */
	int copy(UUID userId, LocalDate from, LocalDate to, String meal) {
		return jdbc.sql("""
				INSERT INTO food_log_entry (id, user_id, logged_on, meal, kind, food_id, recipe_id, name, amount, amount_unit,
				                            kcal, protein_g, carbs_g, fat_g, fiber_g)
				SELECT gen_random_uuid(), user_id, :to, meal, kind, food_id, recipe_id, name, amount, amount_unit,
				       kcal, protein_g, carbs_g, fat_g, fiber_g
				FROM food_log_entry
				WHERE user_id = :userId AND logged_on = :from AND (CAST(:meal AS text) IS NULL OR meal = :meal)
				ORDER BY created_at
				""")
				.param("userId", userId)
				.param("from", from)
				.param("to", to)
				.param("meal", meal)
				.update();
	}

	/** Most recently logged foods and recipes, one row per distinct item, with the amount used last time. */
	List<EntryRow> recentDistinct(UUID userId, int limit) {
		return jdbc.sql("""
				SELECT * FROM (
				    SELECT DISTINCT ON (coalesce(food_id, recipe_id)) """ + COLUMNS + """
				    FROM food_log_entry
				    WHERE user_id = :userId AND kind IN ('FOOD', 'RECIPE') AND coalesce(food_id, recipe_id) IS NOT NULL
				    ORDER BY coalesce(food_id, recipe_id), created_at DESC
				) latest
				ORDER BY created_at DESC
				LIMIT :limit
				""")
				.param("userId", userId)
				.param("limit", limit)
				.query(DiaryRepository::map)
				.list();
	}

	/** Total calories per day in [from, to], for days with anything logged. */
	Map<LocalDate, Double> dailyCalories(UUID userId, LocalDate from, LocalDate to) {
		return jdbc.sql("""
				SELECT logged_on, sum(kcal)::float8 AS kcal FROM food_log_entry
				WHERE user_id = :userId AND logged_on BETWEEN :from AND :to
				GROUP BY logged_on
				""")
				.param("userId", userId)
				.param("from", from)
				.param("to", to)
				.query((rs, n) -> Map.entry(rs.getObject("logged_on", LocalDate.class), rs.getDouble("kcal")))
				.list()
				.stream()
				.collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
	}

	int water(UUID userId, LocalDate date) {
		return jdbc.sql("SELECT ml FROM water_intake WHERE user_id = :userId AND logged_on = :date")
				.param("userId", userId).param("date", date).query(Integer.class).optional().orElse(0);
	}

	void setWater(UUID userId, LocalDate date, int ml) {
		jdbc.sql("""
				INSERT INTO water_intake (user_id, logged_on, ml) VALUES (:userId, :date, :ml)
				ON CONFLICT (user_id, logged_on) DO UPDATE SET ml = EXCLUDED.ml
				""")
				.param("userId", userId).param("date", date).param("ml", ml).update();
	}

	private static EntryRow map(ResultSet rs, int n) throws SQLException {
		return new EntryRow(
				rs.getObject("id", UUID.class),
				rs.getObject("logged_on", LocalDate.class),
				rs.getString("meal"),
				rs.getString("kind"),
				rs.getObject("food_id", UUID.class),
				rs.getObject("recipe_id", UUID.class),
				rs.getString("name"),
				rs.getDouble("amount"),
				rs.getString("amount_unit"),
				new Nutrients(rs.getDouble("kcal"), rs.getDouble("protein"), rs.getDouble("carbs"), rs.getDouble("fat"),
						rs.getDouble("fiber")));
	}
}
