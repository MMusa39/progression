package com.progression.food;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reusable recipes. Nutrition per serving is always derived from the ingredients, never stored. */
@Service
public class RecipeService {

	private final RecipeRepository recipes;
	private final FoodRepository foods;

	RecipeService(RecipeRepository recipes, FoodRepository foods) {
		this.recipes = recipes;
		this.foods = foods;
	}

	public record IngredientRequest(@NotNull UUID foodId, @NotNull @DecimalMin("0.1") @DecimalMax("20000") BigDecimal grams) {
	}

	public record RecipeRequest(
			@NotBlank @Size(max = 100) String name,
			@NotNull @DecimalMin("0.5") @DecimalMax("100") BigDecimal servings,
			@NotEmpty @Size(max = 50) List<@Valid @NotNull IngredientRequest> ingredients) {
	}

	public record Ingredient(FoodResponse food, double grams, Nutrients nutrients) {
	}

	public record RecipeResponse(UUID id, String name, double servings, List<Ingredient> ingredients, Nutrients total,
			Nutrients perServing) {
	}

	@Transactional(readOnly = true)
	public List<RecipeResponse> list(UUID userId) {
		return describe(userId, recipes.listOwned(userId));
	}

	@Transactional(readOnly = true)
	public RecipeResponse get(UUID userId, UUID recipeId) {
		var recipe = recipes.findOwned(userId, recipeId).orElseThrow(() -> new NotFoundException("Recipe not found"));
		return describe(userId, List.of(recipe)).getFirst();
	}

	/** Creates or replaces a recipe (client-generated id, idempotent like workouts). */
	@Transactional
	public RecipeResponse save(UUID userId, UUID recipeId, RecipeRequest request) {
		if (recipes.existsForOtherOwner(userId, recipeId)) {
			throw new NotFoundException("Recipe not found");
		}
		Set<UUID> foodIds = new HashSet<>(request.ingredients().stream().map(IngredientRequest::foodId).toList());
		if (foods.findVisible(userId, foodIds).size() != foodIds.size()) {
			throw new BadRequestException("A recipe ingredient refers to a food that doesn't exist.");
		}
		List<RecipeRepository.IngredientRow> rows = new ArrayList<>();
		for (int i = 0; i < request.ingredients().size(); i++) {
			var ingredient = request.ingredients().get(i);
			rows.add(new RecipeRepository.IngredientRow(recipeId, i, ingredient.foodId(), ingredient.grams().doubleValue()));
		}
		recipes.upsert(userId, recipeId, request.name().trim(), request.servings(), rows);
		return get(userId, recipeId);
	}

	@Transactional
	public void delete(UUID userId, UUID recipeId) {
		recipes.delete(userId, recipeId); // past diary entries keep their snapshot (recipe_id set to NULL)
	}

	/** Nutrition of one serving, for logging. */
	@Transactional(readOnly = true)
	public Nutrients perServing(UUID userId, UUID recipeId) {
		return get(userId, recipeId).perServing();
	}

	private List<RecipeResponse> describe(UUID userId, List<RecipeRepository.RecipeRow> rows) {
		var ingredients = recipes.ingredients(rows.stream().map(RecipeRepository.RecipeRow::id).toList());
		Map<UUID, FoodRepository.FoodRow> foodsById = foods
				.findVisible(userId, ingredients.stream().map(RecipeRepository.IngredientRow::foodId).collect(Collectors.toSet()))
				.stream().collect(Collectors.toMap(FoodRepository.FoodRow::id, Function.identity()));
		Map<UUID, List<RecipeRepository.IngredientRow>> byRecipe = ingredients.stream()
				.collect(Collectors.groupingBy(RecipeRepository.IngredientRow::recipeId));

		return rows.stream().map(recipe -> {
			List<Ingredient> items = new ArrayList<>();
			Nutrients total = Nutrients.ZERO;
			for (var row : byRecipe.getOrDefault(recipe.id(), List.of())) {
				var food = foodsById.get(row.foodId());
				if (food == null) {
					continue;
				}
				Nutrients n = food.per100g().scaled(row.grams() / 100);
				total = total.plus(n);
				items.add(new Ingredient(FoodResponse.from(food), row.grams(), n.rounded()));
			}
			return new RecipeResponse(recipe.id(), recipe.name(), recipe.servings(), items, total.rounded(),
					total.scaled(1 / recipe.servings()).rounded());
		}).toList();
	}
}
