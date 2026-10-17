# 0009: Push via Expo, triggered by domain events after commit

- **Status:** Accepted
- **Date:** 2026-10-17

## Context
Users should hear about friend requests, accepted invites, and friends' new
personal records, and get a "rest over" alert when they've left the app
mid-rest. Notifications must never block or fail the action that caused them,
and must never announce something that didn't actually get saved.

## Options considered
- **Delivery:** talk to APNs and FCM directly (two protocols, credential
  management on our server) vs. **Expo's push service** (one HTTPS API and
  one token format; Expo holds the platform credentials).
- **Triggering:** call a notifier from inside `FriendService`/`WorkoutService`
  vs. **publish domain events** that a separate module listens to.
- **Rest alert:** server-scheduled push vs. **local notification** on the device.

## Decision
- Expo push service via `ExpoPushSender` (`RestClient`, batches of 100,
  `DeviceNotRegistered` tickets delete the token).
- Services publish `FriendEvents.RequestSent`, `RequestAccepted` and
  `WorkoutSavedEvent`. `NotificationService` handles them with
  `@TransactionalEventListener` (runs only after commit) and `@Async` (off the
  request thread). Preferences are checked per recipient and per type.
- PR pushes fire only on a workout's **first** save and only if it started in
  the last 48 hours, so edits, sync retries and back-filled history stay quiet.
- The rest alert is a local notification synced to the rest-timer store.

## Consequences
- Requests stay fast, and nobody is notified about rolled-back work.
- The social and workout modules don't depend on notifications. A new notification
  type means a new listener, not changes to the feature.
- Delivery receipts (Expo's second-stage check) aren't polled yet; tickets
  catch the common dead-token case.
- Remote push on iPhone needs an Expo project ID and, in practice, a
  development build with Apple push credentials (paid Apple Developer Program).
  Local rest alerts work everywhere, including Expo Go.
