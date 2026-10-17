package com.progression.notification;

import java.util.List;

/** Delivers push notifications. The production implementation calls Expo; tests swap in a recorder. */
public interface PushSender {

	/**
	 * Sends the messages and returns the tokens that turned out to be dead
	 * (app uninstalled, permission revoked), which the caller should forget.
	 */
	List<String> send(List<PushMessage> messages);
}
