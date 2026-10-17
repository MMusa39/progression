package com.progression.food;

import java.util.List;
import java.util.Optional;

/** An external source of packaged-food nutrition data. Production uses Open Food Facts; tests use a fake. */
public interface FoodDatabase {

	Optional<ExternalFood> byBarcode(String barcode);

	List<ExternalFood> search(String query);
}
