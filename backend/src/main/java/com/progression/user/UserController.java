package com.progression.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "User", description = "The signed-in user's profile and preferences")
public class UserController {

	private final UserService userService;

	UserController(UserService userService) {
		this.userService = userService;
	}

	@GetMapping
	@Operation(summary = "Get the current user's profile (created automatically on first call)")
	public UserResponse me(CurrentUser currentUser) {
		return UserResponse.from(userService.get(currentUser));
	}

	@PatchMapping
	@Operation(summary = "Update display name and/or preferred weight unit")
	public UserResponse update(CurrentUser currentUser, @Validated @RequestBody UpdateUserRequest request) {
		return UserResponse.from(userService.update(currentUser, request));
	}
}
