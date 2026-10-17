package com.progression.food;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class RecipeRepository {

	private final JdbcClient jdbc;

	RecipeRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	record RecipeRow(UUID id, String name, double servings) {
	}

	record IngredientRow(UUID recipeId, int position, UUID foodId, double grams) {
	}

	Optional<RecipeRow> findOwned(UUID ownerId, UUID id) {
		return jdbc.sql("SELECT id, name, servings::float8 AS servings FROM recipe WHERE id = :id AND owner_id = :ownerId")
				.param("id", id)
				.param("ownerId", ownerId)
				.query((rs, n) -> new RecipeRow(rs.getObject("id", UUID.class), rs.getString("name"), rs.getDouble("servings")))
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
		return jdbc.sql("SELECT id, name, servings::float8 AS servings FROM recipe WHERE owner_id = :ownerId ORDER BY lower(name)")
				.param("ownerId", ownerId)
				.query((rs, n) -> new RecipeRow(rs.getObject("id", UUID.class), rs.getString("name"), rs.getDouble("servings")))
				.list();
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

	/** Creates or fully replaces a recipe and its ingredient list. */
	void upsert(UUID ownerId, UUID id, String name, BigDecimal servings, List<IngredientRow> ingredients) {
		jdbc.sql("""
				INSERT INTO recipe (id, owner_id, name, servings) VALUES (:id, :ownerId, :name, :servings)
				ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, servings = EXCLUDED.servings, updated_at = now()
				""")
				.param("id", id)
				.param("ownerId", ownerId)
				.param("name", name)
				.param("servings", servings)
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
}
