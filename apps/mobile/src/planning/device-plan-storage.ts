import type { SQLiteDatabase } from "expo-sqlite";

export const currentDevicePlanStorageVersion = 2;

export type StoredDevicePlanRow = Readonly<{
  payload: string;
  checksum: string;
  installationHash: string;
  revision: number;
  updatedAt: string;
}>;

export type LegacyDevicePlanRow = Readonly<{
  payload: string;
  updatedAt: string;
}>;

export type DevicePlanStorage = Readonly<{
  getVersion(): Promise<number>;
  createLatest(): Promise<void>;
  readLegacy(): Promise<LegacyDevicePlanRow | null>;
  replaceLegacyWithLatest(): Promise<void>;
  readCurrent(): Promise<StoredDevicePlanRow | null>;
  writeCurrent(row: StoredDevicePlanRow, expectedRevision: number | null): Promise<boolean>;
  recoverCurrent(reason: string, observedAt: string): Promise<void>;
}>;

type CurrentRow = {
  payload: string;
  checksum: string;
  installation_hash: string;
  revision: number;
  updated_at: string;
};

type LegacyRow = { payload: string; updated_at: string };

export function createSqliteDevicePlanStorage(database: SQLiteDatabase): DevicePlanStorage {
  return Object.freeze({
    async getVersion() {
      const row = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      return row?.user_version ?? 0;
    },

    async createLatest() {
      await configureDatabase(database);
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await createLatestSchema(transaction);
        await transaction.execAsync(`PRAGMA user_version = ${currentDevicePlanStorageVersion}`);
      });
    },

    async readLegacy() {
      const row = await database.getFirstAsync<LegacyRow>(
        "SELECT payload, updated_at FROM device_plan WHERE id = 'current' LIMIT 1",
      );
      return row ? { payload: row.payload, updatedAt: row.updated_at } : null;
    },

    async replaceLegacyWithLatest() {
      await configureDatabase(database);
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync("DROP TABLE IF EXISTS device_plan");
        await createLatestSchema(transaction);
        await transaction.execAsync(`PRAGMA user_version = ${currentDevicePlanStorageVersion}`);
      });
    },

    async readCurrent() {
      const row = await database.getFirstAsync<CurrentRow>(
        `SELECT payload, checksum, installation_hash, revision, updated_at
         FROM device_plan WHERE id = 'current' LIMIT 1`,
      );
      return row ? {
        payload: row.payload,
        checksum: row.checksum,
        installationHash: row.installation_hash,
        revision: row.revision,
        updatedAt: row.updated_at,
      } : null;
    },

    async writeCurrent(row, expectedRevision) {
      if (expectedRevision === null) {
        const result = await database.runAsync(
          `INSERT OR IGNORE INTO device_plan
           (id, payload, checksum, installation_hash, revision, updated_at)
           VALUES ('current', ?, ?, ?, ?, ?)`,
          row.payload,
          row.checksum,
          row.installationHash,
          row.revision,
          row.updatedAt,
        );
        return result.changes === 1;
      }
      const result = await database.runAsync(
        `UPDATE device_plan SET payload = ?, checksum = ?, installation_hash = ?,
          revision = ?, updated_at = ? WHERE id = 'current' AND revision = ?`,
        row.payload,
        row.checksum,
        row.installationHash,
        row.revision,
        row.updatedAt,
        expectedRevision,
      );
      return result.changes === 1;
    },

    async recoverCurrent(reason, observedAt) {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync("DELETE FROM device_plan WHERE id = 'current'");
        await transaction.runAsync(
          "INSERT INTO device_plan_recovery (reason, observed_at) VALUES (?, ?)",
          reason.slice(0, 80),
          observedAt,
        );
      });
    },
  });
}

async function createLatestSchema(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS device_plan (
      id TEXT PRIMARY KEY NOT NULL CHECK (id = 'current'),
      payload TEXT NOT NULL,
      checksum TEXT NOT NULL,
      installation_hash TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision > 0),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS device_plan_recovery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reason TEXT NOT NULL,
      observed_at TEXT NOT NULL
    );
  `);
}

async function configureDatabase(database: SQLiteDatabase) {
  // SQLite rejects journal-mode changes from inside a transaction.
  await database.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
}
