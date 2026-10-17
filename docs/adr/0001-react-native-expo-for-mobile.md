# 0001: React Native + Expo for the mobile app

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
The app must feel native and polished on iPhone (the primary test device) and
should be able to ship on Android without a rewrite. The development Mac does
not have Xcode installed.

## Options considered
1. **Native iOS (SwiftUI)**: best platform fidelity, but iPhone only and needs Xcode for every build.
2. **Native Android (Kotlin)**: shares the JVM with the backend, but Android only.
3. **Flutter**: cross-platform, but its Dart ecosystem is smaller in industry.
4. **React Native + Expo (TypeScript)**: cross-platform, native UI components, large ecosystem, and you can run the app on a physical iPhone through Expo Go without Xcode.

## Decision
React Native with Expo and TypeScript, using Expo Router for navigation.

## Consequences
- One codebase for iOS and Android, and fast iteration with hot reload on a real device.
- TypeScript types can be generated from the backend's OpenAPI spec, keeping client and server in sync.
- Some deeply native features (e.g. home-screen widgets) would need custom native modules later. That is acceptable.
