package com.progression.food;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Foods visible to a user: the shared Open Food Facts cache plus their own custom foods. */
@Repository
class FoodRepository {

	private static final String COLUMNS = """
			id, owner_id, barcode, name, brand, serving_g::float8 AS serving_g, serving_label,
			kcal_100g::float8 AS kcal, protein_100g::float8 AS protein, carbs_100g::float8 AS carbs,
			fat_100g::float8 AS fat, fiber_100g::float8 AS fiber
			""";

	private final JdbcClient jdbc;

	FoodRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	record FoodRow(UUID id, UUID ownerId, String barcode, String name, String brand, Double servingG,
			String servingLabel, Nutrients per100g) {

		boolean custom() {
			return ownerId != null;
		}
	}

	Optional<FoodRow> findVisible(UUID userId, UUID foodId) {
		return jdbc.sql("SELECT " + COLUMNS + " FROM food WHERE id = :id AND (owner_id IS NULL OR owner_id = :userId)")
				.param("id", foodId)
				.param("userId", userId)
				.query(FoodRepository::map)
				.optional();
	}

	List<FoodRow> findVisible(UUID userId, Collection<UUID> ids) {
		if (ids.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("SELECT " + COLUMNS + " FROM food WHERE id IN (:ids) AND (owner_id IS NULL OR owner_id = :userId)")
				.param("ids", ids)
				.param("userId", userId)
				.query(FoodRepository::map)
				.list();
	}

	/** The user's own food with this barcode first (they may have corrected a product), else the shared one. */
	Optional<FoodRow> findByBarcode(UUID userId, String barcode) {
		return jdbc.sql("SELECT " + COLUMNS + """
				 FROM food
				WHERE barcode = :barcode AND (owner_id = :userId OR source = 'OPEN_FOOD_FACTS')
				ORDER BY owner_id NULLS LAST
				LIMIT 1
				""")
				.param("barcode", barcode)
				.param("userId", userId)
				.query(FoodRepository::map)
				.optional();
	}

	/** Caches an Open Food Facts product (insert or refresh by barcode) and returns its id. */
	UUID upsertExternal(ExternalFood food) {
		return jdbc.sql("""
				INSERT INTO food (source, barcode, name, brand, serving_g, serving_label,
				                  kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g)
				VALUES ('OPEN_FOOD_FACTS', :barcode, :name, :brand, :servingG, :servingLabel,
				        :kcal, :protein, :carbs, :fat, :fiber)
				ON CONFLICT (barcode) WHERE source = 'OPEN_FOOD_FACTS' DO UPDATE
				    SET name = EXCLUDED.name, brand = EXCLUDED.brand, serving_g = EXCLUDED.serving_g,
				        serving_label = EXCLUDED.serving_label, kcal_100g = EXCLUDED.kcal_100g,
				        protein_100g = EXCLUDED.protein_100g, carbs_100g = EXCLUDED.carbs_100g,
				        fat_100g = EXCLUDED.fat_100g, fiber_100g = EXCLUDED.fiber_100g
				RETURNING id
				""")
				.param("barcode", food.barcode())
				.param("name", truncate(food.name(), 200))
				.param("brand", food.brand() == null ? null : truncate(food.brand(), 100))
				.param("servingG", food.servingG())
				.param("servingLabel", food.servingLabel() == null ? null : truncate(food.servingLabel(), 60))
				.param("kcal", food.per100g().kcal())
				.param("protein", food.per100g().proteinG())
				.param("carbs", food.per100g().carbsG())
				.param("fat", food.per100g().fatG())
				.param("fiber", food.per100g().fiberG())
				.query(UUID.class)
				.single();
	}

	UUID insertCustom(UUID ownerId, String barcode, String name, String brand, Double servingG, String servingLabel,
			Nutrients per100g) {
		return jdbc.sql("""
				INSERT INTO food (owner_id, source, barcode, name, brand, serving_g, serving_label,
				                  kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g)
				VALUES (:ownerId, 'CUSTOM', :barcode, :name, :brand, :servingG, :servingLabel,
				        :kcal, :protein, :carbs, :fat, :fiber)
				RETURNING id
				""")
				.param("ownerId", ownerId)
				.param("barcode", barcode)
				.param("name", name)
				.param("brand", brand)
				.param("servingG", servingG)
				.param("servingLabel", servingLabel)
				.param("kcal", per100g.kcal())
				.param("protein", per100g.proteinG())
				.param("carbs", per100g.carbsG())
				.param("fat", per100g.fatG())
				.param("fiber", per100g.fiberG())
				.query(UUID.class)
				.single();
	}

	/** Name/brand substring search over the user's custom foods and the shared cache; custom foods first. */
	List<FoodRow> searchLocal(UUID userId, String pattern, int limit) {
		return jdbc.sql("SELECT " + COLUMNS + """
				 FROM food
				WHERE (owner_id IS NULL OR owner_id = :userId)
				  AND (lower(name) LIKE :pattern ESCAPE '\\' OR lower(coalesce(brand, '')) LIKE :pattern ESCAPE '\\')
				ORDER BY owner_id NULLS LAST, length(name), name
				LIMIT :limit
				""")
				.param("userId", userId)
				.param("pattern", pattern)
				.param("limit", limit)
				.query(FoodRepository::map)
				.list();
	}

	List<FoodRow> customFoods(UUID userId) {
		return jdbc.sql("SELECT " + COLUMNS + " FROM food WHERE owner_id = :userId ORDER BY name")
				.param("userId", userId)
				.query(FoodRepository::map)
				.list();
	}

	private static FoodRow map(ResultSet rs, int n) throws SQLException {
		return new FoodRow(
				rs.getObject("id", UUID.class),
				rs.getObject("owner_id", UUID.class),
				rs.getString("barcode"),
				rs.getString("name"),
				rs.getString("brand"),
				(Double) rs.getObject("serving_g"),
				rs.getString("serving_label"),
				new Nutrients(rs.getDouble("kcal"), rs.getDouble("protein"), rs.getDouble("carbs"), rs.getDouble("fat"),
						rs.getDouble("fiber")));
	}

	private static String truncate(String value, int max) {
		return value.length() <= max ? value : value.substring(0, max);
	}
}
