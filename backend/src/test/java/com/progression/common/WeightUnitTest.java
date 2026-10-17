package com.progression.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class WeightUnitTest {

	@Test
	void poundsConvertToKilogramsUsingTheExactDefinition() {
		assertThat(WeightUnit.LB.toKg(new BigDecimal("225"))).isEqualByComparingTo("102.058");
	}

	@Test
	void kilogramsAreUnchanged() {
		assertThat(WeightUnit.KG.toKg(new BigDecimal("100.5"))).isEqualByComparingTo("100.5");
	}
}
