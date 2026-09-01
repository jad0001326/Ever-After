import {
  createPlanningApiClient,
  PlanningApiError,
  type PlanningTaskResource,
  type PlanningWorkspaceHydration,
} from "@everaft/api-client";
import type { PlanningTask } from "@everaft/planning-domain/planning-workspace/types";
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";

import { useNativeAuth } from "../auth/NativeAuthProvider";
import { resolveCatalogueRuntimeConfiguration } from "../catalogue/catalogue-runtime";
import { createDevicePlanImportRequest } from "./connected-plan-model";
import { useDevicePlan } from "./DevicePlanProvider";
import type { DevicePlanData } from "./device-plan-model";
import { budgetPlanContentMatches } from "./payment-reliability";
import {
  createDeviceTask,
  removeDeviceTask,
  replaceDeviceTask,
  taskContentMatches,
  taskResourceToDeviceTask,
  taskToCreateContent,
  type TaskChanges,
  type TaskCreateInput,
  updateDeviceTask,
} from "./task-reliability";

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

export type ConnectedTaskMutationResult = ConnectedBudgetSaveResult;

type ConnectedPlanningValue = Readonly<{
  state: ConnectedPlanningState;
  data: DevicePlanData | null;
  connect(): Promise<void>;
  refresh(): Promise<void>;
  saveBudget(data: DevicePlanData): Promise<ConnectedBudgetSaveResult>;
  createTask(input: TaskCreateInput): Promise<ConnectedTaskMutationResult>;
  updateTask(taskId: string, changes: TaskChanges): Promise<ConnectedTaskMutationResult>;
  deleteTask(taskId: string): Promise<ConnectedTaskMutationResult>;
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
      if (failure !== "conflict") {
        try {
          const canonical = await client.getBudget(connection.workspaceId);
          if (budgetPlanContentMatches(canonical.plan, requestPlan)) {
            if (currentRevision !== revision.current) return { outcome: "device_only" };
            setState({
              ...connection,
              syncStatus: "idle",
              hydration: { ...connection.hydration, budget: canonical },
            });
            return { outcome: "connected" };
          }
        } catch {
          // Keep the device save and surface the original failure when recovery is inconclusive.
        }
      }
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
        tasks: exposedState.hydration.tasks.tasks.map(taskResourceToDeviceTask),
      },
    };
  }, [devicePlan.state, exposedState]);

  const createTask = useCallback(async (
    input: TaskCreateInput,
  ): Promise<ConnectedTaskMutationResult> => {
    if (!data || devicePlan.state.status !== "ready") {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const connection = exposedState.status === "connected" ? exposedState : null;
    const task = createDeviceTask(input, data.workspace.tasks);
    const nextData = withDeviceTasks(data, replaceDeviceTask(data.workspace.tasks, task));
    try {
      await devicePlan.save(nextData);
    } catch {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    if (!connection || !client) return { outcome: "device_only" };

    markTaskSyncSaving(setState, connection);
    try {
      const resource = await client.createTask(connection.workspaceId, {
        schemaVersion: 1,
        task: taskToCreateContent(task),
      });
      setState(withConnectedTask(connection, resource));
      return { outcome: "connected" };
    } catch (error) {
      try {
        const resource = await client.getTask(connection.workspaceId, task.id);
        if (taskContentMatches(resource, task)) {
          setState(withConnectedTask(connection, resource));
          return { outcome: "connected" };
        }
      } catch {
        // The original failure remains authoritative when the recovery read fails.
      }
      const failure = mapConnectionFailure(error);
      setState({ status: "error", failure });
      return { outcome: "needs_attention", failure };
    }
  }, [client, data, devicePlan, exposedState]);

  const updateTask = useCallback(async (
    taskId: string,
    changes: TaskChanges,
  ): Promise<ConnectedTaskMutationResult> => {
    if (!data || devicePlan.state.status !== "ready") {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const currentTask = data.workspace.tasks.find((task) => task.id === taskId);
    if (!currentTask) return { outcome: "needs_attention", failure: "unavailable" };
    const connection = exposedState.status === "connected" ? exposedState : null;
    const intended = updateDeviceTask(currentTask, changes);
    const nextData = withDeviceTasks(
      data,
      replaceDeviceTask(data.workspace.tasks, intended),
    );
    try {
      await devicePlan.save(nextData);
    } catch {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    if (!connection || !client) return { outcome: "device_only" };

    markTaskSyncSaving(setState, connection);
    try {
      const resource = await client.updateTask(connection.workspaceId, taskId, {
        schemaVersion: 1,
        expectedTaskUpdatedAt: currentTask.updatedAt,
        changes,
      });
      setState(withConnectedTask(connection, resource));
      return { outcome: "connected" };
    } catch (error) {
      try {
        const resource = await client.getTask(connection.workspaceId, taskId);
        if (taskContentMatches(resource, intended)) {
          setState(withConnectedTask(connection, resource));
          return { outcome: "connected" };
        }
      } catch {
        // The device copy remains available for explicit refresh and reconciliation.
      }
      const failure = mapConnectionFailure(error);
      setState({ status: "error", failure });
      return { outcome: "needs_attention", failure };
    }
  }, [client, data, devicePlan, exposedState]);

  const deleteTask = useCallback(async (
    taskId: string,
  ): Promise<ConnectedTaskMutationResult> => {
    if (!data || devicePlan.state.status !== "ready") {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const currentTask = data.workspace.tasks.find((task) => task.id === taskId);
    if (!currentTask) return { outcome: "needs_attention", failure: "unavailable" };
    const connection = exposedState.status === "connected" ? exposedState : null;
    const nextData = withDeviceTasks(
      data,
      removeDeviceTask(data.workspace.tasks, taskId),
    );
    try {
      await devicePlan.save(nextData);
    } catch {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    if (!connection || !client) return { outcome: "device_only" };

    markTaskSyncSaving(setState, connection);
    try {
      await client.deleteTask(connection.workspaceId, taskId, {
        schemaVersion: 1,
        expectedTaskUpdatedAt: currentTask.updatedAt,
      });
      setState(withoutConnectedTask(connection, taskId));
      return { outcome: "connected" };
    } catch (error) {
      try {
        await client.getTask(connection.workspaceId, taskId);
      } catch (recoveryError) {
        if (recoveryError instanceof PlanningApiError
          && recoveryError.failure === "task_unavailable") {
          setState(withoutConnectedTask(connection, taskId));
          return { outcome: "connected" };
        }
      }
      const failure = mapConnectionFailure(error);
      setState({ status: "error", failure });
      return { outcome: "needs_attention", failure };
    }
  }, [client, data, devicePlan, exposedState]);

  const value = useMemo<ConnectedPlanningValue>(() => ({
    state: exposedState,
    data,
    connect,
    refresh: load,
    saveBudget,
    createTask,
    updateTask,
    deleteTask,
  }), [connect, createTask, data, deleteTask, exposedState, load, saveBudget, updateTask]);
  return (
    <ConnectedPlanningContext.Provider value={value}>
      {children}
    </ConnectedPlanningContext.Provider>
  );
}

function withDeviceTasks(data: DevicePlanData, tasks: PlanningTask[]): DevicePlanData {
  return {
    ...data,
    workspace: {
      ...data.workspace,
      tasks,
      updatedAt: new Date().toISOString(),
    },
  };
}

function markTaskSyncSaving(
  setState: Dispatch<SetStateAction<ConnectedPlanningState>>,
  connection: Extract<ConnectedPlanningState, { status: "connected" }>,
) {
  setState((current) => current.status === "connected"
    && current.accountId === connection.accountId
    && current.workspaceId === connection.workspaceId
    ? { ...current, syncStatus: "saving" }
    : current);
}

function withConnectedTask(
  connection: Extract<ConnectedPlanningState, { status: "connected" }>,
  task: PlanningTaskResource,
): Extract<ConnectedPlanningState, { status: "connected" }> {
  const tasks = connection.hydration.tasks.tasks
    .filter((candidate) => candidate.id !== task.id);
  tasks.push(task);
  tasks.sort((left, right) => left.sortOrder - right.sortOrder
    || left.createdAt.localeCompare(right.createdAt));
  return {
    ...connection,
    syncStatus: "idle",
    hydration: {
      ...connection.hydration,
      tasks: { ...connection.hydration.tasks, tasks },
    },
  };
}

function withoutConnectedTask(
  connection: Extract<ConnectedPlanningState, { status: "connected" }>,
  taskId: string,
): Extract<ConnectedPlanningState, { status: "connected" }> {
  return {
    ...connection,
    syncStatus: "idle",
    hydration: {
      ...connection.hydration,
      tasks: {
        ...connection.hydration.tasks,
        tasks: connection.hydration.tasks.tasks.filter((task) => task.id !== taskId),
      },
    },
  };
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
