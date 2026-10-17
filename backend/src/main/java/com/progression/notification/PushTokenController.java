package com.progression.notification;

import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/push-tokens")
@Tag(name = "Notifications", description = "Registering this device for push notifications")
public class PushTokenController {

	private final PushTokenRepository tokens;

	PushTokenController(PushTokenRepository tokens) {
		this.tokens = tokens;
	}

	/** @param token an Expo push token, e.g. {@code ExponentPushToken[xxxxxxxxxxxx]} */
	public record RegisterRequest(
			@NotBlank @Size(max = 200) @Pattern(regexp = "^Expo(nent)?PushToken\\[.+]$") String token,
			@NotBlank @Pattern(regexp = "IOS|ANDROID") String platform) {
	}

	@PostMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Register this device's Expo push token (idempotent)")
	public void register(CurrentUser me, @Validated @RequestBody RegisterRequest request) {
		tokens.register(me.id(), request.token(), request.platform());
	}

	@DeleteMapping("/{token}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Stop sending to this device (call on sign-out)")
	public void unregister(CurrentUser me, @PathVariable String token) {
		tokens.unregister(me.id(), token);
	}
}
