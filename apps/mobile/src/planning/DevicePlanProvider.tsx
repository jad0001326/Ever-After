import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { DevicePlanData } from "./device-plan-model";
import type { DevicePlanLoadResult, DevicePlanRecord } from "./device-plan-repository";
import { getDevicePlanRepository } from "./device-plan-runtime";

type DevicePlanState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "empty"; recoveryNotice: string | null }>
  | Readonly<{ status: "ready"; record: DevicePlanRecord; saving: boolean }>
  | Readonly<{ status: "error"; message: string }>;

type DevicePlanContextValue = Readonly<{
  state: DevicePlanState;
  create(data: DevicePlanData): Promise<DevicePlanRecord>;
  save(data: DevicePlanData): Promise<DevicePlanRecord>;
  exportRecoveryFixture(): Promise<string>;
  importRecoveryFixture(encoded: string): Promise<DevicePlanRecord>;
  reload(): Promise<void>;
}>;

const DevicePlanContext = createContext<DevicePlanContextValue | null>(null);

export function DevicePlanProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<DevicePlanState>({ status: "loading" });

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const repository = await getDevicePlanRepository();
      setState(stateFromLoadResult(await repository.load()));
    } catch {
      setState({ status: "error", message: "Your plan could not be opened on this device." });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getDevicePlanRepository()
      .then((repository) => repository.load())
      .then((result) => { if (active) setState(stateFromLoadResult(result)); })
      .catch(() => { if (active) setState({ status: "error", message: "Your plan could not be opened on this device." }); });
    return () => { active = false; };
  }, []);

  const value = useMemo<DevicePlanContextValue>(() => ({
    state,
    async create(data) {
      const repository = await getDevicePlanRepository();
      const record = await repository.create(data);
      setState({ status: "ready", record, saving: false });
      return record;
    },
    async save(data) {
      if (state.status !== "ready") throw new Error("There is no open device plan.");
      setState({ ...state, saving: true });
      try {
        const repository = await getDevicePlanRepository();
        const record = await repository.save(data, state.record.revision);
        setState({ status: "ready", record, saving: false });
        return record;
      } catch (error) {
        setState({ ...state, saving: false });
        throw error;
      }
    },
    async exportRecoveryFixture() {
      return (await getDevicePlanRepository()).exportRecoveryFixture();
    },
    async importRecoveryFixture(encoded) {
      const record = await (await getDevicePlanRepository()).importRecoveryFixture(encoded);
      setState({ status: "ready", record, saving: false });
      return record;
    },
    reload,
  }), [reload, state]);

  return <DevicePlanContext.Provider value={value}>{children}</DevicePlanContext.Provider>;
}

export function useDevicePlan() {
  const value = useContext(DevicePlanContext);
  if (!value) throw new Error("useDevicePlan must be used inside DevicePlanProvider.");
  return value;
}

function stateFromLoadResult(result: DevicePlanLoadResult): DevicePlanState {
  if (result.kind === "ready") {
    return { status: "ready", record: result.record, saving: false };
  }
  if (result.kind === "recovered") {
    return {
      status: "empty",
      recoveryNotice: result.reason === "restored_without_secret"
        ? "A restored plan database could not be matched to this installation, so it was safely cleared."
        : "An unreadable saved plan was safely cleared. You can start again or import a development recovery fixture.",
    };
  }
  return { status: "empty", recoveryNotice: null };
}
