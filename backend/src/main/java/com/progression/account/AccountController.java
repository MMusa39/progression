package com.progression.account;

import java.time.LocalDate;

import com.progression.user.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Account", description = "Export or delete all of your data")
public class AccountController {

	private final AccountService accounts;

	AccountController(AccountService accounts) {
		this.accounts = accounts;
	}

	@GetMapping(value = "/export", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Download everything you've stored, as one JSON document")
	public ResponseEntity<String> export(CurrentUser me) {
		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"progression-export-" + LocalDate.now() + ".json\"")
				.contentType(MediaType.APPLICATION_JSON)
				.body(accounts.export(me.id()));
	}

	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(summary = "Permanently delete your account and all of your data")
	public void delete(CurrentUser me) {
		accounts.delete(me.id());
	}
}
