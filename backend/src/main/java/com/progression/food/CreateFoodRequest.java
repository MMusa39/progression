package com.progression.food;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * A custom food, entered the way nutrition labels are printed: per serving.
 *
 * @param servingG     weight of one serving in grams (or ml)
 * @param servingLabel how a serving is described, e.g. "1 bar" or "2 tbsp"
 */
public record CreateFoodRequest(
		@NotBlank @Size(max = 200) String name,
		@Size(max = 100) String brand,
		@Size(max = 20) String barcode,
		@NotNull @DecimalMin("1") @DecimalMax("5000") Double servingG,
		@Size(max = 60) String servingLabel,
		@NotNull @Valid PerServing perServingValues) {

	public record PerServing(
			@NotNull @DecimalMin("0") @DecimalMax("10000") Double kcal,
			@DecimalMin("0") Double proteinG,
			@DecimalMin("0") Double carbsG,
			@DecimalMin("0") Double fatG,
			@DecimalMin("0") Double fiberG) {
	}

	Nutrients perServing() {
		var p = perServingValues;
		return new Nutrients(p.kcal(), orZero(p.proteinG()), orZero(p.carbsG()), orZero(p.fatG()), orZero(p.fiberG()));
	}

	private static double orZero(Double value) {
		return value == null ? 0 : value;
	}
}
