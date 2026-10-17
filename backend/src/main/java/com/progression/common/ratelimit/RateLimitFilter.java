package com.progression.common.ratelimit;

import java.io.IOException;
import java.time.Duration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Applies {@link RateLimiter} after authentication, keyed by the user (token
 * subject) or, for anonymous requests, the client IP (the load balancer's
 * X-Forwarded-For, resolved by {@code server.forward-headers-strategy}).
 * Over the limit: {@code 429} with {@code Retry-After} and a problem-details body.
 */
public class RateLimitFilter extends OncePerRequestFilter {

	private final RateLimiter limiter;
	private final RateLimiter.Limit general;
	private final RateLimiter.Limit lookups;

	public RateLimitFilter(RateLimiter limiter, RateLimitProperties properties) {
		this.limiter = limiter;
		this.general = new RateLimiter.Limit("all", properties.requestsPerMinute(), Duration.ofMinutes(1));
		this.lookups = new RateLimiter.Limit("lookup", properties.lookupsPerMinute(), Duration.ofMinutes(1));
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return request.getRequestURI().startsWith("/actuator/");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		String key = auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())
				? "user:" + auth.getName()
				: "ip:" + request.getRemoteAddr();
		long now = System.nanoTime();

		RateLimiter.Decision decision = limiter.tryAcquire(key, general, now);
		if (decision.allowed() && isLookup(request)) {
			decision = limiter.tryAcquire(key, lookups, now);
		}
		if (!decision.allowed()) {
			long seconds = Math.max(1, (long) Math.ceil(decision.retryAfter().toMillis() / 1000.0));
			response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
			response.setHeader("Retry-After", String.valueOf(seconds));
			response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
			response.getWriter().write("""
					{"type":"about:blank","title":"Too Many Requests","status":429,"detail":"Slow down a little and try again in %d seconds."}"""
					.formatted(seconds));
			return;
		}
		chain.doFilter(request, response);
	}

	/** Requests that cost more than a database read: external food lookups and full exports. */
	static boolean isLookup(HttpServletRequest request) {
		String path = request.getRequestURI();
		return path.startsWith("/api/v1/foods/barcode/") || path.startsWith("/api/v1/foods/search") || path.equals("/api/v1/me/export");
	}
}
