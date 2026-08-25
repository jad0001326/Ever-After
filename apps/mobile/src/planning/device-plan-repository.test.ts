import { createPlanningDashboardSnapshot } from "@everaft/planning-domain/planning-workspace/snapshot";

import { encodeDevicePlan } from "./device-plan-codec";
import { createDevicePlan } from "./device-plan-model";
import {
  createDevicePlanRepository,
  DevicePlanConflictError,
} from "./device-plan-repository";
import type {
  DevicePlanStorage,
  LegacyDevicePlanRow,
  StoredDevicePlanRow,
} from "./device-plan-storage";

const timestamp = "2026-08-24T10:00:00.000Z";

describe("device plan repository", () => {
  it("creates and reopens one useful plan after a process restart", async () => {
    const storage = new MemoryDevicePlanStorage();
    const repository = repositoryFor(storage);
    const created = await repository.create(examplePlan());

    expect(created.revision).toBe(1);
    const reopened = await repositoryFor(storage).load();
    expect(reopened).toMatchObject({
      kind: "ready",
      record: { revision: 1, data: { budgetPlan: { totalBudgetPence: 2_500_000 } } },
    });
  });

  it("persists an offline edit with optimistic revision protection", async () => {
    const storage = new MemoryDevicePlanStorage();
    const repository = repositoryFor(storage);
    const created = await repository.create(examplePlan());
    const changed = {
      ...created.data,
      budgetPlan: { ...created.data.budgetPlan, totalBudgetPence: 3_000_000 },
    };
    const saved = await repository.save(changed, created.revision);

    expect(saved.revision).toBe(2);
    await expect(repository.save(changed, created.revision)).rejects.toBeInstanceOf(DevicePlanConflictError);
    expect(await repositoryFor(storage).load()).toMatchObject({
      kind: "ready",
      record: { revision: 2, data: { budgetPlan: { totalBudgetPence: 3_000_000 } } },
    });
  });

  it("migrates a valid version-one payload into the latest schema", async () => {
    const plan = examplePlan();
    const storage = new MemoryDevicePlanStorage(1, {
      payload: encodeDevicePlan(plan),
      updatedAt: timestamp,
    });

    const loaded = await repositoryFor(storage).load();

    expect(storage.version).toBe(2);
    expect(loaded).toMatchObject({ kind: "ready", record: { revision: 1 } });
  });

  it("fails closed and clears a corrupt cache without retaining its payload", async () => {
    const storage = new MemoryDevicePlanStorage();
    const repository = repositoryFor(storage);
    await repository.create(examplePlan());
    storage.current = { ...storage.current!, payload: "{broken" };

    await expect(repositoryFor(storage).load()).resolves.toEqual({
      kind: "recovered",
      reason: "corrupt_cache",
    });
    expect(storage.current).toBeNull();
    expect(storage.recoveries).toEqual(["corrupt_cache"]);
  });

  it("clears a restored database that has no matching SecureStore secret", async () => {
    const storage = new MemoryDevicePlanStorage();
    await repositoryFor(storage).create(examplePlan());

    const restoredRepository = createDevicePlanRepository({
      storage,
      installationHash: "different-installation",
      digest,
      now: () => new Date(timestamp),
    });

    await expect(restoredRepository.load()).resolves.toEqual({
      kind: "recovered",
      reason: "restored_without_secret",
    });
    expect(storage.current).toBeNull();
  });

  it("round-trips a bounded development recovery fixture", async () => {
    const sourceStorage = new MemoryDevicePlanStorage();
    const source = repositoryFor(sourceStorage);
    await source.create(examplePlan());
    const fixture = await source.exportRecoveryFixture();

    const targetStorage = new MemoryDevicePlanStorage();
    const target = repositoryFor(targetStorage);
    const imported = await target.importRecoveryFixture(fixture);

    expect(imported.data.budgetPlan.totalBudgetPence).toBe(2_500_000);
    expect(await target.load()).toMatchObject({ kind: "ready", record: { revision: 1 } });
  });

  it("keeps the Today calculation on the shared domain boundary", () => {
    const data = examplePlan();
    const dashboard = createPlanningDashboardSnapshot(
      data.budgetPlan,
      data.workspace,
      new Date(timestamp),
    );
    expect(dashboard.budget).toMatchObject({
      totalBudgetPence: 2_500_000,
      remainingPence: 2_500_000,
      committedPence: 0,
      paidPence: 0,
    });
    expect(dashboard.recommendation.stage).toBe("venue");
  });
});

function examplePlan() {
  return createDevicePlan({
    weddingDate: "2027-08-14",
    weddingSeason: null,
    location: "Perthshire",
    guestCount: 90,
    totalBudgetPence: 2_500_000,
    priorities: ["venue", "photography"],
  }, new Date(timestamp));
}

function repositoryFor(storage: DevicePlanStorage) {
  return createDevicePlanRepository({
    storage,
    installationHash: "installation-a",
    digest,
    now: () => new Date(timestamp),
  });
}

async function digest(value: string) {
  return `digest:${value}`;
}

class MemoryDevicePlanStorage implements DevicePlanStorage {
  version: number;
  legacy: LegacyDevicePlanRow | null;
  current: StoredDevicePlanRow | null = null;
  recoveries: string[] = [];

  constructor(version = 0, legacy: LegacyDevicePlanRow | null = null) {
    this.version = version;
    this.legacy = legacy;
  }

  async getVersion() { return this.version; }
  async createLatest() { this.version = 2; }
  async readLegacy() { return this.legacy; }
  async replaceLegacyWithLatest() { this.version = 2; this.legacy = null; this.current = null; }
  async readCurrent() { return this.current; }
  async writeCurrent(row: StoredDevicePlanRow, expectedRevision: number | null) {
    if (expectedRevision === null) {
      if (this.current) return false;
    } else if (!this.current || this.current.revision !== expectedRevision) {
      return false;
    }
    this.current = row;
    return true;
  }
  async recoverCurrent(reason: string) {
    this.current = null;
    this.recoveries.push(reason);
  }
}
