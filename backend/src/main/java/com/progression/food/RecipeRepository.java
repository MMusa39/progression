package com.progression.food;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class RecipeRepository {

	private static final String COLUMNS = "id, owner_id, name, servings::float8 AS servings, shared";

	private final JdbcClient jdbc;

	RecipeRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	record RecipeRow(UUID id, UUID ownerId, String name, double servings, boolean shared) {
	}

	record IngredientRow(UUID recipeId, int position, UUID foodId, double grams) {
	}

	Optional<RecipeRow> findOwned(UUID ownerId, UUID id) {
		return jdbc.sql("SELECT " + COLUMNS + " FROM recipe WHERE id = :id AND owner_id = :ownerId")
				.param("id", id)
				.param("ownerId", ownerId)
				.query(RecipeRepository::map)
				.optional();
	}

	boolean existsForOtherOwner(UUID ownerId, UUID id) {
		return jdbc.sql("SELECT count(*) > 0 FROM recipe WHERE id = :id AND owner_id <> :ownerId")
				.param("id", id)
				.param("ownerId", ownerId)
				.query(Boolean.class)
				.single();
	}

	List<RecipeRow> listOwned(UUID ownerId) {
		return jdbc.sql("SELECT " + COLUMNS + " FROM recipe WHERE owner_id = :ownerId ORDER BY lower(name)")
				.param("ownerId", ownerId)
				.query(RecipeRepository::map)
				.list();
	}

	/** Recipes these users have shared, most recently updated first. */
	List<RecipeRow> listShared(Collection<UUID> ownerIds) {
		if (ownerIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("SELECT " + COLUMNS + " FROM recipe WHERE owner_id IN (:ids) AND shared ORDER BY updated_at DESC LIMIT 200")
				.param("ids", ownerIds)
				.query(RecipeRepository::map)
				.list();
	}

	Optional<RecipeRow> findShared(UUID id) {
		return jdbc.sql("SELECT " + COLUMNS + " FROM recipe WHERE id = :id AND shared")
				.param("id", id)
				.query(RecipeRepository::map)
				.optional();
	}

	/** source recipe id → the user's copy of it. */
	Map<UUID, UUID> copiesOf(UUID ownerId, Collection<UUID> sourceIds) {
		if (sourceIds.isEmpty()) {
			return Map.of();
		}
		return jdbc.sql("SELECT copied_from, id FROM recipe WHERE owner_id = :ownerId AND copied_from IN (:ids)")
				.param("ownerId", ownerId)
				.param("ids", sourceIds)
				.query((rs, n) -> Map.entry(rs.getObject("copied_from", UUID.class), rs.getObject("id", UUID.class)))
				.list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
	}

	List<IngredientRow> ingredients(List<UUID> recipeIds) {
		if (recipeIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("""
				SELECT recipe_id, position, food_id, grams::float8 AS grams
				FROM recipe_ingredient WHERE recipe_id IN (:ids) ORDER BY recipe_id, position
				""")
				.param("ids", recipeIds)
				.query((rs, n) -> new IngredientRow(rs.getObject("recipe_id", UUID.class), rs.getInt("position"),
						rs.getObject("food_id", UUID.class), rs.getDouble("grams")))
				.list();
	}

	/**
	 * Creates or fully replaces a recipe and its ingredient list. A null {@code shared}
	 * keeps the current setting (private for a new recipe).
	 */
	void upsert(UUID ownerId, UUID id, String name, BigDecimal servings, Boolean shared, UUID copiedFrom,
			List<IngredientRow> ingredients) {
		jdbc.sql("""
				INSERT INTO recipe (id, owner_id, name, servings, shared, copied_from)
				VALUES (:id, :ownerId, :name, :servings, coalesce(:shared, false), :copiedFrom)
				ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, servings = EXCLUDED.servings,
				    shared = coalesce(:shared, recipe.shared), updated_at = now()
				""")
				.param("id", id)
				.param("ownerId", ownerId)
				.param("name", name)
				.param("servings", servings)
				.param("shared", shared)
				.param("copiedFrom", copiedFrom)
				.update();
		jdbc.sql("DELETE FROM recipe_ingredient WHERE recipe_id = :id").param("id", id).update();
		for (IngredientRow ingredient : ingredients) {
			jdbc.sql("INSERT INTO recipe_ingredient (recipe_id, position, food_id, grams) VALUES (:r, :p, :f, :g)")
					.param("r", id)
					.param("p", ingredient.position())
					.param("f", ingredient.foodId())
					.param("g", ingredient.grams())
					.update();
		}
	}

	void delete(UUID ownerId, UUID id) {
		jdbc.sql("DELETE FROM recipe WHERE id = :id AND owner_id = :ownerId").param("id", id).param("ownerId", ownerId).update();
	}

	private static RecipeRow map(ResultSet rs, int rowNum) throws SQLException {
		return new RecipeRow(rs.getObject("id", UUID.class), rs.getObject("owner_id", UUID.class), rs.getString("name"),
				rs.getDouble("servings"), rs.getBoolean("shared"));
	}
}
