import {
  decodeDevicePlan,
  decodeRecoveryFixture,
  DevicePlanCorruptError,
  encodeDevicePlan,
  encodeRecoveryFixture,
} from "./device-plan-codec";
import type { DevicePlanData } from "./device-plan-model";
import {
  currentDevicePlanStorageVersion,
  type DevicePlanStorage,
  type StoredDevicePlanRow,
} from "./device-plan-storage";

export type DevicePlanRecord = Readonly<{
  data: DevicePlanData;
  revision: number;
  savedAt: string;
}>;

export type DevicePlanLoadResult =
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "ready"; record: DevicePlanRecord }>
  | Readonly<{ kind: "recovered"; reason: "corrupt_cache" | "restored_without_secret" }>;

export class DevicePlanConflictError extends Error {
  constructor() {
    super("The device plan changed before this save completed.");
    this.name = "DevicePlanConflictError";
  }
}

export type DevicePlanRepository = Readonly<{
  load(): Promise<DevicePlanLoadResult>;
  create(data: DevicePlanData): Promise<DevicePlanRecord>;
  save(data: DevicePlanData, expectedRevision: number): Promise<DevicePlanRecord>;
  exportRecoveryFixture(): Promise<string>;
  importRecoveryFixture(encoded: string): Promise<DevicePlanRecord>;
}>;

export function createDevicePlanRepository(options: Readonly<{
  storage: DevicePlanStorage;
  installationHash: string;
  digest(value: string): Promise<string>;
  now?: () => Date;
}>): DevicePlanRepository {
  const now = options.now ?? (() => new Date());
  let initialized = false;
  let operation = Promise.resolve();

  function serialized<T>(work: () => Promise<T>) {
    const result = operation.then(work, work);
    operation = result.then(() => undefined, () => undefined);
    return result;
  }

  async function initialize() {
    if (initialized) return;
    const version = await options.storage.getVersion();
    if (version === 0) {
      await options.storage.createLatest();
    } else if (version === 1) {
      const legacy = await options.storage.readLegacy();
      await options.storage.replaceLegacyWithLatest();
      if (legacy) {
        try {
          decodeDevicePlan(legacy.payload);
          const checksum = await options.digest(legacy.payload);
          await options.storage.writeCurrent({
            payload: legacy.payload,
            checksum,
            installationHash: options.installationHash,
            revision: 1,
            updatedAt: legacy.updatedAt,
          }, null);
        } catch {
          await options.storage.recoverCurrent("schema_migration_corrupt", now().toISOString());
        }
      }
    } else if (version !== currentDevicePlanStorageVersion) {
      throw new Error("This plan database was created by an unsupported app version.");
    }
    initialized = true;
  }

  async function loadCurrent(): Promise<DevicePlanLoadResult> {
    await initialize();
    const row = await options.storage.readCurrent();
    if (!row) return { kind: "empty" };
    if (row.installationHash !== options.installationHash) {
      await options.storage.recoverCurrent("restored_without_secret", now().toISOString());
      return { kind: "recovered", reason: "restored_without_secret" };
    }
    const checksum = await options.digest(row.payload);
    if (checksum !== row.checksum) return recoverCorrupt();
    try {
      const data = decodeDevicePlan(row.payload);
      return {
        kind: "ready",
        record: { data, revision: row.revision, savedAt: row.updatedAt },
      };
    } catch (error) {
      if (!(error instanceof DevicePlanCorruptError)) throw error;
      return recoverCorrupt();
    }
  }

  async function recoverCorrupt(): Promise<DevicePlanLoadResult> {
    await options.storage.recoverCurrent("corrupt_cache", now().toISOString());
    return { kind: "recovered", reason: "corrupt_cache" };
  }

  async function write(
    data: DevicePlanData,
    expectedRevision: number | null,
  ): Promise<DevicePlanRecord> {
    await initialize();
    const payload = encodeDevicePlan(data);
    const savedAt = now().toISOString();
    const revision = expectedRevision === null ? 1 : expectedRevision + 1;
    const row: StoredDevicePlanRow = {
      payload,
      checksum: await options.digest(payload),
      installationHash: options.installationHash,
      revision,
      updatedAt: savedAt,
    };
    if (!await options.storage.writeCurrent(row, expectedRevision)) {
      throw new DevicePlanConflictError();
    }
    return { data, revision, savedAt };
  }

  return Object.freeze({
    load: () => serialized(loadCurrent),
    create: (data) => serialized(() => write(data, null)),
    save: (data, expectedRevision) => serialized(() => write(data, expectedRevision)),
    exportRecoveryFixture: () => serialized(async () => {
      const state = await loadCurrent();
      if (state.kind !== "ready") throw new Error("There is no device plan to export.");
      return encodeRecoveryFixture(state.record.data, now());
    }),
    importRecoveryFixture: (encoded) => serialized(async () => {
      const data = decodeRecoveryFixture(encoded);
      await initialize();
      const current = await options.storage.readCurrent();
      return write(data, current?.revision ?? null);
    }),
  });
}
