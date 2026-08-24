import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import {
  createEncryptedSessionStorage,
  type SessionEnvelopeCipher,
  type SessionEnvelopeStore,
  type SessionKeyStore,
} from "./encrypted-session-storage";
import { decodeBase64 } from "./session-base64";

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  keychainService: "uk.co.everaft.mobile.auth-session",
  requireAuthentication: false,
};

export function createExpoSessionStorage(
  namespace: string,
  onRecovery?: (reason: "missing_key" | "invalid_envelope" | "decryption_failed") => void,
) {
  return createEncryptedSessionStorage({
    namespace,
    envelopeStore: asyncStorageEnvelopeStore,
    keyStore: secureSessionKeyStore,
    cipher: expoAesGcmCipher,
    onRecovery,
  });
}

export async function runExpoAesGcmDiagnostics() {
  let stage = "prepare";
  try {
    const plaintext = new TextEncoder().encode("everaft-aes-probe");
    const additionalData = new TextEncoder().encode("everaft-aes-probe-aad");
    stage = "generate-key";
    const key = await AESEncryptionKey.generate();
    stage = "encrypt";
    const sealed = await aesEncryptAsync(plaintext, key, {
      additionalData,
      nonce: { length: 12 },
      tagLength: 16,
    });
    stage = "decrypt-same-object";
    const sameObject = await aesDecryptAsync(sealed, key, {
      additionalData,
      output: "bytes",
    }).then((value) => new TextDecoder().decode(value) === "everaft-aes-probe", () => false);

    stage = "export-key";
    const encodedKey = await key.encoded("base64");
    stage = "import-key";
    const importedKey = await AESEncryptionKey.import(encodedKey, "base64");
    stage = "combine-envelope";
    const combinedBase64 = await sealed.combined("base64");
    stage = "restore-envelope";
    const restored = AESSealedData.fromCombined(decodeBase64(combinedBase64), {
      ivLength: 12,
      tagLength: 16,
    });
    stage = "decrypt-restored-envelope";
    const importedAndCombined = await aesDecryptAsync(restored, importedKey, {
      additionalData,
      output: "bytes",
    }).then((value) => new TextDecoder().decode(value) === "everaft-aes-probe", () => false);

    return Object.freeze({ sameObject, importedAndCombined, failureStage: null });
  } catch {
    return Object.freeze({
      sameObject: false,
      importedAndCombined: false,
      failureStage: stage,
    });
  }
}

const asyncStorageEnvelopeStore: SessionEnvelopeStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  async clearPrefix(prefix) {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  },
};

const secureSessionKeyStore: SessionKeyStore = {
  getKey: (alias) => SecureStore.getItemAsync(alias, secureStoreOptions),
  setKey: (alias, value) => SecureStore.setItemAsync(alias, value, secureStoreOptions),
  removeKey: (alias) => SecureStore.deleteItemAsync(alias, secureStoreOptions),
};

const expoAesGcmCipher: SessionEnvelopeCipher = {
  async generateKey() {
    const key = await AESEncryptionKey.generate();
    return key.encoded("base64");
  },
  async seal(plaintext, encodedKey, additionalData) {
    const key = await AESEncryptionKey.import(encodedKey, "base64");
    const sealed = await aesEncryptAsync(
      new TextEncoder().encode(plaintext),
      key,
      {
        additionalData: new TextEncoder().encode(additionalData),
        nonce: { length: 12 },
        tagLength: 16,
      },
    );
    return sealed.combined("base64");
  },
  async open(ciphertext, encodedKey, additionalData) {
    const key = await AESEncryptionKey.import(encodedKey, "base64");
    const sealed = AESSealedData.fromCombined(decodeBase64(ciphertext), {
      ivLength: 12,
      tagLength: 16,
    });
    const plaintext = await aesDecryptAsync(sealed, key, {
      additionalData: new TextEncoder().encode(additionalData),
      output: "bytes",
    });
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  },
};
