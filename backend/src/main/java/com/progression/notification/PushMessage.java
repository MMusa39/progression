package com.progression.notification;

import java.util.Map;

/**
 * One notification for one device.
 *
 * @param to    Expo push token, e.g. {@code ExponentPushToken[xxxxxxxx]}
 * @param data  delivered to the app (not shown); the app reads {@code path} to open the right screen on tap
 */
public record PushMessage(String to, String title, String body, Map<String, Object> data) {
}
