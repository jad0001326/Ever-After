import {
  createPlanningApiClient,
  PlanningApiError,
  type PlanningTablePlanResource,
  type PlanningTaskResource,
  type PlanningWorkspaceHydration,
} from "@everaft/api-client";
import type { PlanningTask } from "@everaft/planning-domain/planning-workspace/types";
import type { TablePlan } from "@everaft/planning-domain/table-plan/types";
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";

import { useNativeAuth } from "../auth/NativeAuthProvider";
import { resolveCatalogueRuntimeConfiguration } from "../catalogue/catalogue-runtime";
import { createDevicePlanImportRequest } from "./connected-plan-model";
import { useDevicePlan } from "./DevicePlanProvider";
import type {
  DevicePlanData,
  LastConnectedPlanningScope,
  PendingTaskSyncOperation,
} from "./device-plan-model";
import { budgetPlanContentMatches } from "./payment-reliability";
import { acceptCloudResources, pendingResourcesMatchCloud } from "./conflict-recovery";
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
import {
  normalizeTablePlanForSave,
  tablePlanContentMatches,
} from "./table-plan-reliability";

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
export type ConnectedTablePlanMutationResult = ConnectedBudgetSaveResult & Readonly<{ savedOnDevice?: boolean }>;
export type ConnectedConflictResolutionResult = Readonly<{
  outcome: "resolved" | "needs_attention";
  failure?: "offline" | "unavailable" | "conflict";
}>;

type ConnectedPlanningValue = Readonly<{
  state: ConnectedPlanningState;
  data: DevicePlanData | null;
  connect(): Promise<void>;
  refresh(): Promise<void>;
  saveBudget(data: DevicePlanData): Promise<ConnectedBudgetSaveResult>;
  saveTablePlan(tablePlan: TablePlan): Promise<ConnectedTablePlanMutationResult>;
  createTask(input: TaskCreateInput): Promise<ConnectedTaskMutationResult>;
  updateTask(taskId: string, changes: TaskChanges): Promise<ConnectedTaskMutationResult>;
  deleteTask(taskId: string): Promise<ConnectedTaskMutationResult>;
  acceptCloudCopy(): Promise<ConnectedConflictResolutionResult>;
  keepDeviceCopy(): Promise<ConnectedConflictResolutionResult>;
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
  const authenticatedAccountId = auth.snapshot.status === "authenticated"
    ? auth.snapshot.accountId
    : null;
  useLayoutEffect(() => {
    revision.current += 1;
  }, [authenticatedAccountId]);
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
  const deviceRecord = devicePlan.state.status === "ready" ? devicePlan.state.record : null;
  const deviceRecordRef = useRef(deviceRecord);
  const deviceSaveRef = useRef(devicePlan.save);
  useEffect(() => {
    deviceRecordRef.current = deviceRecord;
    deviceSaveRef.current = devicePlan.save;
  }, [devicePlan.save, deviceRecord]);
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
      let hydration = await client.hydrateWorkspace(workspace.id);
      if (currentRevision !== revision.current) return;
      let localRecord = deviceRecordRef.current;
      let local = localRecord?.data;
      const pendingBudget = local?.connectedSync.pendingBudget;
      if (pendingBudget) {
        const pendingLocal = local;
        if (!pendingLocal) return;
        if (pendingBudget.accountId !== accountId
          || pendingBudget.workspaceId !== workspace.id) {
          setState({ status: "error", failure: "conflict" });
          return;
        }
        if (!budgetPlanContentMatches(pendingLocal.budgetPlan, hydration.budget.plan)) {
          if (pendingBudget.baseBudgetUpdatedAt !== hydration.budget.versions.budgetUpdatedAt) {
            setState({ status: "error", failure: "conflict" });
            return;
          }
          const requestPlan = {
            ...pendingLocal.budgetPlan,
            userId: hydration.budget.plan.userId,
            createdAt: hydration.budget.plan.createdAt,
            updatedAt: pendingBudget.baseBudgetUpdatedAt,
          };
          try {
            await client.updateBudget(workspace.id, {
              schemaVersion: 1,
              expectedBudgetUpdatedAt: pendingBudget.baseBudgetUpdatedAt,
              plan: requestPlan,
            });
          } catch (error) {
            try {
              const canonical = await client.getBudget(workspace.id);
              if (!budgetPlanContentMatches(canonical.plan, requestPlan)) {
                if (currentRevision !== revision.current) return;
                setState({ status: "error", failure: mapConnectionFailure(error) });
                return;
              }
              hydration = { ...hydration, budget: canonical };
            } catch {
              if (currentRevision !== revision.current) return;
              setState({ status: "error", failure: mapConnectionFailure(error) });
              return;
            }
          }
          if (currentRevision !== revision.current) return;
        }
      }
      const pendingTablePlan = local?.connectedSync.pendingTablePlan;
      if (pendingTablePlan) {
        const pendingLocal = local;
        if (!pendingLocal) return;
        if (pendingTablePlan.accountId !== accountId
          || pendingTablePlan.workspaceId !== workspace.id) {
          setState({ status: "error", failure: "conflict" });
          return;
        }
        if (!tablePlanContentMatches(pendingLocal.workspace.tablePlan, hydration.tablePlan.tablePlan)) {
          if (pendingTablePlan.baseWorkspaceUpdatedAt !== hydration.tablePlan.workspaceUpdatedAt) {
            setState({ status: "error", failure: "conflict" });
            return;
          }
          try {
            const success = await client.updateTablePlan(workspace.id, {
              schemaVersion: 1,
              expectedWorkspaceUpdatedAt: pendingTablePlan.baseWorkspaceUpdatedAt,
              tablePlan: pendingLocal.workspace.tablePlan,
            });
            hydration = {
              ...hydration,
              tablePlan: tablePlanResourceAfterWrite(
                hydration.tablePlan,
                pendingLocal.workspace.tablePlan,
                success.savedAt,
              ),
            };
          } catch (error) {
            try {
              const canonical = await client.getTablePlan(workspace.id);
              if (!tablePlanContentMatches(canonical.tablePlan, pendingLocal.workspace.tablePlan)) {
                if (currentRevision !== revision.current) return;
                setState({ status: "error", failure: mapConnectionFailure(error) });
                return;
              }
              hydration = { ...hydration, tablePlan: canonical };
            } catch {
              if (currentRevision !== revision.current) return;
              setState({ status: "error", failure: mapConnectionFailure(error) });
              return;
            }
          }
          if (currentRevision !== revision.current) return;
        }
      }
      const pendingTasks = local?.connectedSync.pendingTasks ?? [];
      if (pendingTasks.length > 0) {
        if (!localRecord || !local || pendingTasks.some((operation) => (
          operation.accountId !== accountId || operation.workspaceId !== workspace.id
        ))) {
          setState({ status: "error", failure: "conflict" });
          return;
        }
        for (const operation of pendingTasks) {
          const intended = local.workspace.tasks.find((task) => task.id === operation.taskId);
          if (operation.kind === "create") {
            if (!intended) {
              setState({ status: "error", failure: "conflict" });
              return;
            }
            let canonical: PlanningTaskResource | null = null;
            try {
              canonical = await client.getTask(workspace.id, operation.taskId);
            } catch (error) {
              if (!(error instanceof PlanningApiError) || error.failure !== "task_unavailable") {
                throw error;
              }
            }
            if (canonical) {
              if (!taskContentMatches(canonical, intended)) {
                setState({ status: "error", failure: "conflict" });
                return;
              }
            } else {
              await client.createTask(workspace.id, {
                schemaVersion: 1,
                task: taskToCreateContent(intended),
              });
            }
          } else if (operation.kind === "update") {
            if (!intended || !operation.baseTaskUpdatedAt) {
              setState({ status: "error", failure: "conflict" });
              return;
            }
            let canonical: PlanningTaskResource;
            try {
              canonical = await client.getTask(workspace.id, operation.taskId);
            } catch (error) {
              if (error instanceof PlanningApiError && error.failure === "task_unavailable") {
                setState({ status: "error", failure: "conflict" });
                return;
              }
              throw error;
            }
            if (!taskContentMatches(canonical, intended)) {
              if (canonical.updatedAt !== operation.baseTaskUpdatedAt) {
                setState({ status: "error", failure: "conflict" });
                return;
              }
              await client.updateTask(workspace.id, operation.taskId, {
                schemaVersion: 1,
                expectedTaskUpdatedAt: operation.baseTaskUpdatedAt,
                changes: taskChangesFromDeviceTask(intended),
              });
            }
          } else {
            let canonical: PlanningTaskResource | null = null;
            try {
              canonical = await client.getTask(workspace.id, operation.taskId);
            } catch (error) {
              if (!(error instanceof PlanningApiError) || error.failure !== "task_unavailable") {
                throw error;
              }
            }
            if (canonical) {
              if (!operation.baseTaskUpdatedAt
                || canonical.updatedAt !== operation.baseTaskUpdatedAt) {
                setState({ status: "error", failure: "conflict" });
                return;
              }
              await client.deleteTask(workspace.id, operation.taskId, {
                schemaVersion: 1,
                expectedTaskUpdatedAt: operation.baseTaskUpdatedAt,
              });
            }
          }
          if (currentRevision !== revision.current) return;
        }
      }
      if (!localRecord || !local) return;
      if (pendingBudget || pendingTablePlan || pendingTasks.length > 0) {
        hydration = await client.hydrateWorkspace(workspace.id);
        if (currentRevision !== revision.current) return;
      }
      try {
        localRecord = await deviceSaveRef.current(
          acceptCloudResources(localRecord.data, hydration, { accountId, workspaceId: workspace.id }),
          localRecord.revision,
        );
        deviceRecordRef.current = localRecord;
      } catch {
        if (currentRevision !== revision.current) return;
        setState({ status: "error", failure: "unavailable" });
        return;
      }
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
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load();
      return undefined;
    });
    return () => {
      active = false;
      revision.current += 1;
    };
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
      try {
        const saved = await deviceSaveRef.current(
          acceptCloudResources(devicePlan.state.record.data, hydration, {
            accountId,
            workspaceId: resource.workspace.id,
          }),
          devicePlan.state.record.revision,
        );
        deviceRecordRef.current = saved;
      } catch {
        if (currentRevision !== revision.current) return;
        setState({ status: "error", failure: "unavailable" });
        return;
      }
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
    if (connectionScopeIsUnknown(exposedState, local, authenticatedAccountId, client)) {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const mutationScope = connection
      ? scopeFromConnection(connection)
      : getLastConnectedScope(local, authenticatedAccountId);
    const identitySafeData = withLocalDeviceIdentity(data, local);
    const deviceSafeData = mutationScope
      ? withPendingBudget(identitySafeData, mutationScope)
      : identitySafeData;
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
    const accept = async (
      hydration: PlanningWorkspaceHydration,
    ): Promise<ConnectedBudgetSaveResult> => {
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      try {
        const saved = await devicePlan.save(
          acceptCloudResources(record.data, hydration, {
            accountId: connection.accountId,
            workspaceId: connection.workspaceId,
          }),
          record.revision,
        );
        deviceRecordRef.current = saved;
      } catch {
        if (currentRevision !== revision.current) return { outcome: "device_only" };
        setState({ status: "error", failure: "unavailable" });
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState({ ...connection, syncStatus: "idle", hydration });
      return { outcome: "connected" };
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
      return accept(hydration);
    } catch (error) {
      const failure = mapConnectionFailure(error);
      if (failure !== "conflict") {
        try {
          const canonical = await client.getBudget(connection.workspaceId);
          if (budgetPlanContentMatches(canonical.plan, requestPlan)) {
            return accept({ ...connection.hydration, budget: canonical });
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
  }, [authenticatedAccountId, client, devicePlan, exposedState]);

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
        tablePlan: exposedState.hydration.tablePlan.tablePlan,
        updatedAt: exposedState.hydration.tablePlan.workspaceUpdatedAt,
      },
    };
  }, [devicePlan.state, exposedState]);

  const saveTablePlan = useCallback(async (
    tablePlan: TablePlan,
  ): Promise<ConnectedTablePlanMutationResult> => {
    if (!data || devicePlan.state.status !== "ready") {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const safeTablePlan = normalizeTablePlanForSave(tablePlan);
    const startingRevision = revision.current;
    const connection = exposedState.status === "connected" ? exposedState : null;
    const local = devicePlan.state.record.data;
    if (connectionScopeIsUnknown(exposedState, local, authenticatedAccountId, client)) {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const mutationScope = connection
      ? scopeFromConnection(connection)
      : getLastConnectedScope(local, authenticatedAccountId);
    const identitySafeData = withLocalDeviceIdentity(data, local);
    const deviceSafeData = mutationScope
      ? withPendingTablePlan(identitySafeData, mutationScope)
      : identitySafeData;
    let deviceRecord;
    try {
      deviceRecord = await devicePlan.save(withDeviceTablePlan(deviceSafeData, safeTablePlan));
    } catch {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    if (!connection || !client || startingRevision !== revision.current) {
      return { outcome: "device_only" };
    }

    const currentRevision = ++revision.current;
    const base = connection.hydration.tablePlan;
    markTablePlanSyncSaving(setState, connection);
    const write = (expectedWorkspaceUpdatedAt: string) => client.updateTablePlan(
      connection.workspaceId,
      {
        schemaVersion: 1,
        expectedWorkspaceUpdatedAt,
        tablePlan: safeTablePlan,
      },
    );
    const accept = async (
      resource: PlanningTablePlanResource,
    ): Promise<ConnectedTablePlanMutationResult> => {
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      try {
        const hydration = { ...connection.hydration, tablePlan: resource };
        const saved = await devicePlan.save(
          acceptCloudResources(deviceRecord.data, hydration, {
            accountId: connection.accountId,
            workspaceId: connection.workspaceId,
          }),
          deviceRecord.revision,
        );
        deviceRecordRef.current = saved;
      } catch {
        if (currentRevision !== revision.current) return { outcome: "device_only" };
        setState({ status: "error", failure: "unavailable" });
        return { outcome: "needs_attention", failure: "unavailable", savedOnDevice: true };
      }
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setConnectedTablePlan(setState, connection, resource);
      return { outcome: "connected" };
    };

    try {
      const success = await write(base.workspaceUpdatedAt);
      return accept(tablePlanResourceAfterWrite(base, safeTablePlan, success.savedAt));
    } catch (error) {
      const originalFailure = mapConnectionFailure(error);
      let canonical: PlanningTablePlanResource;
      try {
        canonical = await client.getTablePlan(connection.workspaceId);
      } catch {
        if (currentRevision !== revision.current) return { outcome: "device_only" };
        setState({ status: "error", failure: originalFailure });
        return { outcome: "needs_attention", failure: originalFailure, savedOnDevice: true };
      }

      if (tablePlanContentMatches(canonical.tablePlan, safeTablePlan)) {
        return accept(canonical);
      }

      if (originalFailure === "conflict"
        && tablePlanContentMatches(canonical.tablePlan, base.tablePlan)) {
        try {
          const success = await write(canonical.workspaceUpdatedAt);
          return accept(tablePlanResourceAfterWrite(canonical, safeTablePlan, success.savedAt));
        } catch (retryError) {
          const retryFailure = mapConnectionFailure(retryError);
          try {
            const confirmed = await client.getTablePlan(connection.workspaceId);
            if (tablePlanContentMatches(confirmed.tablePlan, safeTablePlan)) {
              return accept(confirmed);
            }
          } catch {
            // The device draft remains available when the retry cannot be confirmed.
          }
          if (currentRevision !== revision.current) return { outcome: "device_only" };
          setState({ status: "error", failure: retryFailure });
          return { outcome: "needs_attention", failure: retryFailure, savedOnDevice: true };
        }
      }

      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState({ status: "error", failure: originalFailure });
      return { outcome: "needs_attention", failure: originalFailure, savedOnDevice: true };
    }
  }, [authenticatedAccountId, client, data, devicePlan, exposedState]);

  const createTask = useCallback(async (
    input: TaskCreateInput,
  ): Promise<ConnectedTaskMutationResult> => {
    if (!data || devicePlan.state.status !== "ready") {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const startingRevision = revision.current;
    const connection = exposedState.status === "connected" ? exposedState : null;
    if (connectionScopeIsUnknown(
      exposedState,
      devicePlan.state.record.data,
      authenticatedAccountId,
      client,
    )) return { outcome: "needs_attention", failure: "unavailable" };
    const task = createDeviceTask(input, data.workspace.tasks);
    const syncScope = connection
      ? scopeFromConnection(connection)
      : getLastConnectedScope(devicePlan.state.record.data, authenticatedAccountId);
    let nextData = withLocalDeviceIdentity(
      withDeviceTasks(data, replaceDeviceTask(data.workspace.tasks, task)),
      devicePlan.state.record.data,
    );
    if (syncScope) {
      nextData = withPendingTaskOperation(nextData, syncScope, {
        kind: "create",
        taskId: task.id,
        baseTaskUpdatedAt: null,
      });
    }
    let deviceRecord;
    try {
      deviceRecord = await devicePlan.save(nextData);
    } catch {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    if (!connection || !client || startingRevision !== revision.current) {
      return { outcome: "device_only" };
    }

    const currentRevision = ++revision.current;
    const accept = async (
      resource: PlanningTaskResource,
    ): Promise<ConnectedTaskMutationResult> => {
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      const connected = withConnectedTask(connection, resource);
      try {
        const saved = await devicePlan.save(
          acceptCloudResources(deviceRecord.data, connected.hydration, {
            accountId: connection.accountId,
            workspaceId: connection.workspaceId,
          }),
          deviceRecord.revision,
        );
        deviceRecordRef.current = saved;
      } catch {
        if (currentRevision !== revision.current) return { outcome: "device_only" };
        setState({ status: "error", failure: "unavailable" });
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState(connected);
      return { outcome: "connected" };
    };
    markTaskSyncSaving(setState, connection);
    try {
      const resource = await client.createTask(connection.workspaceId, {
        schemaVersion: 1,
        task: taskToCreateContent(task),
      });
      return accept(resource);
    } catch (error) {
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      try {
        const resource = await client.getTask(connection.workspaceId, task.id);
        if (taskContentMatches(resource, task)) {
          return accept(resource);
        }
      } catch {
        // The original failure remains authoritative when the recovery read fails.
      }
      const failure = mapConnectionFailure(error);
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState({ status: "error", failure });
      return { outcome: "needs_attention", failure };
    }
  }, [authenticatedAccountId, client, data, devicePlan, exposedState]);

  const updateTask = useCallback(async (
    taskId: string,
    changes: TaskChanges,
  ): Promise<ConnectedTaskMutationResult> => {
    if (!data || devicePlan.state.status !== "ready") {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const startingRevision = revision.current;
    const currentTask = data.workspace.tasks.find((task) => task.id === taskId);
    if (!currentTask) return { outcome: "needs_attention", failure: "unavailable" };
    const connection = exposedState.status === "connected" ? exposedState : null;
    if (connectionScopeIsUnknown(
      exposedState,
      devicePlan.state.record.data,
      authenticatedAccountId,
      client,
    )) return { outcome: "needs_attention", failure: "unavailable" };
    const intended = updateDeviceTask(currentTask, changes);
    const syncScope = connection
      ? scopeFromConnection(connection)
      : getLastConnectedScope(devicePlan.state.record.data, authenticatedAccountId);
    let nextData = withLocalDeviceIdentity(
      withDeviceTasks(data, replaceDeviceTask(data.workspace.tasks, intended)),
      devicePlan.state.record.data,
    );
    if (syncScope) {
      nextData = withPendingTaskOperation(nextData, syncScope, {
        kind: "update",
        taskId,
        baseTaskUpdatedAt: currentTask.updatedAt,
      });
    }
    let deviceRecord;
    try {
      deviceRecord = await devicePlan.save(nextData);
    } catch {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    if (!connection || !client || startingRevision !== revision.current) {
      return { outcome: "device_only" };
    }

    const currentRevision = ++revision.current;
    const accept = async (
      resource: PlanningTaskResource,
    ): Promise<ConnectedTaskMutationResult> => {
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      const connected = withConnectedTask(connection, resource);
      try {
        const saved = await devicePlan.save(
          acceptCloudResources(deviceRecord.data, connected.hydration, {
            accountId: connection.accountId,
            workspaceId: connection.workspaceId,
          }),
          deviceRecord.revision,
        );
        deviceRecordRef.current = saved;
      } catch {
        if (currentRevision !== revision.current) return { outcome: "device_only" };
        setState({ status: "error", failure: "unavailable" });
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState(connected);
      return { outcome: "connected" };
    };
    markTaskSyncSaving(setState, connection);
    try {
      const resource = await client.updateTask(connection.workspaceId, taskId, {
        schemaVersion: 1,
        expectedTaskUpdatedAt: currentTask.updatedAt,
        changes,
      });
      return accept(resource);
    } catch (error) {
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      try {
        const resource = await client.getTask(connection.workspaceId, taskId);
        if (taskContentMatches(resource, intended)) {
          return accept(resource);
        }
      } catch {
        // The device copy remains available for explicit refresh and reconciliation.
      }
      const failure = mapConnectionFailure(error);
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState({ status: "error", failure });
      return { outcome: "needs_attention", failure };
    }
  }, [authenticatedAccountId, client, data, devicePlan, exposedState]);

  const deleteTask = useCallback(async (
    taskId: string,
  ): Promise<ConnectedTaskMutationResult> => {
    if (!data || devicePlan.state.status !== "ready") {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    const startingRevision = revision.current;
    const currentTask = data.workspace.tasks.find((task) => task.id === taskId);
    if (!currentTask) return { outcome: "needs_attention", failure: "unavailable" };
    const connection = exposedState.status === "connected" ? exposedState : null;
    if (connectionScopeIsUnknown(
      exposedState,
      devicePlan.state.record.data,
      authenticatedAccountId,
      client,
    )) return { outcome: "needs_attention", failure: "unavailable" };
    const syncScope = connection
      ? scopeFromConnection(connection)
      : getLastConnectedScope(devicePlan.state.record.data, authenticatedAccountId);
    let nextData = withLocalDeviceIdentity(
      withDeviceTasks(data, removeDeviceTask(data.workspace.tasks, taskId)),
      devicePlan.state.record.data,
    );
    if (syncScope) {
      nextData = withPendingTaskOperation(nextData, syncScope, {
        kind: "delete",
        taskId,
        baseTaskUpdatedAt: currentTask.updatedAt,
      });
    }
    let deviceRecord;
    try {
      deviceRecord = await devicePlan.save(nextData);
    } catch {
      return { outcome: "needs_attention", failure: "unavailable" };
    }
    if (!connection || !client || startingRevision !== revision.current) {
      return { outcome: "device_only" };
    }

    const currentRevision = ++revision.current;
    const accept = async (): Promise<ConnectedTaskMutationResult> => {
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      const connected = withoutConnectedTask(connection, taskId);
      try {
        const saved = await devicePlan.save(
          acceptCloudResources(deviceRecord.data, connected.hydration, {
            accountId: connection.accountId,
            workspaceId: connection.workspaceId,
          }),
          deviceRecord.revision,
        );
        deviceRecordRef.current = saved;
      } catch {
        if (currentRevision !== revision.current) return { outcome: "device_only" };
        setState({ status: "error", failure: "unavailable" });
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState(connected);
      return { outcome: "connected" };
    };
    markTaskSyncSaving(setState, connection);
    try {
      await client.deleteTask(connection.workspaceId, taskId, {
        schemaVersion: 1,
        expectedTaskUpdatedAt: currentTask.updatedAt,
      });
      return accept();
    } catch (error) {
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      try {
        await client.getTask(connection.workspaceId, taskId);
      } catch (recoveryError) {
        if (recoveryError instanceof PlanningApiError
          && recoveryError.failure === "task_unavailable") {
          return accept();
        }
      }
      const failure = mapConnectionFailure(error);
      if (currentRevision !== revision.current) return { outcome: "device_only" };
      setState({ status: "error", failure });
      return { outcome: "needs_attention", failure };
    }
  }, [authenticatedAccountId, client, data, devicePlan, exposedState]);

  const acceptCloudCopy = useCallback(async (): Promise<ConnectedConflictResolutionResult> => {
    const accountId = auth.snapshot.accountId;
    const localRecord = devicePlan.state.status === "ready"
      ? devicePlan.state.record
      : null;
    const scope = localRecord ? getPendingSyncScope(localRecord.data) : null;
    if (auth.snapshot.status !== "authenticated"
      || !accountId
      || !client
      || !localRecord
      || !scope
      || scope.accountId !== accountId) {
      return { outcome: "needs_attention", failure: "conflict" };
    }

    const currentRevision = ++revision.current;
    setState({ status: "checking" });
    try {
      const collection = await client.listWorkspaces();
      const workspace = collection.workspaces.find((candidate) => (
        candidate.id === scope.workspaceId
        && candidate.budgetPlanId === localRecord.data.budgetPlan.id
      ));
      if (currentRevision !== revision.current) {
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      if (!workspace) {
        setState({ status: "error", failure: "conflict" });
        return { outcome: "needs_attention", failure: "conflict" };
      }

      const hydration = await client.hydrateWorkspace(workspace.id);
      if (currentRevision !== revision.current) {
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      const accepted = acceptCloudResources(localRecord.data, hydration, {
        accountId,
        workspaceId: workspace.id,
      });
      const saved = await devicePlan.save(accepted, localRecord.revision);
      if (currentRevision !== revision.current) {
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      deviceRecordRef.current = saved;
      setState({
        status: "connected",
        accountId,
        workspaceId: workspace.id,
        role: workspace.role,
        syncStatus: "idle",
        hydration,
      });
      return { outcome: "resolved" };
    } catch (error) {
      const failure = mapConnectionFailure(error);
      if (currentRevision === revision.current) {
        setState({ status: "error", failure });
      }
      return { outcome: "needs_attention", failure };
    }
  }, [auth.snapshot.accountId, auth.snapshot.status, client, devicePlan]);

  const keepDeviceCopy = useCallback(async (): Promise<ConnectedConflictResolutionResult> => {
    const accountId = auth.snapshot.accountId;
    const localRecord = devicePlan.state.status === "ready"
      ? devicePlan.state.record
      : null;
    const scope = localRecord ? getPendingSyncScope(localRecord.data) : null;
    if (auth.snapshot.status !== "authenticated"
      || !accountId
      || !client
      || !localRecord
      || !scope
      || scope.accountId !== accountId) {
      return { outcome: "needs_attention", failure: "conflict" };
    }

    const currentRevision = ++revision.current;
    setState({ status: "checking" });
    try {
      const collection = await client.listWorkspaces();
      const workspace = collection.workspaces.find((candidate) => (
        candidate.id === scope.workspaceId
        && candidate.budgetPlanId === localRecord.data.budgetPlan.id
      ));
      if (currentRevision !== revision.current) {
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      if (!workspace) {
        setState({ status: "error", failure: "conflict" });
        return { outcome: "needs_attention", failure: "conflict" };
      }

      const hydration = await client.hydrateWorkspace(workspace.id);
      if (currentRevision !== revision.current) {
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      const local = localRecord.data;
      if (local.connectedSync.pendingBudget) {
        const expectedBudgetUpdatedAt = hydration.budget.versions.budgetUpdatedAt;
        await client.updateBudget(workspace.id, {
          schemaVersion: 1,
          expectedBudgetUpdatedAt,
          plan: {
            ...local.budgetPlan,
            userId: hydration.budget.plan.userId,
            createdAt: hydration.budget.plan.createdAt,
            updatedAt: expectedBudgetUpdatedAt,
          },
        });
        if (currentRevision !== revision.current) {
          return { outcome: "needs_attention", failure: "unavailable" };
        }
      }
      if (local.connectedSync.pendingTablePlan) {
        await client.updateTablePlan(workspace.id, {
          schemaVersion: 1,
          expectedWorkspaceUpdatedAt: hydration.tablePlan.workspaceUpdatedAt,
          tablePlan: local.workspace.tablePlan,
        });
        if (currentRevision !== revision.current) {
          return { outcome: "needs_attention", failure: "unavailable" };
        }
      }
      for (const operation of local.connectedSync.pendingTasks) {
        const intended = local.workspace.tasks.find((task) => task.id === operation.taskId);
        const cloud = hydration.tasks.tasks.find((task) => task.id === operation.taskId);
        if (operation.kind === "delete") {
          if (cloud) {
            await client.deleteTask(workspace.id, operation.taskId, {
              schemaVersion: 1,
              expectedTaskUpdatedAt: cloud.updatedAt,
            });
          }
        } else if (!intended) {
          setState({ status: "error", failure: "conflict" });
          return { outcome: "needs_attention", failure: "conflict" };
        } else if (cloud) {
          if (!taskContentMatches(cloud, intended)) {
            await client.updateTask(workspace.id, operation.taskId, {
              schemaVersion: 1,
              expectedTaskUpdatedAt: cloud.updatedAt,
              changes: taskChangesFromDeviceTask(intended),
            });
          }
        } else {
          await client.createTask(workspace.id, {
            schemaVersion: 1,
            task: taskToCreateContent(intended),
          });
        }
        if (currentRevision !== revision.current) {
          return { outcome: "needs_attention", failure: "unavailable" };
        }
      }

      const canonical = await client.hydrateWorkspace(workspace.id);
      if (currentRevision !== revision.current) {
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      if (!pendingResourcesMatchCloud(local, canonical)) {
        setState({ status: "error", failure: "conflict" });
        return { outcome: "needs_attention", failure: "conflict" };
      }
      const saved = await devicePlan.save(
        acceptCloudResources(local, canonical, { accountId, workspaceId: workspace.id }),
        localRecord.revision,
      );
      if (currentRevision !== revision.current) {
        return { outcome: "needs_attention", failure: "unavailable" };
      }
      deviceRecordRef.current = saved;
      setState({
        status: "connected",
        accountId,
        workspaceId: workspace.id,
        role: workspace.role,
        syncStatus: "idle",
        hydration: canonical,
      });
      return { outcome: "resolved" };
    } catch (error) {
      const failure = mapConnectionFailure(error);
      if (currentRevision === revision.current) {
        setState({ status: "error", failure });
      }
      return { outcome: "needs_attention", failure };
    }
  }, [auth.snapshot.accountId, auth.snapshot.status, client, devicePlan]);

  const value = useMemo<ConnectedPlanningValue>(() => ({
    state: exposedState,
    data,
    connect,
    refresh: load,
    saveBudget,
    saveTablePlan,
    createTask,
    updateTask,
    deleteTask,
    acceptCloudCopy,
    keepDeviceCopy,
  }), [acceptCloudCopy, connect, createTask, data, deleteTask, exposedState, keepDeviceCopy, load, saveBudget, saveTablePlan, updateTask]);
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

function withLocalDeviceIdentity(
  data: DevicePlanData,
  local: DevicePlanData,
): DevicePlanData {
  return {
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
}

function withPendingTablePlan(
  data: DevicePlanData,
  scope: LastConnectedPlanningScope,
): DevicePlanData {
  return {
    ...data,
    connectedSync: {
      ...data.connectedSync,
      pendingTablePlan: data.connectedSync.pendingTablePlan ?? {
        accountId: scope.accountId,
        workspaceId: scope.workspaceId,
        baseWorkspaceUpdatedAt: scope.workspaceUpdatedAt,
      },
    },
  };
}

function withPendingBudget(
  data: DevicePlanData,
  scope: LastConnectedPlanningScope,
): DevicePlanData {
  return {
    ...data,
    connectedSync: {
      ...data.connectedSync,
      pendingBudget: data.connectedSync.pendingBudget ?? {
        accountId: scope.accountId,
        workspaceId: scope.workspaceId,
        baseBudgetUpdatedAt: scope.budgetUpdatedAt,
      },
    },
  };
}

function getPendingSyncScope(data: DevicePlanData) {
  const scopes: { accountId: string; workspaceId: string }[] = [];
  if (data.connectedSync.pendingBudget) scopes.push(data.connectedSync.pendingBudget);
  if (data.connectedSync.pendingTablePlan) scopes.push(data.connectedSync.pendingTablePlan);
  scopes.push(...data.connectedSync.pendingTasks);
  const first = scopes[0];
  if (!first || !scopes.every((scope) => (
    scope.accountId === first.accountId && scope.workspaceId === first.workspaceId
  ))) return null;
  return { accountId: first.accountId, workspaceId: first.workspaceId };
}
function scopeFromConnection(
  connection: Extract<ConnectedPlanningState, { status: "connected" }>,
): LastConnectedPlanningScope {
  return {
    accountId: connection.accountId,
    workspaceId: connection.workspaceId,
    budgetUpdatedAt: connection.hydration.budget.versions.budgetUpdatedAt,
    workspaceUpdatedAt: connection.hydration.tablePlan.workspaceUpdatedAt,
  };
}

function getLastConnectedScope(
  data: DevicePlanData,
  accountId: string | null,
): LastConnectedPlanningScope | null {
  const checkpoint = data.connectedSync.lastConnected;
  if (!checkpoint || !accountId || checkpoint.accountId !== accountId) return null;
  const pending = getPendingSyncScope(data);
  if (pending && (
    pending.accountId !== checkpoint.accountId
    || pending.workspaceId !== checkpoint.workspaceId
  )) return null;
  return checkpoint;
}

function connectionScopeIsUnknown(
  state: ConnectedPlanningState,
  data: DevicePlanData,
  accountId: string | null,
  client: ReturnType<typeof createPlanningApiClient> | null,
) {
  return Boolean(
    accountId
    && client
    && !getLastConnectedScope(data, accountId)
    && (state.status === "checking" || state.status === "error"),
  );
}

function withPendingTaskOperation(
  data: DevicePlanData,
  scope: Readonly<{ accountId: string; workspaceId: string }>,
  operation: Readonly<Pick<PendingTaskSyncOperation, "kind" | "taskId" | "baseTaskUpdatedAt">>,
): DevicePlanData {
  const existing = data.connectedSync.pendingTasks.find(
    (candidate) => candidate.taskId === operation.taskId,
  );
  let replacement: PendingTaskSyncOperation | null = {
    ...operation,
    accountId: scope.accountId,
    workspaceId: scope.workspaceId,
  };
  if (existing?.kind === "create") {
    replacement = operation.kind === "delete" ? null : existing;
  } else if (existing) {
    replacement = operation.kind === "delete"
      ? { ...existing, kind: "delete" }
      : existing;
  }
  const pendingTasks = data.connectedSync.pendingTasks.filter(
    (candidate) => candidate.taskId !== operation.taskId,
  );
  if (replacement) pendingTasks.push(replacement);
  return {
    ...data,
    connectedSync: { ...data.connectedSync, pendingTasks },
  };
}

function taskChangesFromDeviceTask(task: PlanningTask): TaskChanges {
  return {
    title: task.title,
    notes: task.notes,
    category: task.category,
    status: task.status,
    dueDate: task.dueDate,
    sortOrder: task.sortOrder,
  };
}

function withDeviceTablePlan(
  data: DevicePlanData,
  tablePlan: TablePlan,
): DevicePlanData {
  return {
    ...data,
    workspace: {
      ...data.workspace,
      tablePlan,
      updatedAt: tablePlan.updatedAt,
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

function markTablePlanSyncSaving(
  setState: Dispatch<SetStateAction<ConnectedPlanningState>>,
  connection: Extract<ConnectedPlanningState, { status: "connected" }>,
) {
  setState((current) => current.status === "connected"
    && current.accountId === connection.accountId
    && current.workspaceId === connection.workspaceId
    ? { ...current, syncStatus: "saving" }
    : current);
}

function setConnectedTablePlan(
  setState: Dispatch<SetStateAction<ConnectedPlanningState>>,
  connection: Extract<ConnectedPlanningState, { status: "connected" }>,
  tablePlan: PlanningTablePlanResource,
) {
  setState((current) => current.status === "connected"
    && current.accountId === connection.accountId
    && current.workspaceId === connection.workspaceId
    ? {
      ...current,
      syncStatus: "idle",
      hydration: { ...current.hydration, tablePlan },
    }
    : current);
}

function tablePlanResourceAfterWrite(
  base: PlanningTablePlanResource,
  tablePlan: TablePlan,
  savedAt: string,
): PlanningTablePlanResource {
  return {
    ...base,
    workspaceUpdatedAt: savedAt,
    tablePlan: {
      ...tablePlan,
      id: base.tablePlan.id,
      name: base.tablePlan.name,
      updatedAt: savedAt,
    },
  };
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
