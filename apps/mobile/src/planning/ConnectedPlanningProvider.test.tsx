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
    const hydration = connectedHydration(data.budgetPlan);
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace: jest.fn(async () => hydration),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });

    await waitFor(() => expect(view.result.current.state).toMatchObject({ status: "connected", accountId, workspaceId }));

    jest.mocked(useNativeAuth).mockReturnValue({ ...authenticatedAuth(), snapshot: { status: "signed_out", accountId: null, reason: null } } as never);
    await act(async () => { view.rerender(undefined); });
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

  it("recovers an ambiguous write through a fresh canonical hydration", async () => {
    const next = updateDevicePlan(data, (current) => ({
      ...current,
      budgetPlan: { ...current.budgetPlan, totalBudgetPence: 2_750_000 },
    }), new Date("2026-08-25T11:00:00.000Z"));
    const canonicalPlan = {
      ...next.budgetPlan,
      updatedAt: "2026-08-25T12:30:00.000Z",
    };
    const hydrateWorkspace = jest.fn()
      .mockResolvedValueOnce(connectedHydration(data.budgetPlan))
      .mockResolvedValueOnce(connectedHydration(canonicalPlan));
    jest.mocked(createPlanningApiClient).mockReturnValue({
      listWorkspaces: jest.fn(async () => ({ workspaces: [{ id: workspaceId, budgetPlanId: data.budgetPlan.id, role: "owner" }] })),
      hydrateWorkspace,
      updateBudget: jest.fn(async () => {
        throw new PlanningApiError("offline");
      }),
    } as never);
    const view = await renderHook(() => useConnectedPlanning(), { wrapper: ConnectedPlanningProvider });
    await waitFor(() => expect(view.result.current.state.status).toBe("connected"));

    await act(async () => { await view.result.current.saveBudget(next); });
    expect(view.result.current.state).toEqual({ status: "error", failure: "offline" });

    await act(async () => { await view.result.current.refresh(); });
    expect(view.result.current.state).toMatchObject({ status: "connected", syncStatus: "idle" });
    expect(view.result.current.data?.budgetPlan).toMatchObject(canonicalPlan);
  });
});

function connectedHydration(plan: typeof data.budgetPlan) {
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
  };
}

function authenticatedAuth() {
  return {
    snapshot: { status: "authenticated" as const, accountId, reason: null },
    getAccessToken,
  };
}
