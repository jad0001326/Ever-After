import { Stack } from "expo-router";

import { useNativeAuth } from "../../src/auth/NativeAuthProvider";

export default function AuthLayout() {
  const { snapshot } = useNativeAuth();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={snapshot.status !== "authenticated"}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Screen name="callback" />
    </Stack>
  );
}
