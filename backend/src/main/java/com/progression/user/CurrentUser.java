package com.progression.user;

import java.util.UUID;

/**
 * The authenticated user making the current request. Add a parameter of this
 * type to any controller method to receive it. It's resolved from the access
 * token by {@link CurrentUserArgumentResolver}, never from client input, so a
 * client can't act as someone else by sending a different id.
 *
 * @param id      internal user id; use this to scope every query
 * @param subject identity-provider subject ({@code sub} claim)
 */
public record CurrentUser(UUID id, String subject) {
}
