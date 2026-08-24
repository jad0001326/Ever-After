import type { SupabaseSessionStorage } from "./session-storage";

const envelopeVersion = 1;
const markerValue = "everaft-installation-v1";
const maximumPlaintextBytes = 64 * 1024;

export type SessionEnvelopeStore = Readonly<{
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clearPrefix(prefix: string): Promise<void>;
}>;

export type SessionKeyStore = Readonly<{
  getKey(alias: string): Promise<string | null>;
  setKey(alias: string, value: string): Promise<void>;
  removeKey(alias: string): Promise<void>;
}>;

export type SessionEnvelopeCipher = Readonly<{
  generateKey(): Promise<string>;
  seal(plaintext: string, key: string, additionalData: string): Promise<string>;
  open(ciphertext: string, key: string, additionalData: string): Promise<string>;
}>;

export type EncryptedSessionStorage = SupabaseSessionStorage & Readonly<{
  clearAll(): Promise<void>;
}>;

export type EncryptedSessionStorageOptions = Readonly<{
  namespace: string;
  envelopeStore: SessionEnvelopeStore;
  keyStore: SessionKeyStore;
  cipher: SessionEnvelopeCipher;
  onRecovery?: (reason: "missing_key" | "invalid_envelope" | "decryption_failed") => void;
}>;

type StoredEnvelope = Readonly<{
  version: 1;
  algorithm: "AES-256-GCM";
  ciphertext: string;
}>;

export function createEncryptedSessionStorage(
  options: EncryptedSessionStorageOptions,
): EncryptedSessionStorage {
  validateNamespace(options.namespace);
  const prefix = `everaft:auth:${options.namespace}:`;
  const envelopePrefix = `${prefix}envelope:`;
  const markerKey = `${prefix}installation`;
  const keyAlias = `everaft.auth.${options.namespace}.envelope-key`;
  let operation = Promise.resolve();
  let initialized = false;

  function serialized<T>(work: () => Promise<T>) {
    const result = operation.then(work, work);
    operation = result.then(() => undefined, () => undefined);
    return result;
  }

  async function initialize() {
    if (initialized) return;
    const marker = await options.envelopeStore.getItem(markerKey);
    if (marker !== markerValue) {
      // Keychain data can survive an iOS reinstall. A missing ordinary-storage
      // marker therefore means every surviving key and envelope is stale.
      await options.keyStore.removeKey(keyAlias);
      await options.envelopeStore.clearPrefix(envelopePrefix);
      await options.envelopeStore.setItem(markerKey, markerValue);
    }
    initialized = true;
  }

  async function clearEncryptedState() {
    const results = await Promise.allSettled([
      options.keyStore.removeKey(keyAlias),
      options.envelopeStore.clearPrefix(envelopePrefix),
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }

  async function recoverFromUnreadableState(
    reason: "missing_key" | "invalid_envelope" | "decryption_failed",
  ) {
    await clearEncryptedState();
    try {
      options.onRecovery?.(reason);
    } catch {
      // Diagnostics must never block fail-closed secret removal.
    }
    return null;
  }

  return Object.freeze({
    getItem(key: string) {
      return serialized(async () => {
        const storageKey = validateStorageKey(key);
        await initialize();
        const committedKey = `${envelopePrefix}${storageKey}`;
        const pendingKey = `${committedKey}:pending`;
        await options.envelopeStore.removeItem(pendingKey);
        const encodedEnvelope = await options.envelopeStore.getItem(committedKey);
        if (!encodedEnvelope) return null;

        const encryptionKey = await options.keyStore.getKey(keyAlias);
        if (!encryptionKey) return recoverFromUnreadableState("missing_key");

        const envelope = parseEnvelope(encodedEnvelope);
        if (!envelope) return recoverFromUnreadableState("invalid_envelope");
        try {
          return await options.cipher.open(
            envelope.ciphertext,
            encryptionKey,
            additionalData(options.namespace, storageKey),
          );
        } catch {
          return recoverFromUnreadableState("decryption_failed");
        }
      });
    },

    setItem(key: string, value: string) {
      return serialized(async () => {
        const storageKey = validateStorageKey(key);
        if (new TextEncoder().encode(value).byteLength > maximumPlaintextBytes) {
          throw new Error("Session storage value exceeds the EverAft safety limit.");
        }
        await initialize();
        let encryptionKey = await options.keyStore.getKey(keyAlias);
        if (!encryptionKey) {
          // A restored envelope without its device-bound key is unusable and
          // must not be mixed with a newly generated key.
          await options.envelopeStore.clearPrefix(envelopePrefix);
          encryptionKey = await options.cipher.generateKey();
          await options.keyStore.setKey(keyAlias, encryptionKey);
        }

        const ciphertext = await options.cipher.seal(
          value,
          encryptionKey,
          additionalData(options.namespace, storageKey),
        );
        const envelope: StoredEnvelope = {
          version: envelopeVersion,
          algorithm: "AES-256-GCM",
          ciphertext,
        };
        const committedKey = `${envelopePrefix}${storageKey}`;
        const pendingKey = `${committedKey}:pending`;
        const encodedEnvelope = JSON.stringify(envelope);
        await options.envelopeStore.setItem(pendingKey, encodedEnvelope);
        await options.envelopeStore.setItem(committedKey, encodedEnvelope);
        await options.envelopeStore.removeItem(pendingKey);
      });
    },

    removeItem(key: string) {
      return serialized(async () => {
        const storageKey = validateStorageKey(key);
        await initialize();
        const committedKey = `${envelopePrefix}${storageKey}`;
        await options.envelopeStore.removeItem(`${committedKey}:pending`);
        await options.envelopeStore.removeItem(committedKey);
      });
    },

    clearAll() {
      return serialized(async () => {
        await clearEncryptedState();
      });
    },
  });
}

function additionalData(namespace: string, key: string) {
  return `everaft-auth-envelope|v${envelopeVersion}|${namespace}|${key}`;
}

function parseEnvelope(raw: string): StoredEnvelope | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredEnvelope>;
  if (
    candidate.version !== envelopeVersion
    || candidate.algorithm !== "AES-256-GCM"
    || typeof candidate.ciphertext !== "string"
    || !candidate.ciphertext
  ) return null;
  return candidate as StoredEnvelope;
}

function validateNamespace(namespace: string) {
  if (!/^[a-z0-9._-]{1,64}$/i.test(namespace)) {
    throw new Error("Encrypted session namespace is invalid.");
  }
}

function validateStorageKey(key: string) {
  if (!key || key.length > 512 || key.includes("\0")) {
    throw new Error("Session storage key is invalid.");
  }
  return key;
}
