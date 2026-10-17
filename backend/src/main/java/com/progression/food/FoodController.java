package com.progression.food;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Food", description = "Foods, recipes, and the food diary (private)")
public class FoodController {

	private final FoodService foods;
	private final RecipeService recipes;
	private final DiaryService diary;

	FoodController(FoodService foods, RecipeService recipes, DiaryService diary) {
		this.foods = foods;
		this.recipes = recipes;
		this.diary = diary;
	}

	// ------------------------------------------------------------------ foods

	@GetMapping("/foods/barcode/{code}")
	@Operation(summary = "Look up a scanned barcode (cache, then Open Food Facts); 404 if unknown")
	public FoodResponse byBarcode(CurrentUser me, @PathVariable String code) {
		return foods.byBarcode(me.id(), code);
	}

	@GetMapping("/foods/search")
	@Operation(summary = "Search your foods and Open Food Facts by name or brand")
	public List<FoodResponse> search(CurrentUser me, @RequestParam("q") String query) {
		return foods.search(me.id(), query);
	}

	@GetMapping("/foods/mine")
	@Operation(summary = "Your custom foods")
	public List<FoodResponse> customFoods(CurrentUser me) {
		return foods.customFoods(me.id());
	}

	@PostMapping("/foods")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Create a custom food from its nutrition label (values per serving)")
	public FoodResponse create(CurrentUser me, @Validated @RequestBody CreateFoodRequest request) {
		return foods.createCustom(me.id(), request);
	}

	@GetMapping("/foods/recent")
	@Operation(summary = "Recently logged foods and recipes with the amount used last time")
	public List<DiaryService.RecentItem> recent(CurrentUser me) {
		return diary.recent(me.id());
	}

	// ------------------------------------------------------------------ recipes

	@GetMapping("/recipes")
	@Operation(summary = "Your recipes with nutrition per serving")
	public List<RecipeService.RecipeResponse> recipes(CurrentUser me) {
		return recipes.list(me.id());
	}

	@GetMapping("/recipes/{id}")
	public RecipeService.RecipeResponse recipe(CurrentUser me, @PathVariable UUID id) {
		return recipes.get(me.id(), id);
	}

	@PutMapping("/recipes/{id}")
	@Operation(summary = "Create or replace a recipe (idempotent)")
	public RecipeService.RecipeResponse saveRecipe(CurrentUser me, @PathVariable UUID id,
			@Validated @RequestBody RecipeService.RecipeRequest request) {
		return recipes.save(me.id(), id, request);
	}

	@DeleteMapping("/recipes/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteRecipe(CurrentUser me, @PathVariable UUID id) {
		recipes.delete(me.id(), id);
	}

	// ------------------------------------------------------------------ diary

	@GetMapping("/diary/{date}")
	@Operation(summary = "A day's entries, totals and water")
	public DiaryService.DayResponse day(CurrentUser me, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		return diary.day(me.id(), date);
	}

	@PutMapping("/diary/entries/{id}")
	@Operation(summary = "Log or edit a diary entry (idempotent); nutrition is computed by the server")
	public DiaryService.EntryResponse saveEntry(CurrentUser me, @PathVariable UUID id,
			@Validated @RequestBody DiaryService.EntryRequest request) {
		return diary.save(me.id(), id, request);
	}

	@DeleteMapping("/diary/entries/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteEntry(CurrentUser me, @PathVariable UUID id) {
		diary.delete(me.id(), id);
	}

	@PostMapping("/diary/{date}/copy")
	@Operation(summary = "Copy another day's entries (optionally one meal) onto this day")
	public DiaryService.DayResponse copy(CurrentUser me, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@Validated @RequestBody DiaryService.CopyRequest request) {
		return diary.copy(me.id(), date, request.fromDate(), request.meal());
	}

	@PutMapping("/diary/{date}/water")
	@Operation(summary = "Set the day's water intake in ml")
	public DiaryService.WaterRequest water(CurrentUser me, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@Validated @RequestBody DiaryService.WaterRequest request) {
		return new DiaryService.WaterRequest(diary.setWater(me.id(), date, request.ml()));
	}
}
