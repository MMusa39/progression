package com.progression.user;

import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * Lets controller methods declare a {@link CurrentUser} parameter. Reads the
 * verified JWT that Spring Security put in the security context and maps its
 * subject to an app user, creating that user on first sight.
 */
class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

	private final UserService userService;

	CurrentUserArgumentResolver(UserService userService) {
		this.userService = userService;
	}

	@Override
	public boolean supportsParameter(MethodParameter parameter) {
		return parameter.getParameterType().equals(CurrentUser.class);
	}

	@Override
	public CurrentUser resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
			NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
			// Unreachable while SecurityConfig requires authentication for every API route.
			throw new IllegalStateException("CurrentUser requested on an unauthenticated request");
		}
		AppUser user = userService.provision(jwt.getSubject(), jwt.getClaimAsString("email"));
		return new CurrentUser(user.getId(), user.getSubject());
	}
}
