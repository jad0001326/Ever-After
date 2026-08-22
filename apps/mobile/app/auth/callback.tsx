import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useNativeAuth } from "../../src/auth/NativeAuthProvider";
import { AuthCallbackScreen } from "../../src/features/auth/AuthCallbackScreen";

export default function AuthCallbackRoute() {
  const auth = useNativeAuth();
  const linkingUrl = Linking.useLinkingURL();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!linkingUrl || started.current) return;
    started.current = true;
    let active = true;
    void auth.completeCallback(linkingUrl).then((destination) => {
      Linking.clearInitialURL();
      if (active) router.replace((destination ?? "/(tabs)/today") as Href);
    }).catch(() => {
      Linking.clearInitialURL();
      if (active) router.replace({ pathname: "/auth/sign-in", params: { reason: "link_failed" } });
    });
    return () => { active = false; };
  }, [auth, linkingUrl, router]);

  return <AuthCallbackScreen />;
}
