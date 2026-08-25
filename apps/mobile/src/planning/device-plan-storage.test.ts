import type { SQLiteDatabase } from "expo-sqlite";

import { createSqliteDevicePlanStorage } from "./device-plan-storage";

describe("SQLite device plan storage", () => {
  it("configures WAL before opening the schema transaction", async () => {
    const events: string[] = [];
    let insideTransaction = false;
    const database = {
      async execAsync(sql: string) {
        if (insideTransaction && sql.includes("journal_mode")) {
          throw new Error("cannot change into wal mode from within a transaction");
        }
        events.push(sql.includes("journal_mode") ? "configure" : "schema");
      },
      async withExclusiveTransactionAsync(task: (transaction: SQLiteDatabase) => Promise<void>) {
        events.push("transaction:start");
        insideTransaction = true;
        try {
          await task(database as unknown as SQLiteDatabase);
        } finally {
          insideTransaction = false;
          events.push("transaction:end");
        }
      },
    } as unknown as SQLiteDatabase;

    await createSqliteDevicePlanStorage(database).createLatest();

    expect(events[0]).toBe("configure");
    expect(events).toEqual([
      "configure",
      "transaction:start",
      "schema",
      "schema",
      "transaction:end",
    ]);
  });
});
