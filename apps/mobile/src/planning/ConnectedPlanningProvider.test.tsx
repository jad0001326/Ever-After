import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createPlanningApiClient, PlanningApiError } from "@everaft/api-client";

import { useNativeAuth } from "../auth/NativeAuthProvider";
import { ConnectedPlanningProvider, useConnectedPlanning } from "./ConnectedPlanningProvider";
import { decodeDevicePlan, encodeDevicePlan } from "./device-plan-codec";
import { createDevicePlan, type DevicePlanData, updateDevicePlan } from "./device-plan-model";
import { useDevicePlan } from "./DevicePlanProvider";

jest.mock("@everaft/api-client", () => ({
  ...jest.requireActual("@everaft/api-client"),
  createPlanningApiClient: jest.fn(),
}));
jest.mock("../auth/NativeAuthProvider", () => ({ useNativeAuth: jest.fn() }));
jest.mock("./DevicePlanProvider", () => ({ useDevicePlan: jest.fn() }));

const accountId = "70000000-0000-4000-8000-000000000007";
const workspaceId = "60000000-0000-4000-8000-000000000006";
const getAccessToken = jest.fn(async () => "token");
const data = createDevicePlan(
  { weddingDate: null, weddingSeason: null, location: null, guestCount: 80, totalBudgetPence: 2_000_000, priorities: [] },
  new Date("2026-08-25T10:00:00.000Z"),
);
const deviceState = { status: "ready" as const, record: { data, revision: 1, savedAt: data.budgetPlan.updatedAt }, saving: false };
const saveDevicePlan = jest.fn(async (nextData: DevicePlanData) => {
  encodeDevicePlan(nextData);
  return {
    data: nextData,
    revision: 2,
    savedAt: nextData.budgetPlan.updatedAt,
  };
});

describe("ConnectedPlanningProvider", () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_EVERAFT_API_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_EVERAFT_API_URL = "https://example.test";
    jest.mocked(useDevicePlan).mockReturnValue({ state: deviceState, save: saveDevicePlan } as never);
    jest.mocked(useNativeAuth).mockReturnValue(authenticatedAuth() as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_EVERAFT_API_URL;
    else process.env.EXPO_PUBLIC_EVERAFT_API_URL = originalApiUrl;
  });

  it("hydrates only the matching plan and clears it immediately when the account signs out", async () => {
    const cloudTablePlan = {
      ...data.workspace.tablePlan,
      name: "Connected guest plan",
      guests: [{
        id: "81000000-0000-4000-8000-000000000008",
        name: "Ailsa",
        tableId: null,
        seatIndex: null,
      }],
    };
    const hydration = connectedHydration(data.budgetPlan, [], cloudTablePlan);
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => hydration),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });

    await waitFor(() => expect(view.result.current.state).toMatchObject({ status: "connected", accountId, workspaceId }));
    expect(view.result.current.data?.workspace.tablePlan).toEqual(cloudTablePlan);

    jest.mocked(useNativeAuth).mockReturnValue({ ...authenticatedAuth(), snapshot: { status: "signed_out", accountId: null, reason: null } } as never);
    await act(async () => {
      view.rerender(undefined);
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "device_only", reason: "signed_out" }));
  });

  it("requires an explicit action before importing a device-only plan", async () => {
    const importWorkspace = jest.fn(async () => ({ workspace: { id: workspaceId, role: "owner" } }));
    const hydrateWorkspace = jest.fn(async () => connectedHydration(data.budgetPlan));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [] })),
      importWorkspace,
      hydrateWorkspace,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "device_only", reason: "no_workspace" }));
    expect(importWorkspace).not.toHaveBeenCalled();

    await act(async () => { await view.result.current.connect(); });
    expect(importWorkspace).toHaveBeenCalledTimes(1);
    expect(view.result.current.state).toMatchObject({ status: "connected", accountId, workspaceId });
  });

  it("blocks plan mutations while a first connection is still establishing its scope", async () => {
    let finishImport: ((value: { workspace: { id: string; role: "owner" } }) => void) | undefined;
    const importWorkspace = jest.fn(() => new Promise<{ workspace: { id: string; role: "owner" } }>((resolve) => {
      finishImport = resolve;
    }));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [] })),
      importWorkspace,
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "device_only", reason: "no_workspace" }));
    saveDevicePlan.mockClear();

    let connecting: Promise<void> | undefined;
    await act(async () => {
      connecting = view.result.current.connect();
      await Promise.resolve();
    });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "checking" }));

    let mutation: Awaited<ReturnType<typeof view.result.current.saveTablePlan>> | undefined;
    await act(async () => {
      mutation = await view.result.current.saveTablePlan({
        ...data.workspace.tablePlan,
        name: "Must wait for connection",
      });
    });
    expect(mutation).toEqual({ outcome: "needs_attention", failure: "unavailable" });
    expect(saveDevicePlan).not.toHaveBeenCalled();

    await expect(view.result.current.saveBudget(data)).resolves.toEqual({
      outcome: "needs_attention",
      failure: "unavailable",
    });
    await expect(view.result.current.createTask({ title: "Must also wait" })).resolves.toEqual({
      outcome: "needs_attention",
      failure: "unavailable",
    });
    expect(saveDevicePlan).not.toHaveBeenCalled();

    await act(async () => {
      finishImport?.({ workspace: { id: workspaceId, role: "owner" } });
      await connecting;
    });
    expect(view.result.current.state).toMatchObject({ status: "connected", accountId, workspaceId });
    expect(saveDevicePlan).toHaveBeenCalledTimes(1);
  });

  it("saves budget changes on the device first, then uses the connected version and rehydrates", async () => {
    const cloudPlan = { ...data.budgetPlan, userId: accountId };
    const initial = connectedHydration(cloudPlan);
    const canonicalPlan = {
      ...cloudPlan,
      totalBudgetPence: 2_500_000,
      updatedAt: "2026-08-25T12:00:00.000Z",
    };
    const updateBudget = jest.fn(async () => ({
      schemaVersion: 1,
      budgetPlanId: data.budgetPlan.id,
      savedAt: canonicalPlan.updatedAt,
    }));
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(connectedHydration(canonicalPlan));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      updateBudget,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));
    const next = updateDevicePlan(view.result.current.data!, (current) => ({
      ...current,
      budgetPlan: { ...current.budgetPlan, totalBudgetPence: 2_500_000 },
    }), new Date("2026-08-25T11:00:00.000Z"));

    let result: Awaited<ReturnType<typeof view.result.current.saveBudget>> | undefined;
    await act(async () => { result = await view.result.current.saveBudget(next); });

    expect(saveDevicePlan).toHaveBeenCalledWith(expect.objectContaining({
      budgetPlan: expect.objectContaining({ userId: null, totalBudgetPence: 2_500_000 }),
      workspace: expect.objectContaining({ cloudWorkspaceId: null, ownerId: null }),
    }));
    expect(updateBudget).toHaveBeenCalledWith(workspaceId, expect.objectContaining({
      expectedBudgetUpdatedAt: data.budgetPlan.updatedAt,
      plan: expect.objectContaining({
        userId: accountId,
        totalBudgetPence: 2_500_000,
        updatedAt: data.budgetPlan.updatedAt,
      }),
    }));
    expect(saveDevicePlan).toHaveBeenLastCalledWith(expect.objectContaining({
      connectedSync: expect.objectContaining({ pendingBudget: null, pendingTablePlan: null, pendingTasks: [] }),
    }), 2);
    expect(result).toEqual({ outcome: "connected" });
    expect(view.result.current.state).toMatchObject({ status: "connected", syncStatus: "idle" });
    expect(view.result.current.data?.budgetPlan).toMatchObject(canonicalPlan);
  });

  it("keeps the device save and reports a conflict instead of claiming cloud success", async () => {
    const updateBudget = jest.fn(async () => {
      throw new PlanningApiError("version_conflict", 409);
    });
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
      updateBudget,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));
    const next = updateDevicePlan(data, (current) => current, new Date("2026-08-25T11:00:00.000Z"));

    let result: Awaited<ReturnType<typeof view.result.current.saveBudget>> | undefined;
    await act(async () => { result = await view.result.current.saveBudget(next); });

    expect(saveDevicePlan).toHaveBeenCalledWith(expect.objectContaining({
      budgetPlan: next.budgetPlan,
      connectedSync: expect.objectContaining({
        pendingBudget: {
          accountId,
          workspaceId,
          baseBudgetUpdatedAt: data.budgetPlan.updatedAt,
        },
        pendingTablePlan: null,
        pendingTasks: [],
      }),
    }));
    expect(result).toEqual({ outcome: "needs_attention", failure: "conflict" });
    expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" });
  });

  it("recovers an ambiguous budget write through the canonical item read", async () => {
    const next = updateDevicePlan(data, (current) => ({
      ...current,
      budgetPlan: { ...current.budgetPlan, totalBudgetPence: 2_750_000 },
    }), new Date("2026-08-25T11:00:00.000Z"));
    const canonicalPlan = {
      ...next.budgetPlan,
      updatedAt: "2026-08-25T12:30:00.000Z",
    };
    const hydrateWorkspace = jest.fn(async () => connectedHydration(data.budgetPlan));
    const getBudget = jest.fn(async () => connectedHydration(canonicalPlan).budget);
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      getBudget,
      updateBudget: jest.fn(async () => {
        throw new PlanningApiError("offline");
      }),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let result: Awaited<ReturnType<typeof view.result.current.saveBudget>> | undefined;
    await act(async () => { result = await view.result.current.saveBudget(next); });
    expect(result).toEqual({ outcome: "connected" });
    expect(getBudget).toHaveBeenCalledWith(workspaceId);
    expect(view.result.current.state).toMatchObject({ status: "connected", syncStatus: "idle" });
    expect(view.result.current.data?.budgetPlan).toMatchObject(canonicalPlan);
  });

  it("does not claim recovery when the canonical budget differs from the intended write", async () => {
    const next = updateDevicePlan(data, (current) => ({
      ...current,
      budgetPlan: { ...current.budgetPlan, totalBudgetPence: 2_750_000 },
    }), new Date("2026-08-25T11:00:00.000Z"));
    const canonicalPlan = {
      ...data.budgetPlan,
      totalBudgetPence: 3_000_000,
      updatedAt: "2026-08-25T12:30:00.000Z",
    };
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
      getBudget: jest.fn(async () => connectedHydration(canonicalPlan).budget),
      updateBudget: jest.fn(async () => { throw new PlanningApiError("offline"); }),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let result: Awaited<ReturnType<typeof view.result.current.saveBudget>> | undefined;
    await act(async () => { result = await view.result.current.saveBudget(next); });

    expect(result).toEqual({ outcome: "needs_attention", failure: "offline" });
    expect(view.result.current.state).toEqual({ status: "error", failure: "offline" });
  });

  it("retries a persisted budget draft on refresh when its cloud base is unchanged", async () => {
    const next = updateDevicePlan(data, (current) => ({
      ...current,
      budgetPlan: { ...current.budgetPlan, totalBudgetPence: 2_750_000 },
    }), new Date("2026-08-25T11:00:00.000Z"));
    const canonicalPlan = {
      ...next.budgetPlan,
      updatedAt: "2026-08-25T12:00:00.000Z",
    };
    let localData = data;
    const save = jest.fn(async (nextData: DevicePlanData) => {
      encodeDevicePlan(nextData);
      localData = nextData;
      return { data: nextData, revision: 2, savedAt: nextData.budgetPlan.updatedAt };
    });
    jest.mocked(useDevicePlan).mockImplementation(() => ({
      state: { status: "ready", record: { data: localData, revision: 2, savedAt: localData.budgetPlan.updatedAt }, saving: false },
      save,
    } as never));
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
      .mockResolvedValueOnce(connectedHydration(canonicalPlan));
    const updateBudget = jest.fn()
      .mockRejectedValueOnce(new PlanningApiError("offline"))
      .mockResolvedValueOnce({ schemaVersion: 1, budgetPlanId: data.budgetPlan.id, savedAt: canonicalPlan.updatedAt });
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      updateBudget,
      getBudget: jest.fn(async () => connectedHydration(data.budgetPlan).budget),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let first: Awaited<ReturnType<typeof view.result.current.saveBudget>> | undefined;
    await act(async () => { first = await view.result.current.saveBudget(next); });
    expect(first).toEqual({ outcome: "needs_attention", failure: "offline" });
    expect(localData.connectedSync.pendingBudget).toEqual({
      accountId,
      workspaceId,
      baseBudgetUpdatedAt: data.budgetPlan.updatedAt,
    });

    await act(async () => { await view.result.current.refresh(); });
    expect(updateBudget).toHaveBeenCalledTimes(2);
    expect(view.result.current.state).toMatchObject({ status: "connected", workspaceId });
    expect(view.result.current.data?.budgetPlan.totalBudgetPence).toBe(2_750_000);
    expect(localData.connectedSync.pendingBudget).toBeNull();
  });

  it("keeps a persisted budget draft when the cloud budget changed before refresh", async () => {
    const next = updateDevicePlan(data, (current) => ({
      ...current,
      budgetPlan: { ...current.budgetPlan, totalBudgetPence: 2_750_000 },
    }), new Date("2026-08-25T11:00:00.000Z"));
    const changedCloud = {
      ...data.budgetPlan,
      totalBudgetPence: 3_000_000,
      updatedAt: "2026-08-25T12:00:00.000Z",
    };
    let localData = data;
    const save = jest.fn(async (nextData: DevicePlanData) => {
      encodeDevicePlan(nextData);
      localData = nextData;
      return { data: nextData, revision: 2, savedAt: nextData.budgetPlan.updatedAt };
    });
    jest.mocked(useDevicePlan).mockImplementation(() => ({
      state: { status: "ready", record: { data: localData, revision: 2, savedAt: localData.budgetPlan.updatedAt }, saving: false },
      save,
    } as never));
    const updateBudget = jest.fn(async () => { throw new PlanningApiError("offline"); });
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
      .mockResolvedValueOnce(connectedHydration(changedCloud));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      updateBudget,
      getBudget: jest.fn(async () => connectedHydration(data.budgetPlan).budget),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    await act(async () => { await view.result.current.saveBudget(next); });
    await act(async () => { await view.result.current.refresh(); });

    expect(updateBudget).toHaveBeenCalledTimes(1);
    expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" });
    expect(view.result.current.data?.budgetPlan.totalBudgetPence).toBe(2_750_000);
  });

  it("saves a table-plan draft on the device before a connected write", async () => {
    const base = data.workspace.tablePlan;
    const intended = {
      ...base,
      guests: [{
        id: "81000000-0000-4000-8000-000000000008",
        name: "Ailsa",
        tableId: null,
        seatIndex: null,
      }],
      updatedAt: "2026-09-01T10:00:00.000Z",
    };
    const updateTablePlan = jest.fn(async () => ({
      schemaVersion: 1,
      workspaceId,
      savedAt: "2026-09-01T10:00:01.000Z",
    }));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
      updateTablePlan,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let result: Awaited<ReturnType<typeof view.result.current.saveTablePlan>> | undefined;
    await act(async () => { result = await view.result.current.saveTablePlan(intended); });

    expect(saveDevicePlan).toHaveBeenCalledWith(expect.objectContaining({
      budgetPlan: expect.objectContaining({ userId: null }),
      workspace: expect.objectContaining({
        cloudWorkspaceId: null,
        ownerId: null,
        tablePlan: intended,
      }),
    }));
    expect(updateTablePlan).toHaveBeenCalledWith(workspaceId, {
      schemaVersion: 1,
      expectedWorkspaceUpdatedAt: data.workspace.updatedAt,
      tablePlan: intended,
    });
    expect(saveDevicePlan).toHaveBeenLastCalledWith(expect.objectContaining({
      connectedSync: expect.objectContaining({ pendingBudget: null, pendingTablePlan: null, pendingTasks: [] }),
    }), 2);
    expect(result).toEqual({ outcome: "connected" });
    expect(view.result.current.data?.workspace.tablePlan.guests).toEqual(intended.guests);
  });

  it("retries once when only an unrelated workspace timestamp changed", async () => {
    const base = data.workspace.tablePlan;
    const intended = {
      ...base,
      guests: [{
        id: "81000000-0000-4000-8000-000000000008",
        name: "Ailsa",
        tableId: null,
        seatIndex: null,
      }],
      updatedAt: "2026-09-01T10:00:00.000Z",
    };
    const updateTablePlan = jest.fn()
      .mockRejectedValueOnce(new PlanningApiError("version_conflict", 409))
      .mockResolvedValueOnce({ schemaVersion: 1, workspaceId, savedAt: "2026-09-01T10:00:02.000Z" });
    const getTablePlan = jest.fn(async () => tablePlanResource(
      base,
      "2026-09-01T10:00:01.000Z",
    ));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
      updateTablePlan,
      getTablePlan,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let result: Awaited<ReturnType<typeof view.result.current.saveTablePlan>> | undefined;
    await act(async () => { result = await view.result.current.saveTablePlan(intended); });

    expect(result).toEqual({ outcome: "connected" });
    expect(updateTablePlan).toHaveBeenNthCalledWith(1, workspaceId, expect.objectContaining({
      expectedWorkspaceUpdatedAt: data.workspace.updatedAt,
    }));
    expect(updateTablePlan).toHaveBeenNthCalledWith(2, workspaceId, expect.objectContaining({
      expectedWorkspaceUpdatedAt: "2026-09-01T10:00:01.000Z",
    }));
  });

  it("recovers a lost table-plan response only when canonical content matches", async () => {
    const intended = {
      ...data.workspace.tablePlan,
      name: "Connected guest plan",
      updatedAt: "2026-09-01T10:00:00.000Z",
    };
    const getTablePlan = jest.fn(async () => tablePlanResource(
      { ...intended, updatedAt: "2026-09-01T10:00:01.000Z" },
      "2026-09-01T10:00:01.000Z",
    ));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
      updateTablePlan: jest.fn(async () => { throw new PlanningApiError("offline"); }),
      getTablePlan,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let result: Awaited<ReturnType<typeof view.result.current.saveTablePlan>> | undefined;
    await act(async () => { result = await view.result.current.saveTablePlan(intended); });

    expect(result).toEqual({ outcome: "connected" });
    expect(getTablePlan).toHaveBeenCalledWith(workspaceId);
  });

  it("retries a persisted table-plan draft on refresh when its cloud base is unchanged", async () => {
    const intended = {
      ...data.workspace.tablePlan,
      guests: [{
        id: "81000000-0000-4000-8000-000000000008",
        name: "Offline guest",
        tableId: null,
        seatIndex: null,
      }],
      updatedAt: "2026-09-01T10:00:00.000Z",
    };
    let localData = data;
    const save = jest.fn(async (nextData: DevicePlanData) => {
      encodeDevicePlan(nextData);
      localData = nextData;
      return { data: nextData, revision: 2, savedAt: nextData.workspace.updatedAt };
    });
    jest.mocked(useDevicePlan).mockImplementation(() => ({
      state: { status: "ready", record: { data: localData, revision: 2, savedAt: localData.workspace.updatedAt }, saving: false },
      save,
    } as never));
    const updateTablePlan = jest.fn()
      .mockRejectedValueOnce(new PlanningApiError("offline"))
      .mockResolvedValueOnce({ schemaVersion: 1, workspaceId, savedAt: "2026-09-01T10:00:02.000Z" });
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn()
        .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
        .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
        .mockResolvedValueOnce(connectedHydration(
          data.budgetPlan,
          [],
          intended,
          "2026-09-01T10:00:02.000Z",
        )),
      updateTablePlan,
      getTablePlan: jest.fn(async () => tablePlanResource(data.workspace.tablePlan, data.workspace.updatedAt)),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let first: Awaited<ReturnType<typeof view.result.current.saveTablePlan>> | undefined;
    await act(async () => { first = await view.result.current.saveTablePlan(intended); });
    expect(first).toEqual({ outcome: "needs_attention", failure: "offline", savedOnDevice: true });
    expect(localData.connectedSync.pendingTablePlan).toEqual({
      accountId,
      workspaceId,
      baseWorkspaceUpdatedAt: data.workspace.updatedAt,
    });

    await act(async () => { await view.result.current.refresh(); });
    expect(updateTablePlan).toHaveBeenCalledTimes(2);
    expect(view.result.current.state).toMatchObject({ status: "connected", workspaceId });
    expect(view.result.current.data?.workspace.tablePlan.guests[0]?.name).toBe("Offline guest");
    expect(localData.connectedSync.pendingTablePlan).toBeNull();
  });

  it("journals a guest edit made after a cold-start offline check and replays it on reconnect", async () => {
    const checkpointed: DevicePlanData = {
      ...data,
      connectedSync: {
        ...data.connectedSync,
        lastConnected: {
          accountId,
          workspaceId,
          budgetUpdatedAt: data.budgetPlan.updatedAt,
          workspaceUpdatedAt: data.workspace.updatedAt,
        },
      },
    };
    const intended = {
      ...data.workspace.tablePlan,
      guests: [{
        id: "81000000-0000-4000-8000-000000000008",
        name: "Cold-start offline guest",
        tableId: null,
        seatIndex: null,
      }],
      updatedAt: "2026-09-01T10:00:00.000Z",
    };
    const device = mockMutableDevicePlan(checkpointed);
    const listWorkspaces = jest.fn()
      .mockRejectedValueOnce(new PlanningApiError("offline"))
      .mockResolvedValue({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] });
    const updateTablePlan = jest.fn(async () => ({
      schemaVersion: 1,
      workspaceId,
      savedAt: "2026-09-01T10:00:02.000Z",
    }));
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
      .mockResolvedValueOnce(connectedHydration(
        data.budgetPlan,
        [],
        intended,
        "2026-09-01T10:00:02.000Z",
      ));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces,
      hydrateWorkspace,
      updateTablePlan,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "offline" }));

    let offlineResult: Awaited<ReturnType<typeof view.result.current.saveTablePlan>> | undefined;
    await act(async () => { offlineResult = await view.result.current.saveTablePlan(intended); });
    expect(offlineResult).toEqual({ outcome: "device_only" });
    expect(device.data.connectedSync.pendingTablePlan).toEqual({
      accountId,
      workspaceId,
      baseWorkspaceUpdatedAt: data.workspace.updatedAt,
    });
    await act(async () => {
      view.rerender(undefined);
      await Promise.resolve();
    });

    await act(async () => { await view.result.current.refresh(); });
    expect(updateTablePlan).toHaveBeenCalledWith(workspaceId, expect.objectContaining({
      expectedWorkspaceUpdatedAt: data.workspace.updatedAt,
      tablePlan: intended,
    }));
    expect(device.data.workspace.tablePlan).toEqual(intended);
    expect(device.data.connectedSync.pendingTablePlan).toBeNull();
    expect(view.result.current.state).toMatchObject({ status: "connected", workspaceId });
  });

  it("persists partner task additions and deletions with a replayed guest plan before offline reopen", async () => {
    const deletedTask = taskResource();
    const partnerTask = {
      ...taskResource(),
      id: "82000000-0000-4000-8000-000000000008",
      title: "Partner added this task",
      updatedAt: "2026-09-01T09:30:00.000Z",
    };
    const intended = {
      ...data.workspace.tablePlan,
      guests: [{
        id: "83000000-0000-4000-8000-000000000008",
        name: "Persisted guest",
        tableId: null,
        seatIndex: null,
      }],
      updatedAt: "2026-09-01T10:00:00.000Z",
    };
    const pendingData: DevicePlanData = {
      ...data,
      connectedSync: {
        lastConnected: {
          accountId,
          workspaceId,
          budgetUpdatedAt: data.budgetPlan.updatedAt,
          workspaceUpdatedAt: data.workspace.updatedAt,
        },
        pendingBudget: null,
        pendingTablePlan: {
          accountId,
          workspaceId,
          baseWorkspaceUpdatedAt: data.workspace.updatedAt,
        },
        pendingTasks: [],
      },
      workspace: {
        ...data.workspace,
        tasks: [deletedTask],
        tablePlan: intended,
      },
    };
    const device = mockMutableDevicePlan(pendingData);
    const cloudBeforeReplay = connectedHydration(data.budgetPlan, [partnerTask]);
    const cloudAfterReplay = connectedHydration(
      data.budgetPlan,
      [partnerTask],
      intended,
      "2026-09-01T10:00:02.000Z",
    );
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({
        workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "partner" }],
      })),
      hydrateWorkspace: jest.fn()
        .mockResolvedValueOnce(cloudBeforeReplay)
        .mockResolvedValueOnce(cloudAfterReplay),
      updateTablePlan: jest.fn(async () => ({
        schemaVersion: 1,
        workspaceId,
        savedAt: "2026-09-01T10:00:02.000Z",
      })),
    } as never);

    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toMatchObject({
      status: "connected",
      role: "partner",
    }));

    expect(device.data.workspace.tasks.map((task) => task.id)).toEqual([partnerTask.id]);
    expect(device.data.workspace.tablePlan).toEqual(intended);
    expect(device.data.connectedSync.pendingTablePlan).toBeNull();
    expect(decodeDevicePlan(encodeDevicePlan(device.data)).workspace.tasks[0]?.title)
      .toBe("Partner added this task");
  });

  it("keeps a persisted table-plan draft when the cloud base changed before refresh", async () => {
    const intended = {
      ...data.workspace.tablePlan,
      name: "Offline guest edit",
      updatedAt: "2026-09-01T10:00:00.000Z",
    };
    const changedCloud = {
      ...data.workspace.tablePlan,
      name: "Partner guest edit",
      updatedAt: "2026-09-01T10:00:01.000Z",
    };
    let localData = data;
    const save = jest.fn(async (nextData: DevicePlanData) => {
      encodeDevicePlan(nextData);
      localData = nextData;
      return { data: nextData, revision: 2, savedAt: nextData.workspace.updatedAt };
    });
    jest.mocked(useDevicePlan).mockImplementation(() => ({
      state: { status: "ready", record: { data: localData, revision: 2, savedAt: localData.workspace.updatedAt }, saving: false },
      save,
    } as never));
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
      .mockResolvedValueOnce(connectedHydration(
        data.budgetPlan,
        [],
        changedCloud,
        "2026-09-01T10:00:01.000Z",
      ));
    const updateTablePlan = jest.fn(async () => { throw new PlanningApiError("offline"); });
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      updateTablePlan,
      getTablePlan: jest.fn(async () => tablePlanResource(data.workspace.tablePlan, data.workspace.updatedAt)),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    await act(async () => { await view.result.current.saveTablePlan(intended); });
    await act(async () => { await view.result.current.refresh(); });

    expect(updateTablePlan).toHaveBeenCalledTimes(1);
    expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" });
    expect(view.result.current.data?.workspace.tablePlan.name).toBe("Offline guest edit");
  });

  it("preserves the device draft and reports a genuine table-plan divergence", async () => {
    const intended = {
      ...data.workspace.tablePlan,
      name: "My local edit",
      updatedAt: "2026-09-01T10:00:00.000Z",
    };
    const divergent = {
      ...data.workspace.tablePlan,
      name: "Partner edit",
      updatedAt: "2026-09-01T10:00:01.000Z",
    };
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
      updateTablePlan: jest.fn(async () => { throw new PlanningApiError("version_conflict", 409); }),
      getTablePlan: jest.fn(async () => tablePlanResource(divergent, divergent.updatedAt)),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let result: Awaited<ReturnType<typeof view.result.current.saveTablePlan>> | undefined;
    await act(async () => { result = await view.result.current.saveTablePlan(intended); });

    expect(saveDevicePlan).toHaveBeenCalledWith(expect.objectContaining({
      workspace: expect.objectContaining({ cloudWorkspaceId: null, ownerId: null, tablePlan: intended }),
    }));
    expect(result).toEqual({ outcome: "needs_attention", failure: "conflict", savedOnDevice: true });
    expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" });
  });

  it("accepts a freshly hydrated cloud copy and clears only its pending resources", async () => {
    const pendingData: DevicePlanData = {
      ...data,
      discovery: { ...data.discovery, savedVenueIds: ["venue-kept-on-device"] },
      budgetPlan: { ...data.budgetPlan, totalBudgetPence: 2_500_000 },
      connectedSync: {
        ...data.connectedSync,
        pendingBudget: {
          accountId,
          workspaceId,
          baseBudgetUpdatedAt: data.budgetPlan.updatedAt,
        },
      },
    };
    const cloudPlan = {
      ...data.budgetPlan,
      userId: accountId,
      totalBudgetPence: 3_000_000,
      updatedAt: "2026-08-26T10:00:00.000Z",
    };
    const hydration = connectedHydration(cloudPlan);
    const save = jest.fn(async (nextData: DevicePlanData) => ({
      data: nextData,
      revision: 2,
      savedAt: nextData.budgetPlan.updatedAt,
    }));
    jest.mocked(useDevicePlan).mockReturnValue({
      state: {
        status: "ready",
        record: { data: pendingData, revision: 1, savedAt: pendingData.budgetPlan.updatedAt },
        saving: false,
      },
      save,
    } as never);
    const listWorkspaces = jest.fn(async () => ({
      workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }],
    }));
    const hydrateWorkspace = jest.fn(async () => hydration);
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces,
      hydrateWorkspace,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" }));

    let result: Awaited<ReturnType<typeof view.result.current.acceptCloudCopy>> | undefined;
    await act(async () => { result = await view.result.current.acceptCloudCopy(); });

    expect(result).toEqual({ outcome: "resolved" });
    expect(listWorkspaces).toHaveBeenCalledTimes(2);
    expect(hydrateWorkspace).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      connectedSync: expect.objectContaining({ pendingBudget: null }),
      discovery: expect.objectContaining({ savedVenueIds: ["venue-kept-on-device"] }),
      budgetPlan: expect.objectContaining({
        totalBudgetPence: 3_000_000,
        userId: data.budgetPlan.userId,
      }),
    }), 1);
    expect(view.result.current.state).toMatchObject({ status: "connected", accountId, workspaceId });
  });

  it("keeps a device budget only against a freshly hydrated cloud version", async () => {
    const pendingData: DevicePlanData = {
      ...data,
      budgetPlan: { ...data.budgetPlan, totalBudgetPence: 2_500_000 },
      connectedSync: {
        ...data.connectedSync,
        pendingBudget: {
          accountId,
          workspaceId,
          baseBudgetUpdatedAt: data.budgetPlan.updatedAt,
        },
      },
    };
    const changedCloudPlan = {
      ...data.budgetPlan,
      userId: accountId,
      totalBudgetPence: 3_000_000,
      updatedAt: "2026-08-26T10:00:00.000Z",
    };
    const canonicalDevicePlan = {
      ...changedCloudPlan,
      totalBudgetPence: pendingData.budgetPlan.totalBudgetPence,
      updatedAt: "2026-08-26T10:05:00.000Z",
    };
    const save = jest.fn(async (nextData: DevicePlanData) => ({
      data: nextData,
      revision: 2,
      savedAt: nextData.budgetPlan.updatedAt,
    }));
    jest.mocked(useDevicePlan).mockReturnValue({
      state: {
        status: "ready",
        record: { data: pendingData, revision: 1, savedAt: pendingData.budgetPlan.updatedAt },
        saving: false,
      },
      save,
    } as never);
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(changedCloudPlan))
      .mockResolvedValueOnce(connectedHydration(changedCloudPlan))
      .mockResolvedValueOnce(connectedHydration(canonicalDevicePlan));
    const updateBudget = jest.fn(async () => ({
      schemaVersion: 1,
      budgetPlanId: data.budgetPlan.id,
      savedAt: canonicalDevicePlan.updatedAt,
    }));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({
        workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }],
      })),
      hydrateWorkspace,
      updateBudget,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" }));

    let result: Awaited<ReturnType<typeof view.result.current.keepDeviceCopy>> | undefined;
    await act(async () => { result = await view.result.current.keepDeviceCopy(); });

    expect(result).toEqual({ outcome: "resolved" });
    expect(updateBudget).toHaveBeenCalledWith(workspaceId, {
      schemaVersion: 1,
      expectedBudgetUpdatedAt: changedCloudPlan.updatedAt,
      plan: expect.objectContaining({
        totalBudgetPence: 2_500_000,
        userId: accountId,
        updatedAt: changedCloudPlan.updatedAt,
      }),
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      connectedSync: expect.objectContaining({ pendingBudget: null }),
      budgetPlan: expect.objectContaining({ totalBudgetPence: 2_500_000 }),
    }), 1);
    expect(view.result.current.state).toMatchObject({ status: "connected", accountId, workspaceId });
  });

  it("retains the device recovery marker if cloud content moves during keep-device recovery", async () => {
    const pendingData: DevicePlanData = {
      ...data,
      budgetPlan: { ...data.budgetPlan, totalBudgetPence: 2_500_000 },
      connectedSync: {
        ...data.connectedSync,
        pendingBudget: {
          accountId,
          workspaceId,
          baseBudgetUpdatedAt: data.budgetPlan.updatedAt,
        },
      },
    };
    const cloudPlan = {
      ...data.budgetPlan,
      userId: accountId,
      totalBudgetPence: 3_000_000,
      updatedAt: "2026-08-26T10:00:00.000Z",
    };
    const save = jest.fn();
    jest.mocked(useDevicePlan).mockReturnValue({
      state: {
        status: "ready",
        record: { data: pendingData, revision: 1, savedAt: pendingData.budgetPlan.updatedAt },
        saving: false,
      },
      save,
    } as never);
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({
        workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }],
      })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(cloudPlan)),
      updateBudget: jest.fn(async () => { throw new PlanningApiError("version_conflict", 409); }),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" }));

    let result: Awaited<ReturnType<typeof view.result.current.keepDeviceCopy>> | undefined;
    await act(async () => { result = await view.result.current.keepDeviceCopy(); });

    expect(result).toEqual({ outcome: "needs_attention", failure: "conflict" });
    expect(save).not.toHaveBeenCalled();
    expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" });
  });

  it("keeps mixed device task changes using each freshly hydrated task version", async () => {
    const updateId = "81000000-0000-4000-8000-000000000081";
    const createId = "82000000-0000-4000-8000-000000000082";
    const deleteId = "83000000-0000-4000-8000-000000000083";
    const cloudUpdate = {
      ...taskResource(),
      id: updateId,
      title: "Cloud title",
      updatedAt: "2026-08-26T10:00:00.000Z",
    };
    const cloudDelete = {
      ...taskResource(),
      id: deleteId,
      title: "Delete from cloud",
      updatedAt: "2026-08-26T10:01:00.000Z",
    };
    const { schemaVersion: _updateSchema, workspaceId: _updateWorkspace, ...deviceUpdateBase } = cloudUpdate;
    const deviceUpdate = { ...deviceUpdateBase, title: "Device title" };
    const deviceCreate = {
      ...deviceUpdate,
      id: createId,
      title: "Created on device",
      createdAt: "2026-08-26T09:00:00.000Z",
      updatedAt: "2026-08-26T09:00:00.000Z",
    };
    const pendingData: DevicePlanData = {
      ...data,
      workspace: { ...data.workspace, tasks: [deviceUpdate, deviceCreate] },
      connectedSync: {
        ...data.connectedSync,
        pendingTasks: [
          { kind: "update", accountId, workspaceId, taskId: updateId, baseTaskUpdatedAt: data.workspace.updatedAt },
          { kind: "create", accountId, workspaceId, taskId: createId, baseTaskUpdatedAt: null },
          { kind: "delete", accountId, workspaceId, taskId: deleteId, baseTaskUpdatedAt: data.workspace.updatedAt },
        ],
      },
    };
    const canonicalUpdate = {
      ...cloudUpdate,
      title: deviceUpdate.title,
      updatedAt: "2026-08-26T10:05:00.000Z",
    };
    const canonicalCreate = {
      schemaVersion: 1 as const,
      workspaceId,
      ...deviceCreate,
      updatedAt: "2026-08-26T10:06:00.000Z",
    };
    const cloudHydration = connectedHydration(data.budgetPlan, [cloudUpdate, cloudDelete]);
    const canonicalHydration = connectedHydration(data.budgetPlan, [canonicalUpdate, canonicalCreate]);
    const save = jest.fn(async (nextData: DevicePlanData) => ({
      data: nextData,
      revision: 2,
      savedAt: nextData.workspace.updatedAt,
    }));
    jest.mocked(useDevicePlan).mockReturnValue({
      state: {
        status: "ready",
        record: { data: pendingData, revision: 1, savedAt: pendingData.workspace.updatedAt },
        saving: false,
      },
      save,
    } as never);
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(cloudHydration)
      .mockResolvedValueOnce(cloudHydration)
      .mockResolvedValueOnce(canonicalHydration);
    const updateTask = jest.fn(async () => canonicalUpdate);
    const createTask = jest.fn(async () => canonicalCreate);
    const deleteTask = jest.fn(async () => ({ schemaVersion: 1, taskId: deleteId, deleted: true }));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({
        workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }],
      })),
      hydrateWorkspace,
      getTask: jest.fn(async () => cloudUpdate),
      updateTask,
      createTask,
      deleteTask,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" }));

    let result: Awaited<ReturnType<typeof view.result.current.keepDeviceCopy>> | undefined;
    await act(async () => { result = await view.result.current.keepDeviceCopy(); });

    expect(result).toEqual({ outcome: "resolved" });
    expect(updateTask).toHaveBeenCalledWith(workspaceId, updateId, expect.objectContaining({
      expectedTaskUpdatedAt: cloudUpdate.updatedAt,
      changes: expect.objectContaining({ title: "Device title" }),
    }));
    expect(createTask).toHaveBeenCalledWith(workspaceId, expect.objectContaining({
      task: expect.objectContaining({ id: createId, title: "Created on device" }),
    }));
    expect(deleteTask).toHaveBeenCalledWith(workspaceId, deleteId, {
      schemaVersion: 1,
      expectedTaskUpdatedAt: cloudDelete.updatedAt,
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      connectedSync: expect.objectContaining({ pendingTasks: [] }),
    }), 1);
  });

  it("keeps a device table plan only against the freshly hydrated workspace version", async () => {
    const deviceTablePlan = {
      ...data.workspace.tablePlan,
      name: "Device seating plan",
      updatedAt: "2026-08-25T11:00:00.000Z",
    };
    const cloudTablePlan = {
      ...data.workspace.tablePlan,
      name: "Partner seating plan",
      updatedAt: "2026-08-26T10:00:00.000Z",
    };
    const pendingData: DevicePlanData = {
      ...data,
      workspace: { ...data.workspace, tablePlan: deviceTablePlan },
      connectedSync: {
        ...data.connectedSync,
        pendingTablePlan: {
          accountId,
          workspaceId,
          baseWorkspaceUpdatedAt: data.workspace.updatedAt,
        },
      },
    };
    const cloudVersion = "2026-08-26T10:00:00.000Z";
    const savedVersion = "2026-08-26T10:05:00.000Z";
    const cloudHydration = connectedHydration(data.budgetPlan, [], cloudTablePlan, cloudVersion);
    const canonicalHydration = connectedHydration(data.budgetPlan, [], {
      ...deviceTablePlan,
      updatedAt: savedVersion,
    }, savedVersion);
    const save = jest.fn(async (nextData: DevicePlanData) => ({
      data: nextData,
      revision: 2,
      savedAt: nextData.workspace.updatedAt,
    }));
    jest.mocked(useDevicePlan).mockReturnValue({
      state: {
        status: "ready",
        record: { data: pendingData, revision: 1, savedAt: pendingData.workspace.updatedAt },
        saving: false,
      },
      save,
    } as never);
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(cloudHydration)
      .mockResolvedValueOnce(cloudHydration)
      .mockResolvedValueOnce(canonicalHydration);
    const updateTablePlan = jest.fn(async () => ({
      schemaVersion: 1,
      workspaceId,
      savedAt: savedVersion,
    }));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({
        workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }],
      })),
      hydrateWorkspace,
      updateTablePlan,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" }));

    let result: Awaited<ReturnType<typeof view.result.current.keepDeviceCopy>> | undefined;
    await act(async () => { result = await view.result.current.keepDeviceCopy(); });

    expect(result).toEqual({ outcome: "resolved" });
    expect(updateTablePlan).toHaveBeenCalledWith(workspaceId, {
      schemaVersion: 1,
      expectedWorkspaceUpdatedAt: cloudVersion,
      tablePlan: deviceTablePlan,
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      connectedSync: expect.objectContaining({ pendingTablePlan: null }),
      workspace: expect.objectContaining({
        tablePlan: expect.objectContaining({ name: "Device seating plan" }),
      }),
    }), 1);
  });

  it("does not apply an old recovery choice after sign-out", async () => {
    const pendingData: DevicePlanData = {
      ...data,
      budgetPlan: { ...data.budgetPlan, totalBudgetPence: 2_500_000 },
      connectedSync: {
        ...data.connectedSync,
        pendingBudget: { accountId, workspaceId, baseBudgetUpdatedAt: data.budgetPlan.updatedAt },
      },
    };
    const cloudPlan = {
      ...data.budgetPlan,
      userId: accountId,
      totalBudgetPence: 3_000_000,
      updatedAt: "2026-08-26T10:00:00.000Z",
    };
    let finishRecovery!: (value: ReturnType<typeof connectedHydration>) => void;
    const delayedHydration = new Promise<ReturnType<typeof connectedHydration>>((resolve) => {
      finishRecovery = resolve;
    });
    const save = jest.fn();
    jest.mocked(useDevicePlan).mockReturnValue({
      state: {
        status: "ready",
        record: { data: pendingData, revision: 1, savedAt: pendingData.budgetPlan.updatedAt },
        saving: false,
      },
      save,
    } as never);
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(cloudPlan))
      .mockReturnValueOnce(delayedHydration);
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({
        workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }],
      })),
      hydrateWorkspace,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" }));

    let recovery!: ReturnType<typeof view.result.current.acceptCloudCopy>;
    await act(async () => { recovery = view.result.current.acceptCloudCopy(); });
    await waitFor(() => expect(hydrateWorkspace).toHaveBeenCalledTimes(2));
    jest.mocked(useNativeAuth).mockReturnValue({
      ...authenticatedAuth(),
      snapshot: { status: "signed_out", accountId: null, reason: null },
    } as never);
    await act(async () => { view.rerender(undefined); });
    finishRecovery(connectedHydration(cloudPlan));
    let result;
    await act(async () => { result = await recovery; });

    expect(result).toEqual({ outcome: "needs_attention", failure: "unavailable" });
    expect(save).not.toHaveBeenCalled();
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "device_only", reason: "signed_out" }));
  });

  it("does not offer a persisted recovery operation to a different signed-in account", async () => {
    const otherAccountId = "71000000-0000-4000-8000-000000000071";
    const pendingData: DevicePlanData = {
      ...data,
      budgetPlan: { ...data.budgetPlan, totalBudgetPence: 2_500_000 },
      connectedSync: {
        ...data.connectedSync,
        pendingBudget: { accountId, workspaceId, baseBudgetUpdatedAt: data.budgetPlan.updatedAt },
      },
    };
    const save = jest.fn();
    jest.mocked(useDevicePlan).mockReturnValue({
      state: {
        status: "ready",
        record: { data: pendingData, revision: 1, savedAt: pendingData.budgetPlan.updatedAt },
        saving: false,
      },
      save,
    } as never);
    jest.mocked(useNativeAuth).mockReturnValue({
      ...authenticatedAuth(),
      snapshot: { status: "authenticated", accountId: otherAccountId, reason: null },
    } as never);
    const listWorkspaces = jest.fn(async () => ({
      workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }],
    }));
    const hydrateWorkspace = jest.fn(async () => connectedHydration(data.budgetPlan));
    jest.mocked(createPlanningApiClient).mockReturnValue({ listWorkspaces, hydrateWorkspace } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" }));

    let result: Awaited<ReturnType<typeof view.result.current.acceptCloudCopy>> | undefined;
    await act(async () => { result = await view.result.current.acceptCloudCopy(); });

    expect(result).toEqual({ outcome: "needs_attention", failure: "conflict" });
    expect(listWorkspaces).toHaveBeenCalledTimes(1);
    expect(hydrateWorkspace).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps recovery markers when the protected device acknowledgement write fails", async () => {
    const pendingData: DevicePlanData = {
      ...data,
      budgetPlan: { ...data.budgetPlan, totalBudgetPence: 2_500_000 },
      connectedSync: {
        ...data.connectedSync,
        pendingBudget: { accountId, workspaceId, baseBudgetUpdatedAt: data.budgetPlan.updatedAt },
      },
    };
    const cloudPlan = {
      ...data.budgetPlan,
      userId: accountId,
      totalBudgetPence: 3_000_000,
      updatedAt: "2026-08-26T10:00:00.000Z",
    };
    const save = jest.fn(async () => { throw new Error("device write failed"); });
    jest.mocked(useDevicePlan).mockReturnValue({
      state: {
        status: "ready",
        record: { data: pendingData, revision: 1, savedAt: pendingData.budgetPlan.updatedAt },
        saving: false,
      },
      save,
    } as never);
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({
        workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }],
      })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(cloudPlan)),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" }));

    let result: Awaited<ReturnType<typeof view.result.current.acceptCloudCopy>> | undefined;
    await act(async () => { result = await view.result.current.acceptCloudCopy(); });

    expect(result).toEqual({ outcome: "needs_attention", failure: "unavailable" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(pendingData.connectedSync.pendingBudget).not.toBeNull();
    expect(view.result.current.state).toEqual({ status: "error", failure: "unavailable" });
  });

  it("saves a stable task locally and recovers an ambiguous connected create by ID", async () => {
    let requestedTask: ReturnType<typeof taskResource> | null = null;
    let requestedTaskId = "";
    const createTask = jest.fn(async (_workspaceId, body) => {
      requestedTask = {
        schemaVersion: 1,
        workspaceId,
        ...body.task,
        createdAt: "2026-08-30T11:00:00.000Z",
        updatedAt: "2026-08-30T11:00:00.000Z",
      };
      requestedTaskId = body.task.id;
      throw new PlanningApiError("offline");
    });
    const getTask = jest.fn(async () => requestedTask!);
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
      createTask,
      getTask,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let result: Awaited<ReturnType<typeof view.result.current.createTask>> | undefined;
    await act(async () => { result = await view.result.current.createTask({ title: "Book transport" }); });

    expect(result).toEqual({ outcome: "connected" });
    expect(saveDevicePlan).toHaveBeenCalledWith(expect.objectContaining({
      workspace: expect.objectContaining({
        tasks: [expect.objectContaining({ title: "Book transport" })],
      }),
    }));
    expect(getTask).toHaveBeenCalledWith(workspaceId, requestedTaskId);
    expect(saveDevicePlan).toHaveBeenLastCalledWith(expect.objectContaining({
      connectedSync: expect.objectContaining({ pendingTasks: [] }),
    }), 2);
    expect(view.result.current.data?.workspace.tasks[0]).toMatchObject({ title: "Book transport" });
  });

  it("does not restore an old connected account when a task response arrives after sign-out", async () => {
    let finishCreate!: (resource: ReturnType<typeof taskResource>) => void;
    let requestedTask: ReturnType<typeof taskResource> | null = null;
    const createTask = jest.fn((_workspaceId, body) => new Promise<ReturnType<typeof taskResource>>((resolve) => {
      requestedTask = {
        schemaVersion: 1,
        workspaceId,
        ...body.task,
        createdAt: "2026-08-30T11:00:00.000Z",
        updatedAt: "2026-08-30T11:00:00.000Z",
      };
      finishCreate = resolve;
    }));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan)),
      createTask,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let pending!: ReturnType<typeof view.result.current.createTask>;
    await act(async () => {
      pending = view.result.current.createTask({ title: "Book transport" });
      await Promise.resolve();
    });
    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));

    jest.mocked(useNativeAuth).mockReturnValue({
      ...authenticatedAuth(),
      snapshot: { status: "signed_out", accountId: null, reason: null },
    } as never);
    await act(async () => {
      view.rerender(undefined);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await waitFor(() => expect(view.result.current.state).toEqual({ status: "device_only", reason: "signed_out" }));

    let result: Awaited<typeof pending> | undefined;
    await act(async () => {
      finishCreate(requestedTask!);
      result = await pending;
    });
    expect(result).toEqual({ outcome: "device_only" });
    expect(view.result.current.state).toEqual({ status: "device_only", reason: "signed_out" });
  });

  it("retries a persisted task creation on refresh and clears its operation", async () => {
    const device = mockMutableDevicePlan();
    let created: ReturnType<typeof taskResource> | null = null;
    const createTask = jest.fn(async (_workspaceId, body) => {
      created = {
        schemaVersion: 1,
        workspaceId,
        ...body.task,
        createdAt: "2026-09-11T10:00:00.000Z",
        updatedAt: "2026-09-11T10:00:00.000Z",
      };
      if (createTask.mock.calls.length === 1) throw new PlanningApiError("offline");
      return created;
    });
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
      .mockImplementation(async () => connectedHydration(data.budgetPlan, [created!]));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      createTask,
      getTask: jest.fn(async () => { throw new PlanningApiError("task_unavailable", 404); }),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    let first: Awaited<ReturnType<typeof view.result.current.createTask>> | undefined;
    await act(async () => { first = await view.result.current.createTask({ title: "Book transport" }); });
    expect(first).toEqual({ outcome: "needs_attention", failure: "offline" });
    expect(device.data.connectedSync.pendingTasks).toEqual([
      expect.objectContaining({ kind: "create", accountId, workspaceId, baseTaskUpdatedAt: null }),
    ]);
    const pendingTaskId = device.data.connectedSync.pendingTasks[0].taskId;
    let offlineEdit: Awaited<ReturnType<typeof view.result.current.updateTask>> | undefined;
    await act(async () => {
      offlineEdit = await view.result.current.updateTask(pendingTaskId, { title: "Book wedding coach" });
      view.rerender(undefined);
      await Promise.resolve();
    });
    expect(offlineEdit).toEqual({ outcome: "device_only" });
    expect(device.data.workspace.tasks[0]?.title).toBe("Book wedding coach");
    expect(device.data.connectedSync.pendingTasks).toEqual([
      expect.objectContaining({ kind: "create", taskId: pendingTaskId, baseTaskUpdatedAt: null }),
    ]);

    await act(async () => { await view.result.current.refresh(); });
    expect(createTask).toHaveBeenCalledTimes(2);
    expect(createTask.mock.calls[1][1].task.title).toBe("Book wedding coach");
    expect(view.result.current.data?.workspace.tasks[0]?.title).toBe("Book wedding coach");
    expect(device.data.connectedSync.pendingTasks).toEqual([]);
  });

  it("keeps a persisted task edit when its cloud task changed before refresh", async () => {
    const existing = taskResource();
    const changedCloud = {
      ...existing,
      title: "Partner changed this task",
      updatedAt: "2026-09-11T11:00:00.000Z",
    };
    const device = mockMutableDevicePlan();
    const updateTask = jest.fn(async () => { throw new PlanningApiError("offline"); });
    const getTask = jest.fn()
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(changedCloud);
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan, [existing]))
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan, [changedCloud]));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      updateTask,
      getTask,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.data?.workspace.tasks).toHaveLength(1));

    await act(async () => { await view.result.current.updateTask(existing.id, { status: "done" }); });
    await act(async () => { await view.result.current.refresh(); });

    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" });
    expect(view.result.current.data?.workspace.tasks[0]?.status).toBe("done");
    expect(device.data.connectedSync.pendingTasks[0]).toMatchObject({
      kind: "update",
      taskId: existing.id,
      baseTaskUpdatedAt: existing.updatedAt,
    });
  });

  it("retries a persisted task deletion on refresh when its cloud task is unchanged", async () => {
    const existing = taskResource();
    const device = mockMutableDevicePlan();
    const deleteTask = jest.fn()
      .mockRejectedValueOnce(new PlanningApiError("offline"))
      .mockResolvedValueOnce(undefined);
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan, [existing]))
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan, [existing]))
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan, []));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      deleteTask,
      getTask: jest.fn(async () => existing),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.data?.workspace.tasks).toHaveLength(1));

    let first: Awaited<ReturnType<typeof view.result.current.deleteTask>> | undefined;
    await act(async () => { first = await view.result.current.deleteTask(existing.id); });
    expect(first).toEqual({ outcome: "needs_attention", failure: "offline" });
    expect(device.data.connectedSync.pendingTasks[0]).toMatchObject({ kind: "delete", taskId: existing.id });

    await act(async () => { await view.result.current.refresh(); });
    expect(deleteTask).toHaveBeenCalledTimes(2);
    expect(view.result.current.data?.workspace.tasks).toEqual([]);
    expect(device.data.connectedSync.pendingTasks).toEqual([]);
  });

  it("recovers ambiguous updates and deletes from the canonical item read", async () => {
    const existing = taskResource();
    const updated = { ...existing, status: "done" as const, updatedAt: "2026-08-30T12:00:00.000Z" };
    const getTask = jest.fn()
      .mockResolvedValueOnce(updated)
      .mockRejectedValueOnce(new PlanningApiError("task_unavailable", 404));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => connectedHydration(data.budgetPlan, [existing])),
      updateTask: jest.fn(async () => { throw new PlanningApiError("offline"); }),
      deleteTask: jest.fn(async () => { throw new PlanningApiError("offline"); }),
      getTask,
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.data?.workspace.tasks).toHaveLength(1));

    let updateResult: Awaited<ReturnType<typeof view.result.current.updateTask>> | undefined;
    await act(async () => { updateResult = await view.result.current.updateTask(existing.id, { status: "done" }); });
    expect(updateResult).toEqual({ outcome: "connected" });
    expect(view.result.current.data?.workspace.tasks[0].status).toBe("done");

    let deleteResult: Awaited<ReturnType<typeof view.result.current.deleteTask>> | undefined;
    await act(async () => { deleteResult = await view.result.current.deleteTask(existing.id); });
    expect(deleteResult).toEqual({ outcome: "connected" });
    expect(view.result.current.data?.workspace.tasks).toEqual([]);
  });
});

function connectedHydration(
  plan: typeof data.budgetPlan,
  tasks: ReturnType<typeof taskResource>[] = [],
  tablePlan = data.workspace.tablePlan,
  workspaceUpdatedAt = data.workspace.updatedAt,
) {
  return {
    dashboard: {
      workspace: { id: workspaceId, name: "My EverAft", budgetPlanId: plan.id },
    },
    budget: {
      plan,
      versions: {
        workspaceUpdatedAt: data.workspace.updatedAt,
        budgetUpdatedAt: plan.updatedAt,
      },
    },
    profile: { profile: data.workspace.profile },
    tasks: {
      schemaVersion: 1,
      workspaceId,
      tasks,
      page: { limit: 100, offset: 0, hasMore: false },
    },
    tablePlan: tablePlanResource(tablePlan, workspaceUpdatedAt),
  };
}

function tablePlanResource(
  tablePlan: typeof data.workspace.tablePlan,
  workspaceUpdatedAt: string,
) {
  return {
    schemaVersion: 1 as const,
    workspaceId,
    workspaceUpdatedAt,
    tablePlan,
  };
}

function taskResource() {
  return {
    schemaVersion: 1 as const,
    id: "80000000-0000-4000-8000-000000000008",
    workspaceId,
    title: "Confirm guest numbers",
    notes: null,
    category: "guests" as const,
    status: "todo" as const,
    dueDate: "2027-07-01",
    sortOrder: 0,
    createdAt: "2026-08-30T10:00:00.000Z",
    updatedAt: "2026-08-30T10:00:00.000Z",
  };
}

function authenticatedAuth() {
  return {
    snapshot: { status: "authenticated" as const, accountId, reason: null },
    getAccessToken,
  };
}

function mockMutableDevicePlan(initial: DevicePlanData = data) {
  let current = initial;
  let revision = 1;
  const save = jest.fn(async (nextData: DevicePlanData) => {
    encodeDevicePlan(nextData);
    current = nextData;
    revision += 1;
    return { data: nextData, revision, savedAt: nextData.workspace.updatedAt };
  });
  jest.mocked(useDevicePlan).mockImplementation(() => ({
    state: {
      status: "ready",
      record: { data: current, revision, savedAt: current.workspace.updatedAt },
      saving: false,
    },
    save,
  } as never));
  return {
    get data() { return current; },
    save,
  };
}
