import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createPlanningApiClient } from "@everaft/api-client";

import { useNativeAuth } from "../auth/NativeAuthProvider";
import { ConnectedPlanningProvider, useConnectedPlanning } from "./ConnectedPlanningProvider";
import { createDevicePlan } from "./device-plan-model";
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
const data = createDevicePlan({ weddingDate: null, weddingSeason: null, location: null, guestCount: 80, totalBudgetPence: 2_000_000, priorities: [] });
const deviceState = { status: "ready" as const, record: { data, revision: 1, savedAt: data.budgetPlan.updatedAt }, saving: false };

describe("ConnectedPlanningProvider", () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_EVERAFT_API_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_EVERAFT_API_URL = "https://example.test";
    jest.mocked(useDevicePlan).mockReturnValue({ state: deviceState } as never);
    jest.mocked(useNativeAuth).mockReturnValue(authenticatedAuth() as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_EVERAFT_API_URL;
    else process.env.EXPO_PUBLIC_EVERAFT_API_URL = originalApiUrl;
  });

  it("hydrates only the matching plan and clears it immediately when the account signs out", async () => {
    const hydration = { dashboard: {}, budget: {}, profile: {} };
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
    const hydrateWorkspace = jest.fn(async () => ({ dashboard: {}, budget: {}, profile: {} }));
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
});

function authenticatedAuth() {
  return {
    snapshot: { status: "authenticated" as const, accountId, reason: null },
    getAccessToken,
  };
}
