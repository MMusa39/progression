package com.progression.body;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.progression.common.WeightUnit;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class BodyWeightRepository {

	private final JdbcClient jdbc;

	BodyWeightRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	record Row(LocalDate date, BigDecimal weight, WeightUnit unit, double weightKg) {
	}

	/** Records (or replaces) the weigh-in for a day. */
	void upsert(UUID userId, LocalDate date, BigDecimal weight, WeightUnit unit) {
		jdbc.sql("""
				INSERT INTO body_weight_entry (user_id, measured_on, weight, weight_unit)
				VALUES (:userId, :date, :weight, :unit)
				ON CONFLICT (user_id, measured_on) DO UPDATE
				    SET weight = EXCLUDED.weight, weight_unit = EXCLUDED.weight_unit, updated_at = now()
				""")
				.param("userId", userId)
				.param("date", date)
				.param("weight", weight)
				.param("unit", unit.name())
				.update();
	}

	void delete(UUID userId, LocalDate date) {
		jdbc.sql("DELETE FROM body_weight_entry WHERE user_id = :userId AND measured_on = :date")
				.param("userId", userId)
				.param("date", date)
				.update();
	}

	/** All weigh-ins, oldest first. Daily entries stay small (a decade is ~3,650 rows). */
	List<Row> all(UUID userId) {
		return jdbc.sql("""
				SELECT measured_on, weight, weight_unit, weight_kg::float8 AS weight_kg
				FROM body_weight_entry
				WHERE user_id = :userId
				ORDER BY measured_on
				""")
				.param("userId", userId)
				.query((rs, n) -> new Row(
						rs.getObject("measured_on", LocalDate.class),
						rs.getBigDecimal("weight"),
						WeightUnit.valueOf(rs.getString("weight_unit")),
						rs.getDouble("weight_kg")))
				.list();
	}
}
