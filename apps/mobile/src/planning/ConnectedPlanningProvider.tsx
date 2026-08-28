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

export type ConnectedPlanningState =
  | Readonly<{ status: "device_only"; reason: "signed_out" | "not_configured" | "no_workspace" }>
  | Readonly<{ status: "checking" }>
  | Readonly<{ status: "connected"; accountId: string; workspaceId: string; role: "owner" | "partner"; hydration: PlanningWorkspaceHydration }>
  | Readonly<{ status: "error"; failure: "offline" | "unavailable" | "conflict" }>;

type ConnectedPlanningValue = Readonly<{
  state: ConnectedPlanningState;
  connect(): Promise<void>;
  refresh(): Promise<void>;
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
    if (devicePlan.state.status !== "ready") return;
    const budgetPlanId = devicePlan.state.record.data.budgetPlan.id;
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
        hydration,
      });
    } catch (error) {
      if (currentRevision !== revision.current) return;
      setState({ status: "error", failure: mapConnectionFailure(error) });
    }
  }, [auth.snapshot.accountId, auth.snapshot.status, client, devicePlan.state]);

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
        hydration,
      });
    } catch (error) {
      if (currentRevision !== revision.current) return;
      setState({ status: "error", failure: mapConnectionFailure(error) });
    }
  }, [auth.snapshot.accountId, client, devicePlan.state]);

  const value = useMemo<ConnectedPlanningValue>(() => ({
    state,
    connect,
    refresh: load,
  }), [connect, load, state]);
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
