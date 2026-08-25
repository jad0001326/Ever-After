import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NativeAuthProvider, useNativeAuth } from "../src/auth/NativeAuthProvider";
import { useAppTheme } from "../src/design/use-app-theme";
import { SessionRestoringScreen } from "../src/features/auth/SessionRestoringScreen";
import { DevicePlanProvider } from "../src/planning/DevicePlanProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DevicePlanProvider>
        <NativeAuthProvider>
          <AuthAwareRootNavigator />
        </NativeAuthProvider>
      </DevicePlanProvider>
    </SafeAreaProvider>
  );
}

function AuthAwareRootNavigator() {
  const auth = useNativeAuth();
  const { colors, isDark } = useAppTheme();
  const restoring = auth.availability === "configured"
    && (auth.snapshot.status === "idle" || auth.snapshot.status === "restoring");

  if (restoring) return <SessionRestoringScreen />;

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
