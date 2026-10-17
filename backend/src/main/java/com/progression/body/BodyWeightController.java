package com.progression.body;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.progression.common.WeightUnit;
import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/body-weights")
@Tag(name = "Body weight", description = "Weigh-ins and the smoothed trend (private)")
public class BodyWeightController {

	private final BodyWeightService service;

	BodyWeightController(BodyWeightService service) {
		this.service = service;
	}

	/**
	 * @param today the user's local date, so "no future weigh-ins" uses their calendar
	 */
	public record LogRequest(
			@NotNull @DecimalMin("20") @DecimalMax("1400") @Digits(integer = 4, fraction = 2) BigDecimal weight,
			@NotNull WeightUnit weightUnit,
			@NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
	}

	@PutMapping("/{date}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Record (or replace) the weigh-in for a day")
	public void log(CurrentUser me, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@Validated @RequestBody LogRequest request) {
		service.log(me.id(), date, request.weight(), request.weightUnit(), request.today());
	}

	@DeleteMapping("/{date}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Delete the weigh-in for a day")
	public void delete(CurrentUser me, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
		service.delete(me.id(), date);
	}

	@GetMapping
	@Operation(summary = "Weigh-ins with their trend values, current trend and weekly rate")
	public BodyWeightService.History history(CurrentUser me,
			@Parameter(description = "First date to include (ISO date). Omit for all.")
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from) {
		return service.history(me.id(), from);
	}
}
