package com.progression.food;

/**
 * A product from an external food database, normalized.
 *
 * @param servingG     grams in one serving, or {@code null} if unknown
 * @param servingLabel serving as printed on the label, e.g. "1 cup (240 ml)"
 * @param per100g      nutrition per 100 g (or 100 ml for drinks)
 */
public record ExternalFood(String barcode, String name, String brand, Double servingG, String servingLabel,
		Nutrients per100g) {
}
