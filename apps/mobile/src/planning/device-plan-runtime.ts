import { openDatabaseAsync } from "expo-sqlite";

import { createDevicePlanRepository } from "./device-plan-repository";
import {
  createExpoDevicePlanSecretStore,
  digestDevicePlanValue,
  getDevicePlanInstallationHash,
} from "./device-plan-secret";
import { createSqliteDevicePlanStorage } from "./device-plan-storage";

let repositoryPromise: ReturnType<typeof createRuntimeRepository> | null = null;

export function getDevicePlanRepository() {
  repositoryPromise ??= createRuntimeRepository();
  return repositoryPromise;
}

async function createRuntimeRepository() {
  const [database, installationHash] = await Promise.all([
    openDatabaseAsync("everaft-device-plan.db"),
    getDevicePlanInstallationHash(createExpoDevicePlanSecretStore()),
  ]);
  return createDevicePlanRepository({
    storage: createSqliteDevicePlanStorage(database),
    installationHash,
    digest: digestDevicePlanValue,
  });
}
