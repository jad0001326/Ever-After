import {
  createEncryptedSessionStorage,
  type SessionEnvelopeCipher,
  type SessionEnvelopeStore,
  type SessionKeyStore,
} from "./encrypted-session-storage";

function createFixture() {
  const envelopes = new Map<string, string>();
  const keys = new Map<string, string>();
  let failSetKey: string | null = null;
  let generatedKeys = 0;
  let nonce = 0;

  const envelopeStore: SessionEnvelopeStore = {
    async getItem(key) { return envelopes.get(key) ?? null; },
    async setItem(key, value) {
      if (key === failSetKey) {
        failSetKey = null;
        throw new Error("interrupted write");
      }
      envelopes.set(key, value);
    },
    async removeItem(key) { envelopes.delete(key); },
    async clearPrefix(prefix) {
      for (const key of envelopes.keys()) {
        if (key.startsWith(prefix)) envelopes.delete(key);
      }
    },
  };
  const keyStore: SessionKeyStore = {
    async getKey(alias) { return keys.get(alias) ?? null; },
    async setKey(alias, value) { keys.set(alias, value); },
    async removeKey(alias) { keys.delete(alias); },
  };
  const cipher: SessionEnvelopeCipher = {
    async generateKey() { return `fixture-key-${++generatedKeys}`; },
    async seal(plaintext, key, aad) {
      const sequence = ++nonce;
      const bytes = new TextEncoder().encode(plaintext);
      const mask = checksum(`${key}|${aad}|${sequence}`) & 0xff;
      const ciphertext = Array.from(bytes, (byte) => (byte ^ mask).toString(16).padStart(2, "0")).join("");
      const tag = checksum(`${key}|${aad}|${sequence}|${ciphertext}`);
      return `${sequence}.${tag}.${ciphertext}`;
    },
    async open(payload, key, aad) {
      const [sequenceRaw, tagRaw, ciphertext, ...extra] = payload.split(".");
      const sequence = Number(sequenceRaw);
      if (!sequence || !tagRaw || !ciphertext || extra.length) throw new Error("corrupt");
      if (Number(tagRaw) !== checksum(`${key}|${aad}|${sequence}|${ciphertext}`)) {
        throw new Error("authentication failed");
      }
      const mask = checksum(`${key}|${aad}|${sequence}`) & 0xff;
      const bytes = new Uint8Array(ciphertext.match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) ^ mask) ?? []);
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    },
  };

  return {
    envelopes,
    keys,
    envelopeStore,
    keyStore,
    cipher,
    failNextSet(key: string) { failSetKey = key; },
    create(namespace = "production") {
      return createEncryptedSessionStorage({ namespace, envelopeStore, keyStore, cipher });
    },
  };
}

describe("encrypted session storage", () => {
  it("round-trips a maximum realistic session without plaintext at rest", async () => {
    const fixture = createFixture();
    const storage = fixture.create();
    const session = JSON.stringify({
      access_token: "access-token-must-not-appear-at-rest",
      refresh_token: "refresh-token-must-not-appear-at-rest",
      padding: "x".repeat(16 * 1024),
    });

    await storage.setItem("supabase-auth-token", session);

    await expect(storage.getItem("supabase-auth-token")).resolves.toBe(session);
    const atRest = JSON.stringify(Object.fromEntries(fixture.envelopes));
    expect(atRest).not.toContain("access-token-must-not-appear-at-rest");
    expect(atRest).not.toContain("refresh-token-must-not-appear-at-rest");
  });

  it("cold-restores and refresh-rotates with a fresh authenticated envelope", async () => {
    const fixture = createFixture();
    await fixture.create().setItem("auth-token", "session-one");
    const firstEnvelope = envelopeValue(fixture.envelopes, "auth-token");

    const restored = fixture.create();
    await expect(restored.getItem("auth-token")).resolves.toBe("session-one");
    await restored.setItem("auth-token", "session-two");

    expect(envelopeValue(fixture.envelopes, "auth-token")).not.toBe(firstEnvelope);
    await expect(restored.getItem("auth-token")).resolves.toBe("session-two");
  });

  it("preserves the last committed session after an interrupted write", async () => {
    const fixture = createFixture();
    const storage = fixture.create();
    await storage.setItem("auth-token", "previous-session");
    const committedKey = envelopeKey(fixture.envelopes, "auth-token");
    fixture.failNextSet(committedKey);

    await expect(storage.setItem("auth-token", "next-session")).rejects.toThrow("interrupted");
    await expect(storage.getItem("auth-token")).resolves.toBe("previous-session");
    expect([...fixture.envelopes.keys()].some((key) => key.endsWith(":pending"))).toBe(false);
  });

  it("purges a corrupted envelope and its key without returning partial data", async () => {
    const fixture = createFixture();
    const storage = fixture.create();
    await storage.setItem("auth-token", "valid-session");
    fixture.envelopes.set(envelopeKey(fixture.envelopes, "auth-token"), "not-json");

    await expect(storage.getItem("auth-token")).resolves.toBeNull();
    expect(fixture.keys.size).toBe(0);
    expect([...fixture.envelopes.keys()].some((key) => key.includes(":envelope:"))).toBe(false);
  });

  it("does not let a recovery observer block secret deletion", async () => {
    const fixture = createFixture();
    const storage = createEncryptedSessionStorage({
      namespace: "production",
      envelopeStore: fixture.envelopeStore,
      keyStore: fixture.keyStore,
      cipher: fixture.cipher,
      onRecovery: () => { throw new Error("observer failed"); },
    });
    await storage.setItem("auth-token", "valid-session");
    fixture.envelopes.set(envelopeKey(fixture.envelopes, "auth-token"), "not-json");

    await expect(storage.getItem("auth-token")).resolves.toBeNull();
    expect(fixture.keys.size).toBe(0);
    expect([...fixture.envelopes.keys()].some((key) => key.includes(":envelope:"))).toBe(false);
  });

  it("fails closed and purges every envelope when the device key is wrong", async () => {
    const fixture = createFixture();
    const storage = fixture.create();
    await storage.setItem("auth-token", "account-a-session");
    const [alias] = fixture.keys.keys();
    fixture.keys.set(alias, "wrong-device-key");

    await expect(storage.getItem("auth-token")).resolves.toBeNull();
    expect(fixture.keys.size).toBe(0);
    expect([...fixture.envelopes.keys()].some((key) => key.includes(":envelope:"))).toBe(false);
  });

  it("deletes surviving secure material when the installation marker is absent", async () => {
    const fixture = createFixture();
    await fixture.create().setItem("auth-token", "old-install-session");
    for (const key of fixture.envelopes.keys()) {
      if (key.endsWith(":installation")) fixture.envelopes.delete(key);
    }

    const reinstalled = fixture.create();
    await expect(reinstalled.getItem("auth-token")).resolves.toBeNull();
    expect(fixture.keys.size).toBe(0);
    expect(JSON.stringify(Object.fromEntries(fixture.envelopes))).not.toContain("old-install-session");
  });

  it("purges a restored envelope when Android backup has no device key", async () => {
    const fixture = createFixture();
    await fixture.create().setItem("auth-token", "backed-up-session");
    fixture.keys.clear();

    const restored = fixture.create();
    await expect(restored.getItem("auth-token")).resolves.toBeNull();
    expect([...fixture.envelopes.keys()].some((key) => key.includes(":envelope:"))).toBe(false);
  });

  it("isolates namespaces and destroys all encrypted state on explicit logout", async () => {
    const fixture = createFixture();
    const first = fixture.create("account-a");
    const second = fixture.create("account-b");
    await first.setItem("auth-token", "first-session");
    await second.setItem("auth-token", "second-session");

    await expect(first.getItem("auth-token")).resolves.toBe("first-session");
    await expect(second.getItem("auth-token")).resolves.toBe("second-session");
    await first.clearAll();
    await expect(first.getItem("auth-token")).resolves.toBeNull();
    await expect(second.getItem("auth-token")).resolves.toBe("second-session");
  });

  it("rejects an oversized write without replacing the committed session", async () => {
    const fixture = createFixture();
    const storage = fixture.create();
    await storage.setItem("auth-token", "safe-session");

    await expect(storage.setItem("auth-token", "x".repeat(64 * 1024 + 1))).rejects.toThrow(
      "safety limit",
    );
    await expect(storage.getItem("auth-token")).resolves.toBe("safe-session");
  });
});

function envelopeKey(values: Map<string, string>, storageKey: string) {
  const key = [...values.keys()].find((candidate) => (
    candidate.includes(":envelope:")
    && candidate.endsWith(storageKey)
    && !candidate.endsWith(":pending")
  ));
  if (!key) throw new Error("Committed envelope is missing.");
  return key;
}

function envelopeValue(values: Map<string, string>, storageKey: string) {
  return values.get(envelopeKey(values, storageKey));
}

function checksum(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
