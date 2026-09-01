import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createPlanningApiClient, PlanningApiError } from "@everaft/api-client";

import { useNativeAuth } from "../auth/NativeAuthProvider";
import { ConnectedPlanningProvider, useConnectedPlanning } from "./ConnectedPlanningProvider";
import { createDevicePlan, updateDevicePlan } from "./device-plan-model";
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
const saveDevicePlan = jest.fn(async (nextData) => ({
  data: nextData,
  revision: 2,
  savedAt: nextData.budgetPlan.updatedAt,
}));

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

    expect(saveDevicePlan).toHaveBeenCalledWith(next);
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
      workspace: expect.objectContaining({ tablePlan: intended }),
    }));
    expect(updateTablePlan).toHaveBeenCalledWith(workspaceId, {
      schemaVersion: 1,
      expectedWorkspaceUpdatedAt: data.workspace.updatedAt,
      tablePlan: intended,
    });
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
      workspace: expect.objectContaining({ tablePlan: intended }),
    }));
    expect(result).toEqual({ outcome: "needs_attention", failure: "conflict" });
    expect(view.result.current.state).toEqual({ status: "error", failure: "conflict" });
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
    expect(view.result.current.data?.workspace.tasks[0]).toMatchObject({ title: "Book transport" });
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
