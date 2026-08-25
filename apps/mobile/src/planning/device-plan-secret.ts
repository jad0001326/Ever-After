import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const secretAlias = "everaft.device-plan.installation-secret.v1";

export type DevicePlanSecretStore = Readonly<{
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}>;

export function createExpoDevicePlanSecretStore(): DevicePlanSecretStore {
  return Object.freeze({
    get: () => SecureStore.getItemAsync(secretAlias),
    set: (value) => SecureStore.setItemAsync(secretAlias, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
  });
}

export async function getDevicePlanInstallationHash(
  store: DevicePlanSecretStore,
) {
  let secret = await store.get();
  if (!secret) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await store.set(secret);
  }
  return digestDevicePlanValue(secret);
}

export function digestDevicePlanValue(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}
