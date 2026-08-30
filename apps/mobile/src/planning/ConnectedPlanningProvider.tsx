import {
  createPlanningApiClient,
  PlanningApiError,
  type PlanningWorkspaceHydration,
} from "@everaft/api-client";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNativeAuth } from "../auth/NativeAuthProvider";
import { resolveCatalogueRuntimeConfiguration } from "../catalogue/catalogue-runtime";
import { createDevicePlanImportRequest } from "./connected-plan-model";
import { useDevicePlan } from "./DevicePlanProvider";
import type { DevicePlanData } from "./device-plan-model";

export type ConnectedPlanningState =
  | Readonly<{ status: "device_only"; reason: "signed_out" | "not_configured" | "no_workspace" }>
  | Readonly<{ status: "checking" }>
  | Readonly<{
    status: "connected";
    accountId: string;
    workspaceId: string;
    role: "owner" | "partner";
    syncStatus: "idle" | "saving";
    hydration: PlanningWorkspaceHydration;
  }>
  | Readonly<{ status: "error"; failure: "offline" | "unavailable" | "conflict" }>;

export type ConnectedBudgetSaveResult = Readonly<{
  outcome: "connected" | "device_only" | "needs_attention";
  failure?: "offline" | "unavailable" | "conflict";
}>;

type ConnectedPlanningValue = Readonly<{
  state: ConnectedPlanningState;
  data: DevicePlanData | null;
  connect(): Promise<void>;
  refresh(): Promise<void>;
  saveBudget(data: DevicePlanData): Promise<ConnectedBudgetSaveResult>;
}>;

const ConnectedPlanningContext = createContext<ConnectedPlanningValue | null>(null);

export function ConnectedPlanningProvider({ children }: PropsWithChildren) {
  const auth = useNativeAuth();
  const devicePlan = useDevicePlan();
  const [state, setState] = useState<ConnectedPlanningState>({
    status: "device_only",
    reason: "signed_out",
  });
  const revision = useRef(0);
  const configuration = resolveCatalogueRuntimeConfiguration(
    process.env.EXPO_PUBLIC_EVERAFT_API_URL,
  );
  const client = useMemo(() => configuration.status === "configured"
    ? createPlanningApiClient({
      baseUrl: configuration.baseUrl,
      getAccessToken: auth.getAccessToken,
    })
    : null, [auth.getAccessToken, configuration.baseUrl, configuration.status]);
  const budgetPlanId = devicePlan.state.status === "ready"
    ? devicePlan.state.record.data.budgetPlan.id
    : null;
  const exposedState = useMemo<ConnectedPlanningState>(() => (
    state.status === "connected"
      && (
        auth.snapshot.status !== "authenticated"
        || auth.snapshot.accountId !== state.accountId
      )
      ? { status: "device_only", reason: "signed_out" }
      : state
  ), [auth.snapshot.accountId, auth.snapshot.status, state]);

  const load = useCallback(async () => {
    const currentRevision = ++revision.current;
    const accountId = auth.snapshot.accountId;
    if (auth.snapshot.status !== "authenticated" || !accountId) {
      setState({ status: "device_only", reason: "signed_out" });
      return;
    }
    if (!client) {
      setState({ status: "device_only", reason: "not_configured" });
      return;
    }
    if (!budgetPlanId) return;
    setState({ status: "checking" });
    try {
      const collection = await client.listWorkspaces();
      const workspace = collection.workspaces.find(
        (candidate) => candidate.budgetPlanId === budgetPlanId,
      );
      if (currentRevision !== revision.current) return;
      if (!workspace) {
        setState({ status: "device_only", reason: "no_workspace" });
        return;
      }
      const hydration = await client.hydrateWorkspace(workspace.id);
      if (currentRevision !== revision.current) return;
      setState({
        status: "connected",
        accountId,
        workspaceId: workspace.id,
        role: workspace.role,
        syncStatus: "idle",
        hydration,
      });
    } catch (error) {
      if (currentRevision !== revision.current) return;
      setState({ status: "error", failure: mapConnectionFailure(error) });
    }
  }, [auth.snapshot.accountId, auth.snapshot.status, budgetPlanId, client]);

  useEffect(() => {
    const task = setTimeout(() => { void load(); }, 0);
    return () => { clearTimeout(task); };
  }, [load]);

  const connect = useCallback(async () => {
    const accountId = auth.snapshot.accountId;
    if (!client || !accountId || devicePlan.state.status !== "ready") return;
    const currentRevision = ++revision.current;
    setState({ status: "checking" });
    try {
      const resource = await client.importWorkspace(
        createDevicePlanImportRequest(devicePlan.state.record.data),
      );
      const hydration = await client.hydrateWorkspace(resource.workspace.id);
      if (currentRevision !== revision.current) return;
      setState({
        status: "connected",
        accountId,
        workspaceId: resource.workspace.id,
        role: resource.workspace.role,
        syncStatus: "idle",
        hydration,
      });
    } catch (error) {
      if (currentRevision !== revision.current) return;
      setState({ status: "error", failure: mapConnectionFailure(error) });
    }
  }, [auth.snapshot.accountId, client, devicePlan.state]);

  const saveBudget = useCallback(async (
    data: DevicePlanData,
  ): Promise<ConnectedBudgetSaveResult> => {
    const startingRevision = revision.current;
    const connection = exposedState.status === "connected" ? exposedState : null;
    const local = devicePlan.state.status === "ready"
      ? devicePlan.state.record.data
      : data;
    const deviceSafeData: DevicePlanData = {
      ...data,
      budgetPlan: {
        ...data.budgetPlan,
        userId: local.budgetPlan.userId,
        createdAt: local.budgetPlan.createdAt,
      },
      workspace: {
        ...data.workspace,
        id: local.workspace.id,
        cloudWorkspaceId: local.workspace.cloudWorkspaceId,
        ownerId: local.workspace.ownerId,
        createdAt: local.workspace.createdAt,
      },
    };
    const record = await devicePlan.save(deviceSafeData);
    if (!connection || !client || startingRevision !== revision.current) {
      return { outcome: "device_only" };
    }

    const currentRevision = ++revision.current;
    const expectedBudgetUpdatedAt = connection.hydration.budget.versions.budgetUpdatedAt;
    const requestPlan = {
      ...record.data.budgetPlan,
      userId: connection.hydration.budget.plan.userId,
      createdAt: connection.hydration.budget.plan.createdAt,
      updatedAt: expectedBudgetUpdatedAt,
    };
    setState((current) => current.status === "connected"
      && current.accountId === connection.accountId
      && current.workspaceId === connection.workspaceId
      ? {
        ...current,
        syncStatus: "saving",
        hydration: {
          ...current.hydration,
          budget: { ...current.hydration.budget, plan: requestPlan },
        },
      }
      : current);

    try {
      await client.updateBudget(connection.workspaceId, {
        schemaVersion: 1,
        expectedBudgetUpdatedAt,
        plan: requestPlan,
      });
      const hydration = await client.hydrateWorkspace(connection.workspaceId);
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState({ ...connection, syncStatus: "idle", hydration });
      return { outcome: "connected" };
    } catch (error) {
      const failure = mapConnectionFailure(error);
      if (currentRevision === revision.current) {
        setState({ status: "error", failure });
      }
      return { outcome: "needs_attention", failure };
    }
  }, [client, devicePlan, exposedState]);

  const data = useMemo<DevicePlanData | null>(() => {
    if (devicePlan.state.status !== "ready") return null;
    const local = devicePlan.state.record.data;
    if (exposedState.status !== "connected") return local;
    return {
      ...local,
      budgetPlan: exposedState.hydration.budget.plan,
      workspace: {
        ...local.workspace,
        cloudWorkspaceId: exposedState.workspaceId,
        budgetPlanId: exposedState.hydration.budget.plan.id,
        name: exposedState.hydration.dashboard.workspace.name,
        profile: exposedState.hydration.profile.profile ?? local.workspace.profile,
      },
    };
  }, [devicePlan.state, exposedState]);

  const value = useMemo<ConnectedPlanningValue>(() => ({
    state: exposedState,
    data,
    connect,
    refresh: load,
    saveBudget,
  }), [connect, data, exposedState, load, saveBudget]);
  return (
    <ConnectedPlanningContext.Provider value={value}>
      {children}
    </ConnectedPlanningContext.Provider>
  );
}

export function useConnectedPlanning() {
  const value = useContext(ConnectedPlanningContext);
  if (!value) throw new Error("useConnectedPlanning must be used within ConnectedPlanningProvider.");
  return value;
}

function mapConnectionFailure(error: unknown): "offline" | "unavailable" | "conflict" {
  if (error instanceof PlanningApiError) {
    if (error.failure === "offline") return "offline";
    if (error.failure === "version_conflict") return "conflict";
  }
  return "unavailable";
}
