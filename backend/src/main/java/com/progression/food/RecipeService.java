package com.progression.food;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.NotFoundException;
import com.progression.social.FriendService;
import com.progression.user.AppUser;
import com.progression.user.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reusable recipes. Nutrition per serving is always derived from the ingredients, never stored.
 * A recipe can be shared with friends (opt-in, per recipe); friends save their own copy to log it.
 */
@Service
public class RecipeService {

	private final RecipeRepository recipes;
	private final FoodRepository foods;
	private final FriendService friends;
	private final UserService users;

	RecipeService(RecipeRepository recipes, FoodRepository foods, FriendService friends, UserService users) {
		this.recipes = recipes;
		this.foods = foods;
		this.friends = friends;
		this.users = users;
	}

	public record IngredientRequest(@NotNull UUID foodId, @NotNull @DecimalMin("0.1") @DecimalMax("20000") BigDecimal grams) {
	}

	public record RecipeRequest(
			@NotBlank @Size(max = 100) String name,
			@NotNull @DecimalMin("0.5") @DecimalMax("100") BigDecimal servings,
			@NotEmpty @Size(max = 50) List<@Valid @NotNull IngredientRequest> ingredients,
			/** Visible to friends. Omit to keep the current setting. */
			Boolean shared) {
	}

	public record CopyRequest(@NotNull UUID id) {
	}

	public record Ingredient(FoodResponse food, double grams, Nutrients nutrients) {
	}

	/** Who shared a recipe. */
	public record Sharer(UUID id, String username, String displayName) {
	}

	/**
	 * {@code sharedBy} and {@code savedCopyId} are only set on a friend's shared recipe:
	 * who shared it, and the id of your saved copy if you have one.
	 */
	public record RecipeResponse(UUID id, String name, double servings, List<Ingredient> ingredients, Nutrients total,
			Nutrients perServing, boolean shared, Sharer sharedBy, UUID savedCopyId) {
	}

	@Transactional(readOnly = true)
	public List<RecipeResponse> list(UUID userId) {
		return describe(recipes.listOwned(userId));
	}

	@Transactional(readOnly = true)
	public RecipeResponse get(UUID userId, UUID recipeId) {
		var recipe = recipes.findOwned(userId, recipeId).orElseThrow(() -> new NotFoundException("Recipe not found"));
		return describe(List.of(recipe)).getFirst();
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
		recipes.upsert(userId, recipeId, request.name().trim(), request.servings(), request.shared(), null, rows);
		return get(userId, recipeId);
	}

	// ------------------------------------------------------------------ sharing with friends

	/** Recipes your friends have shared, newest first. */
	@Transactional(readOnly = true)
	public List<RecipeResponse> sharedWithMe(UUID userId) {
		return describeShared(userId, recipes.listShared(friends.friendIds(userId)));
	}

	@Transactional(readOnly = true)
	public RecipeResponse getShared(UUID userId, UUID recipeId) {
		return describeShared(userId, List.of(requireShared(userId, recipeId))).getFirst();
	}

	/**
	 * Saves your own copy of a friend's shared recipe. Their custom foods are copied
	 * into your foods too, so the copy keeps working if they edit or delete theirs.
	 * Saving the same recipe again returns the existing copy.
	 */
	@Transactional
	public RecipeResponse copy(UUID userId, UUID sourceId, UUID newId) {
		RecipeRepository.RecipeRow source = requireShared(userId, sourceId);
		UUID existing = recipes.copiesOf(userId, List.of(sourceId)).get(sourceId);
		if (existing != null) {
			return get(userId, existing);
		}
		if (recipes.existsForOtherOwner(userId, newId) || recipes.findOwned(userId, newId).isPresent()) {
			throw new BadRequestException("Choose a new id for the copy.");
		}
		var ingredients = recipes.ingredients(List.of(sourceId));
		Map<UUID, FoodRepository.FoodRow> sourceFoods = foods
				.findVisible(source.ownerId(), ingredients.stream().map(RecipeRepository.IngredientRow::foodId).collect(Collectors.toSet()))
				.stream().collect(Collectors.toMap(FoodRepository.FoodRow::id, Function.identity()));
		Map<UUID, UUID> copiedFoods = new HashMap<>();
		List<RecipeRepository.IngredientRow> rows = new ArrayList<>();
		for (var ingredient : ingredients) {
			var food = sourceFoods.get(ingredient.foodId());
			if (food == null) {
				continue;
			}
			UUID foodId = !food.custom() ? food.id() : copiedFoods.computeIfAbsent(food.id(), id ->
					foods.insertCustom(userId, null, food.name(), food.brand(), food.servingG(), food.servingLabel(), food.per100g()));
			rows.add(new RecipeRepository.IngredientRow(newId, rows.size(), foodId, ingredient.grams()));
		}
		recipes.upsert(userId, newId, source.name(), BigDecimal.valueOf(source.servings()), false, sourceId, rows);
		return get(userId, newId);
	}

	/** 404 unless the recipe is shared and its owner is your friend (or you). */
	private RecipeRepository.RecipeRow requireShared(UUID userId, UUID recipeId) {
		var recipe = recipes.findShared(recipeId).orElseThrow(() -> new NotFoundException("Recipe not found"));
		if (!recipe.ownerId().equals(userId)) {
			try {
				friends.requireFriends(userId, recipe.ownerId());
			}
			catch (NotFoundException notFriends) {
				throw new NotFoundException("Recipe not found");
			}
		}
		return recipe;
	}

	private List<RecipeResponse> describeShared(UUID userId, List<RecipeRepository.RecipeRow> rows) {
		Map<UUID, Sharer> sharers = users.findAllById(rows.stream().map(RecipeRepository.RecipeRow::ownerId).distinct().toList())
				.stream().collect(Collectors.toMap(AppUser::getId, u -> new Sharer(u.getId(), u.getUsername(), u.getDisplayName())));
		Map<UUID, UUID> ownerByRecipe = rows.stream()
				.collect(Collectors.toMap(RecipeRepository.RecipeRow::id, RecipeRepository.RecipeRow::ownerId));
		Map<UUID, UUID> copies = recipes.copiesOf(userId, ownerByRecipe.keySet());
		return describe(rows).stream()
				.map(r -> new RecipeResponse(r.id(), r.name(), r.servings(), r.ingredients(), r.total(), r.perServing(),
						true, sharers.get(ownerByRecipe.get(r.id())), copies.get(r.id())))
				.toList();
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

	/** Ingredients resolve with each recipe owner's food visibility (their custom foods + the shared cache). */
	private List<RecipeResponse> describe(List<RecipeRepository.RecipeRow> rows) {
		var ingredients = recipes.ingredients(rows.stream().map(RecipeRepository.RecipeRow::id).toList());
		Map<UUID, List<RecipeRepository.IngredientRow>> byRecipe = ingredients.stream()
				.collect(Collectors.groupingBy(RecipeRepository.IngredientRow::recipeId));
		Map<UUID, Set<UUID>> foodIdsByOwner = new LinkedHashMap<>();
		for (var recipe : rows) {
			for (var row : byRecipe.getOrDefault(recipe.id(), List.of())) {
				foodIdsByOwner.computeIfAbsent(recipe.ownerId(), o -> new HashSet<>()).add(row.foodId());
			}
		}
		Map<UUID, FoodRepository.FoodRow> foodsById = new HashMap<>();
		foodIdsByOwner.forEach((owner, ids) -> foods.findVisible(owner, ids).forEach(f -> foodsById.put(f.id(), f)));

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
					total.scaled(1 / recipe.servings()).rounded(), recipe.shared(), null, null);
		}).toList();
	}
}
