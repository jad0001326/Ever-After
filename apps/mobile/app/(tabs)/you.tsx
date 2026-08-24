import { useRouter } from "expo-router";

import { useNativeAuth } from "../../src/auth/NativeAuthProvider";
import { YouScreen as YouAccountScreen } from "../../src/features/account/YouScreen";

export default function YouScreen() {
  const auth = useNativeAuth();
  const router = useRouter();
  return (
    <YouAccountScreen
      availability={auth.availability}
      onSignIn={() => router.push("/auth/sign-in")}
      sessionStatus={auth.snapshot.status}
    />
  );
}
