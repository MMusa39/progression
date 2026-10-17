package com.progression.food;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The food diary. Entries are saved with an idempotent PUT (client-generated
 * id), and their nutrition is computed by the server from the food or recipe
 * and snapshotted, so later edits to a food never rewrite past days.
 */
@Service
public class DiaryService {

	static final int RECENT_LIMIT = 25;

	private final DiaryRepository diary;
	private final FoodRepository foods;
	private final RecipeService recipes;

	DiaryService(DiaryRepository diary, FoodRepository foods, RecipeService recipes) {
		this.diary = diary;
		this.foods = foods;
		this.recipes = recipes;
	}

	/**
	 * One diary line.
	 *
	 * @param kind   FOOD (foodId + grams or servings), RECIPE (recipeId + servings), or QUICK (calories/macros only)
	 * @param amount grams, or number of servings
	 * @param quick  values for a QUICK entry
	 */
	public record EntryRequest(
			@NotNull LocalDate date,
			@NotNull @Pattern(regexp = "BREAKFAST|LUNCH|DINNER|SNACK") String meal,
			@NotNull @Pattern(regexp = "FOOD|RECIPE|QUICK") String kind,
			UUID foodId,
			UUID recipeId,
			@NotNull @DecimalMin("0.01") @DecimalMax("10000") Double amount,
			@NotNull @Pattern(regexp = "G|SERVING") String amountUnit,
			@Valid QuickValues quick) {
	}

	public record QuickValues(
			@Size(max = 100) String name,
			@NotNull @DecimalMin("0") @DecimalMax("10000") Double kcal,
			@DecimalMin("0") Double proteinG,
			@DecimalMin("0") Double carbsG,
			@DecimalMin("0") Double fatG) {
	}

	public record EntryResponse(UUID id, LocalDate date, String meal, String kind, UUID foodId, UUID recipeId,
			String name, double amount, String amountUnit, Nutrients nutrients) {

		static EntryResponse from(DiaryRepository.EntryRow row) {
			return new EntryResponse(row.id(), row.date(), row.meal(), row.kind(), row.foodId(), row.recipeId(), row.name(),
					row.amount(), row.amountUnit(), row.nutrients());
		}
	}

	public record DayResponse(LocalDate date, List<EntryResponse> entries, Nutrients totals, int waterMl) {
	}

	/** A food or recipe recently logged, with the amount used last time, for one-tap re-logging. */
	public record RecentItem(String kind, FoodResponse food, RecipeService.RecipeResponse recipe, double lastAmount,
			String lastAmountUnit) {
	}

	@Transactional(readOnly = true)
	public DayResponse day(UUID userId, LocalDate date) {
		List<EntryResponse> entries = diary.day(userId, date).stream().map(EntryResponse::from).toList();
		Nutrients totals = entries.stream().map(EntryResponse::nutrients).reduce(Nutrients.ZERO, Nutrients::plus).rounded();
		return new DayResponse(date, entries, totals, diary.water(userId, date));
	}

	@Transactional
	public EntryResponse save(UUID userId, UUID entryId, EntryRequest request) {
		diary.ownerOf(entryId).filter(owner -> !owner.equals(userId)).ifPresent(owner -> {
			throw new NotFoundException("Entry not found");
		});
		DiaryRepository.EntryRow row = switch (request.kind()) {
			case "FOOD" -> foodEntry(userId, entryId, request);
			case "RECIPE" -> recipeEntry(userId, entryId, request);
			default -> quickEntry(entryId, request);
		};
		diary.upsert(userId, row);
		return EntryResponse.from(row);
	}

	private DiaryRepository.EntryRow foodEntry(UUID userId, UUID id, EntryRequest r) {
		if (r.foodId() == null) {
			throw new BadRequestException("foodId is required for a FOOD entry");
		}
		var food = foods.findVisible(userId, r.foodId()).orElseThrow(() -> new BadRequestException("Unknown food"));
		double grams;
		if ("G".equals(r.amountUnit())) {
			grams = r.amount();
		}
		else if (food.servingG() != null) {
			grams = r.amount() * food.servingG();
		}
		else {
			throw new BadRequestException("This food has no serving size; log it in grams.");
		}
		String name = food.brand() != null ? food.name() + " (" + food.brand() + ")" : food.name();
		return new DiaryRepository.EntryRow(id, r.date(), r.meal(), "FOOD", food.id(), null, truncate(name),
				r.amount(), r.amountUnit(), food.per100g().scaled(grams / 100).rounded());
	}

	private DiaryRepository.EntryRow recipeEntry(UUID userId, UUID id, EntryRequest r) {
		if (r.recipeId() == null || !"SERVING".equals(r.amountUnit())) {
			throw new BadRequestException("A RECIPE entry needs recipeId and an amount in servings");
		}
		var recipe = recipes.get(userId, r.recipeId());
		return new DiaryRepository.EntryRow(id, r.date(), r.meal(), "RECIPE", null, recipe.id(), truncate(recipe.name()),
				r.amount(), "SERVING", recipe.perServing().scaled(r.amount()).rounded());
	}

	private DiaryRepository.EntryRow quickEntry(UUID id, EntryRequest r) {
		if (r.quick() == null) {
			throw new BadRequestException("A QUICK entry needs calories");
		}
		var q = r.quick();
		Nutrients n = new Nutrients(q.kcal(), orZero(q.proteinG()), orZero(q.carbsG()), orZero(q.fatG()), 0).rounded();
		String name = q.name() == null || q.name().isBlank() ? "Quick add" : q.name().trim();
		return new DiaryRepository.EntryRow(id, r.date(), r.meal(), "QUICK", null, null, truncate(name), 1, "SERVING", n);
	}

	@Transactional
	public void delete(UUID userId, UUID entryId) {
		diary.delete(userId, entryId);
	}

	/** Copies a day's entries (or one meal's) onto another day, e.g. "same breakfast as yesterday". */
	@Transactional
	public DayResponse copy(UUID userId, LocalDate to, LocalDate from, String meal) {
		if (meal != null && !meal.matches("BREAKFAST|LUNCH|DINNER|SNACK")) {
			throw new BadRequestException("Unknown meal: " + meal);
		}
		if (from.equals(to)) {
			throw new BadRequestException("Pick a different day to copy from.");
		}
		diary.copy(userId, from, to, meal);
		return day(userId, to);
	}

	@Transactional
	public int setWater(UUID userId, LocalDate date, int ml) {
		diary.setWater(userId, date, ml);
		return ml;
	}

	@Transactional(readOnly = true)
	public List<RecentItem> recent(UUID userId) {
		var rows = diary.recentDistinct(userId, RECENT_LIMIT);
		Map<UUID, FoodResponse> foodById = foods
				.findVisible(userId, rows.stream().map(DiaryRepository.EntryRow::foodId).filter(java.util.Objects::nonNull).collect(Collectors.toSet()))
				.stream().map(FoodResponse::from).collect(Collectors.toMap(FoodResponse::id, Function.identity()));
		Map<UUID, RecipeService.RecipeResponse> recipeById = recipes.list(userId).stream()
				.collect(Collectors.toMap(RecipeService.RecipeResponse::id, Function.identity()));
		return rows.stream()
				.map(row -> "FOOD".equals(row.kind())
						? (foodById.containsKey(row.foodId()) ? new RecentItem("FOOD", foodById.get(row.foodId()), null, row.amount(), row.amountUnit()) : null)
						: (recipeById.containsKey(row.recipeId()) ? new RecentItem("RECIPE", null, recipeById.get(row.recipeId()), row.amount(), row.amountUnit()) : null))
				.filter(java.util.Objects::nonNull)
				.toList();
	}

	/** Daily calorie totals, used by adaptive targets. */
	@Transactional(readOnly = true)
	public Map<LocalDate, Double> dailyCalories(UUID userId, LocalDate from, LocalDate to) {
		return diary.dailyCalories(userId, from, to);
	}

	public record WaterRequest(@NotNull @Min(0) @Max(20000) Integer ml) {
	}

	public record CopyRequest(@NotNull LocalDate fromDate, String meal) {
	}

	private static double orZero(Double value) {
		return value == null ? 0 : value;
	}

	private static String truncate(String value) {
		return value.length() <= 200 ? value : value.substring(0, 200);
	}
}
