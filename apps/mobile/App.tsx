import React from "react";
import { SafeAreaView } from "react-native";
import { WebView } from "react-native-webview";
import * as Haptics from "expo-haptics";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#05060a" }}>
      <WebView
        source={{ uri: "https://YOUR-SENSA-URL" }}
        onMessage={async (event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.type === "haptic.update") {
              const intensity = Number(data.intensity ?? 0);
              if (intensity > 0.7) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              } else if (intensity > 0.4) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } else if (intensity > 0.12) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
            if (data?.type === "reveal") {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch {
            // no-op
          }
        }}
      />
    </SafeAreaView>
  );
}
