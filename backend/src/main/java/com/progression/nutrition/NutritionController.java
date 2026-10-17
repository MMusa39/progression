package com.progression.nutrition;

import java.time.LocalDate;

import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/nutrition")
@Tag(name = "Nutrition goals", description = "Goal profile and daily calorie/macro targets (private)")
public class NutritionController {

	private final NutritionService service;

	NutritionController(NutritionService service) {
		this.service = service;
	}

	@GetMapping("/profile")
	@Operation(summary = "Your goal profile; 204 until set up")
	public ResponseEntity<NutritionService.ProfileResponse> profile(CurrentUser me) {
		var profile = service.profile(me.id());
		return profile == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(profile);
	}

	@PutMapping("/profile")
	@Operation(summary = "Create or update your goal profile (optionally logging today's weight)")
	public NutritionService.ProfileResponse saveProfile(CurrentUser me, @Validated @RequestBody NutritionService.ProfileRequest request) {
		return service.saveProfile(me.id(), request);
	}

	@GetMapping("/targets")
	@Operation(summary = "Today's calorie, macro, fiber and water targets; 204 until a profile exists")
	public ResponseEntity<NutritionService.TargetsResponse> targets(CurrentUser me,
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
		var targets = service.targets(me.id(), today);
		return targets == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(targets);
	}
}
