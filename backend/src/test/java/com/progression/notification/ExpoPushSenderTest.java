package com.progression.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** The Expo HTTP contract: request shape, batching, and reading error tickets. */
class ExpoPushSenderTest {

	private static final String URL = "https://exp.host/--/api/v2/push/send";

	private MockRestServiceServer server;
	private ExpoPushSender sender;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder();
		server = MockRestServiceServer.bindTo(builder).build();
		sender = new ExpoPushSender(builder, new PushProperties(true, URL, "secret-token"));
	}

	@Test
	void sendsTheExpoMessageShapeAndReportsDeadTokens() {
		server.expect(requestTo(URL))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("Authorization", "Bearer secret-token"))
				.andExpect(content().json("""
						[{"to": "ExponentPushToken[a]", "title": "Hi", "body": "There", "sound": "default", "data": {"path": "/friends"}},
						 {"to": "ExponentPushToken[b]", "title": "Hi", "body": "There", "sound": "default", "data": {"path": "/friends"}}]
						"""))
				.andRespond(withSuccess("""
						{"data": [
						  {"status": "ok", "id": "ticket-1"},
						  {"status": "error", "message": "not registered", "details": {"error": "DeviceNotRegistered"}}
						]}
						""", MediaType.APPLICATION_JSON));

		List<String> dead = sender.send(List.of(message("a"), message("b")));

		assertThat(dead).containsExactly("ExponentPushToken[b]");
		server.verify();
	}

	@Test
	void splitsIntoBatchesOfOneHundred() {
		String ok = "{\"data\": [" + String.join(",", IntStream.range(0, 100).mapToObj(i -> "{\"status\":\"ok\"}").toList()) + "]}";
		server.expect(ExpectedCount.times(3), requestTo(URL)).andRespond(withSuccess(ok, MediaType.APPLICATION_JSON));

		sender.send(IntStream.range(0, 250).mapToObj(i -> message("t" + i)).toList());

		server.verify();
	}

	@Test
	void serverErrorsAreSwallowed() {
		server.expect(requestTo(URL)).andRespond(withServerError());

		assertThat(sender.send(List.of(message("a")))).isEmpty();
	}

	@Test
	void sendsNothingWhenDisabled() {
		RestClient.Builder builder = RestClient.builder();
		MockRestServiceServer strict = MockRestServiceServer.bindTo(builder).build();
		var disabled = new ExpoPushSender(builder, new PushProperties(false, URL, null));

		assertThat(disabled.send(List.of(message("a")))).isEmpty();
		strict.verify(); // no requests expected
	}

	private static PushMessage message(String id) {
		return new PushMessage("ExponentPushToken[" + id + "]", "Hi", "There", Map.of("path", "/friends"));
	}
}
