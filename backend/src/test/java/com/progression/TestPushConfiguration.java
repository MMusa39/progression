package com.progression;

import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import com.progression.notification.PushMessage;
import com.progression.notification.PushSender;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;

/**
 * Test doubles for push notifications: a sender that records messages instead
 * of calling Expo, and a synchronous executor so {@code @Async} listeners finish
 * before the request returns, which makes assertions deterministic.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestPushConfiguration {

	/** Records every message; tokens in {@link #deadTokens} are reported back as unregistered. */
	public static class RecordingPushSender implements PushSender {

		public final List<PushMessage> sent = new CopyOnWriteArrayList<>();
		public final Set<String> deadTokens = ConcurrentHashMap.newKeySet();

		@Override
		public List<String> send(List<PushMessage> messages) {
			sent.addAll(messages);
			return messages.stream().map(PushMessage::to).filter(deadTokens::contains).toList();
		}

		/** Messages delivered to one device (tests use unique tokens, so this isolates them). */
		public List<PushMessage> to(String token) {
			return sent.stream().filter(m -> m.to().equals(token)).toList();
		}
	}

	@Bean
	@Primary
	RecordingPushSender recordingPushSender() {
		return new RecordingPushSender();
	}

	@Bean
	TaskExecutor taskExecutor() {
		return new SyncTaskExecutor();
	}
}
