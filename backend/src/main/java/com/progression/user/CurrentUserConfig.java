package com.progression.user;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registers {@link CurrentUserArgumentResolver} with Spring MVC. */
@Configuration
class CurrentUserConfig implements WebMvcConfigurer {

	private final UserService userService;

	CurrentUserConfig(UserService userService) {
		this.userService = userService;
	}

	@Override
	public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
		resolvers.add(new CurrentUserArgumentResolver(userService));
	}
}
