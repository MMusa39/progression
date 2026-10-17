package com.progression.notification;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Sends notifications through Expo's push service, which forwards them to
 * Apple (APNs) and Google (FCM). One HTTP call carries up to 100 messages.
 *
 * <p>Each message gets a "ticket" back. A ticket with error
 * {@code DeviceNotRegistered} means the token is dead, so it's reported back
 * for deletion. Expo also offers delivery receipts (checked ~15 minutes
 * later), which a production system would poll. Here they're left as future
 * work, since tickets already catch the common case.
 *
 * <p>Failures are logged and swallowed: a notification is never worth failing
 * the user's request over.
 */
@Component
class ExpoPushSender implements PushSender {

	private static final Logger log = LoggerFactory.getLogger(ExpoPushSender.class);
	static final int BATCH_SIZE = 100;

	private final RestClient http;
	private final PushProperties properties;

	ExpoPushSender(RestClient.Builder builder, PushProperties properties) {
		this.properties = properties;
		RestClient.Builder configured = builder.baseUrl(properties.expoUrl())
				.defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE);
		if (properties.accessToken() != null && !properties.accessToken().isBlank()) {
			configured.defaultHeader("Authorization", "Bearer " + properties.accessToken());
		}
		this.http = configured.build();
	}

	/** Expo's response: one ticket per message, in the same order. */
	record TicketResponse(List<Ticket> data) {
	}

	record Ticket(String status, String id, String message, Map<String, Object> details) {

		boolean deviceNotRegistered() {
			return "error".equals(status) && details != null && "DeviceNotRegistered".equals(details.get("error"));
		}
	}

	@Override
	public List<String> send(List<PushMessage> messages) {
		if (!properties.enabled() || messages.isEmpty()) {
			return List.of();
		}
		List<String> deadTokens = new ArrayList<>();
		for (int start = 0; start < messages.size(); start += BATCH_SIZE) {
			List<PushMessage> batch = messages.subList(start, Math.min(messages.size(), start + BATCH_SIZE));
			try {
				TicketResponse response = http.post()
						.contentType(MediaType.APPLICATION_JSON)
						.body(batch.stream().map(ExpoPushSender::toExpo).toList())
						.retrieve()
						.body(TicketResponse.class);
				if (response == null || response.data() == null) {
					continue;
				}
				for (int i = 0; i < response.data().size() && i < batch.size(); i++) {
					Ticket ticket = response.data().get(i);
					if (ticket.deviceNotRegistered()) {
						deadTokens.add(batch.get(i).to());
					}
					else if ("error".equals(ticket.status())) {
						log.warn("Push to {} failed: {}", redact(batch.get(i).to()), ticket.message());
					}
				}
			}
			catch (RestClientException ex) {
				log.warn("Expo push request failed for {} messages: {}", batch.size(), ex.getMessage());
			}
		}
		return deadTokens;
	}

	private static Map<String, Object> toExpo(PushMessage message) {
		return Map.of(
				"to", message.to(),
				"title", message.title(),
				"body", message.body(),
				"data", message.data(),
				"sound", "default");
	}

	/** Tokens identify a device; keep them out of logs. */
	private static String redact(String token) {
		return token.length() <= 12 ? "***" : token.substring(0, 12) + "…";
	}
}
