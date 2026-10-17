package com.progression;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import com.progression.food.ExternalFood;
import com.progression.food.FoodDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** An in-memory stand-in for Open Food Facts, so tests never touch the network. */
@TestConfiguration(proxyBeanMethods = false)
public class TestFoodConfiguration {

	public static class FakeFoodDatabase implements FoodDatabase {

		public final Map<String, ExternalFood> products = new ConcurrentHashMap<>();
		public final AtomicInteger barcodeLookups = new AtomicInteger();

		@Override
		public Optional<ExternalFood> byBarcode(String barcode) {
			barcodeLookups.incrementAndGet();
			return Optional.ofNullable(products.get(barcode));
		}

		@Override
		public List<ExternalFood> search(String query) {
			return products.values().stream().filter(f -> f.name().toLowerCase().contains(query.toLowerCase())).toList();
		}
	}

	@Bean
	@Primary
	FakeFoodDatabase fakeFoodDatabase() {
		return new FakeFoodDatabase();
	}
}
