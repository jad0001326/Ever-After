import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createExpoSessionStorage,
  runExpoAesGcmDiagnostics,
} from "./expo-session-storage";

export type SessionStorageSelfTestResult = Readonly<{
  outcome: "passed" | "failed";
  checks: readonly Readonly<{ id: string; passed: boolean }>[];
  failure: string | null;
}>;

export async function runSessionStorageSelfTest(
  namespace = "device-smoke",
): Promise<SessionStorageSelfTestResult> {
  const prefix = `everaft:auth:${namespace}:`;
  const markerKey = `${prefix}installation`;
  const checks: { id: string; passed: boolean }[] = [];
  let failure: string | null = null;
  let recoveryReason: string | null = null;
  const createStorage = () => createExpoSessionStorage(namespace, (reason) => {
    recoveryReason = reason;
  });
  let storage = createStorage();
  const accessToken = "self-test-access-token-must-stay-encrypted";
  const refreshToken = "self-test-refresh-token-must-stay-encrypted";
  const firstSession = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    padding: "x".repeat(16 * 1024),
  });

  function verify(id: string, condition: boolean) {
    checks.push({ id, passed: condition });
    if (!condition) throw new Error(id);
  }

  try {
    const aes = await runExpoAesGcmDiagnostics();
    verify(`aes-diagnostic-${aes.failureStage ?? "completed"}`, aes.failureStage === null);
    verify("aes-same-object", aes.sameObject);
    verify("aes-key-import-and-envelope-restore", aes.importedAndCombined);
    await clearOrdinaryStorage(prefix);
    await storage.clearAll();
    await storage.setItem("auth-token", firstSession);
    const restoredMaximumSession = await storage.getItem("auth-token");
    verify("maximum-session-present", restoredMaximumSession !== null);
    verify("maximum-session-length", restoredMaximumSession?.length === firstSession.length);
    verify("maximum-session-round-trip", restoredMaximumSession === firstSession);

    const atRest = JSON.stringify(await valuesForPrefix(prefix));
    verify(
      "no-plaintext-token-at-rest",
      !atRest.includes(accessToken) && !atRest.includes(refreshToken),
    );

    storage = createStorage();
    verify("cold-restore", await storage.getItem("auth-token") === firstSession);

    const beforeRotation = JSON.stringify(await valuesForPrefix(prefix));
    await storage.setItem("auth-token", JSON.stringify({
      access_token: "rotated-access-token",
      refresh_token: "rotated-refresh-token",
    }));
    const afterRotation = JSON.stringify(await valuesForPrefix(prefix));
    verify("refresh-rotation-new-envelope", beforeRotation !== afterRotation);

    const committedKey = (await AsyncStorage.getAllKeys()).find((key) => (
      key.startsWith(`${prefix}envelope:`) && !key.endsWith(":pending")
    ));
    verify("committed-envelope-present", Boolean(committedKey));
    await AsyncStorage.setItem(committedKey!, "corrupted-envelope");
    verify("tamper-fails-closed", await storage.getItem("auth-token") === null);

    await storage.setItem("auth-token", firstSession);
    await AsyncStorage.removeItem(markerKey);
    storage = createStorage();
    verify("reinstall-clears-surviving-key", await storage.getItem("auth-token") === null);
  } catch (error) {
    failure = recoveryReason ?? (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)
      ? error.message
      : "storage-self-test-failed");
  } finally {
    try {
      await storage.clearAll();
      await clearOrdinaryStorage(prefix);
    } catch {
      failure ??= "storage-self-test-cleanup-failed";
    }
  }

  return Object.freeze({
    outcome: failure ? "failed" : "passed",
    checks: checks.map((check) => Object.freeze(check)),
    failure,
  });
}

async function valuesForPrefix(prefix: string) {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
  return keys.length ? AsyncStorage.multiGet(keys) : [];
}

async function clearOrdinaryStorage(prefix: string) {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
