import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

import { useNativeAuth } from "../../src/auth/NativeAuthProvider";
import { sanitizeIntendedDestination } from "../../src/auth/intended-destination";
import { SignInScreen } from "../../src/features/auth/SignInScreen";

export default function SignInRoute() {
  const auth = useNativeAuth();
  const rememberIntendedDestination = auth.rememberIntendedDestination;
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string; reason?: string }>();
  const nextPath = typeof params.next === "string"
    ? sanitizeIntendedDestination(params.next)
    : null;

  useEffect(() => {
    if (nextPath) rememberIntendedDestination(nextPath);
  }, [nextPath, rememberIntendedDestination]);

  return (
    <SignInScreen
      availability={auth.availability}
      linkFailed={params.reason === "link_failed"}
      onContinueOnDevice={() => router.replace("/(tabs)/today")}
      onSignIn={async (email, password) => {
        const destination = await auth.signInWithPassword(email, password);
        router.replace((destination ?? "/(tabs)/today") as Href);
      }}
    />
  );
}
