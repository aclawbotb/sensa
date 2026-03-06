# Sensa Mobile (iPhone Wrapper)

This is a lightweight React Native / Expo wrapper plan for iPhone haptics.

## Why
Mobile Safari haptics are limited. A native wrapper gives stronger tactile control.

## Suggested stack
- Expo + React Native + TypeScript
- `expo-haptics` for vibration patterns
- `react-native-webview` to embed the Sensa web UI

## MVP behavior
1. Load web UI in WebView
2. Web sends haptic events via `window.ReactNativeWebView.postMessage(...)`
3. Native layer maps intensity to `Haptics.impactAsync(...)` / notification haptics
4. Tap reveal triggers stronger pattern

## Quick bootstrap (manual)
```bash
npx create-expo-app@latest sensa-mobile --template
cd sensa-mobile
npx expo install expo-haptics react-native-webview
```

Then copy `App.tsx` from this folder as a starting point.
