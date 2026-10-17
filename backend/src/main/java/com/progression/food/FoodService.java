package com.progression.food;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.progression.common.error.BadRequestException;
import com.progression.common.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finding foods: barcode lookups and search hit the local cache first and
 * fall back to Open Food Facts, caching what comes back, so popular products
 * are fast and work even when Open Food Facts is slow.
 */
@Service
public class FoodService {

	private static final int SEARCH_LIMIT = 25;

	private final FoodRepository foods;
	private final FoodDatabase external;

	FoodService(FoodRepository foods, FoodDatabase external) {
		this.foods = foods;
		this.external = external;
	}

	/** Looks up a scanned barcode. 404 if nobody knows it (the app then offers to create a custom food). */
	@Transactional
	public FoodResponse byBarcode(UUID userId, String rawBarcode) {
		String barcode = normalizeBarcode(rawBarcode);
		Optional<FoodRepository.FoodRow> cached = foods.findByBarcode(userId, barcode);
		if (cached.isPresent()) {
			return FoodResponse.from(cached.get());
		}
		Optional<ExternalFood> found = external.byBarcode(barcode);
		if (found.isEmpty() && barcode.length() == 12) {
			found = external.byBarcode("0" + barcode); // UPC-A is often stored as 13-digit EAN
		}
		ExternalFood food = found.orElseThrow(() -> new NotFoundException("No product found for barcode " + barcode));
		UUID id = foods.upsertExternal(new ExternalFood(barcode, food.name(), food.brand(), food.servingG(),
				food.servingLabel(), food.per100g()));
		return FoodResponse.from(foods.findVisible(userId, id).orElseThrow());
	}

	/**
	 * Search: the user's custom foods and cached products first, then fresh
	 * results from Open Food Facts (cached as they come in), de-duplicated by barcode.
	 */
	@Transactional
	public List<FoodResponse> search(UUID userId, String query) {
		String term = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
		if (term.length() < 2) {
			return List.of();
		}
		Map<String, FoodResponse> results = new LinkedHashMap<>();
		String pattern = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
		for (var row : foods.searchLocal(userId, pattern, SEARCH_LIMIT)) {
			results.put(row.barcode() != null ? row.barcode() : row.id().toString(), FoodResponse.from(row));
		}
		if (results.size() < SEARCH_LIMIT) {
			for (ExternalFood food : external.search(term)) {
				if (results.size() >= SEARCH_LIMIT) {
					break;
				}
				if (!results.containsKey(food.barcode())) {
					UUID id = foods.upsertExternal(food);
					foods.findVisible(userId, id).ifPresent(row -> results.put(food.barcode(), FoodResponse.from(row)));
				}
			}
		}
		return new ArrayList<>(results.values());
	}

	@Transactional(readOnly = true)
	public List<FoodResponse> customFoods(UUID userId) {
		return foods.customFoods(userId).stream().map(FoodResponse::from).toList();
	}

	/**
	 * Creates a custom food from a label: nutrition per serving (what's printed)
	 * is converted to per 100 g using the serving weight.
	 */
	@Transactional
	public FoodResponse createCustom(UUID userId, CreateFoodRequest request) {
		if (request.servingG() == null || request.servingG() <= 0) {
			throw new BadRequestException("Enter the serving size in grams so portions can be calculated.");
		}
		Nutrients per100 = request.perServing().scaled(100 / request.servingG()).rounded();
		String barcode = request.barcode() == null || request.barcode().isBlank() ? null : normalizeBarcode(request.barcode());
		UUID id = foods.insertCustom(userId, barcode, request.name().trim(),
				request.brand() == null || request.brand().isBlank() ? null : request.brand().trim(),
				request.servingG(), request.servingLabel(), per100);
		return FoodResponse.from(foods.findVisible(userId, id).orElseThrow());
	}

	static String normalizeBarcode(String raw) {
		String digits = raw == null ? "" : raw.replaceAll("\\D", "");
		if (digits.length() < 6 || digits.length() > 14) {
			throw new BadRequestException("That doesn't look like a product barcode.");
		}
		return digits;
	}
}
