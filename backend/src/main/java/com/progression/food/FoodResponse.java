package com.progression.food;

import java.util.UUID;

/**
 * A food as the app shows it.
 *
 * @param servingG grams per serving, or {@code null} when only grams can be logged
 * @param per100g  nutrition per 100 g
 * @param custom   true for the user's own foods
 */
public record FoodResponse(UUID id, String name, String brand, String barcode, Double servingG, String servingLabel,
		Nutrients per100g, boolean custom) {

	static FoodResponse from(FoodRepository.FoodRow row) {
		return new FoodResponse(row.id(), row.name(), row.brand(), row.barcode(), row.servingG(), row.servingLabel(),
				row.per100g(), row.custom());
	}
}
