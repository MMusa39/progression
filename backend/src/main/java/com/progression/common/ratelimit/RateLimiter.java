package com.progression.common.ratelimit;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory token buckets, one per key (user or IP) and limit. Each bucket
 * holds up to {@code capacity} tokens and refills continuously at
 * {@code capacity} per {@code period}, so short bursts are fine but a sustained
 * flood is not.
 *
 * <p>Per instance: with several API instances each enforces its own budget,
 * which is fine as a guard against runaway clients. A global limit would move
 * to the load balancer (AWS WAF rate-based rules) or a shared store.
 */
public final class RateLimiter {

	public record Limit(String name, int capacity, Duration period) {
	}

	/** Result of a request for a token: allowed, or how long until one is available. */
	public record Decision(boolean allowed, Duration retryAfter) {
	}

	private static final long IDLE_NANOS = Duration.ofMinutes(15).toNanos();

	private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
	private final AtomicLong calls = new AtomicLong();

	public Decision tryAcquire(String key, Limit limit, long nowNanos) {
		if (calls.incrementAndGet() % 10_000 == 0) {
			evictIdle(nowNanos);
		}
		Bucket bucket = buckets.computeIfAbsent(limit.name() + ':' + key, k -> new Bucket(limit.capacity(), nowNanos));
		return bucket.take(limit, nowNanos);
	}

	int size() {
		return buckets.size();
	}

	void evictIdle(long nowNanos) {
		buckets.values().removeIf(b -> nowNanos - b.lastSeen > IDLE_NANOS);
	}

	private static final class Bucket {
		private double tokens;
		private long refilledAt;
		private volatile long lastSeen;

		Bucket(int capacity, long now) {
			this.tokens = capacity;
			this.refilledAt = now;
			this.lastSeen = now;
		}

		synchronized Decision take(Limit limit, long now) {
			double perNano = limit.capacity() / (double) limit.period().toNanos();
			tokens = Math.min(limit.capacity(), tokens + (now - refilledAt) * perNano);
			refilledAt = now;
			lastSeen = now;
			if (tokens >= 1) {
				tokens -= 1;
				return new Decision(true, Duration.ZERO);
			}
			long waitNanos = (long) Math.ceil((1 - tokens) / perNano);
			return new Decision(false, Duration.ofNanos(waitNanos));
		}
	}
}
