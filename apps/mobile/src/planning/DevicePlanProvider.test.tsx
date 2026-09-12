import { act, renderHook, waitFor } from "@testing-library/react-native";

import { createDevicePlan } from "./device-plan-model";
import { DevicePlanConflictError } from "./device-plan-repository";
import { getDevicePlanRepository } from "./device-plan-runtime";
import { DevicePlanProvider, useDevicePlan } from "./DevicePlanProvider";

jest.mock("./device-plan-runtime", () => ({ getDevicePlanRepository: jest.fn() }));

it("uses an acknowledged revision for a follow-up write without rolling state back on failure", async () => {
  const data = createDevicePlan({
    weddingDate: null,
    weddingSeason: null,
    location: null,
    guestCount: 80,
    totalBudgetPence: 2_000_000,
    priorities: [],
  });
  const initial = { data, revision: 1, savedAt: data.workspace.updatedAt };
  const acknowledged = {
    data: { ...data, connectedSync: { pendingBudget: null, pendingTablePlan: null, pendingTasks: [] } },
    revision: 2,
    savedAt: "2026-09-11T10:00:00.000Z",
  };
  const save = jest.fn()
    .mockResolvedValueOnce(acknowledged)
    .mockRejectedValueOnce(new DevicePlanConflictError());
  jest.mocked(getDevicePlanRepository).mockResolvedValue({
    load: jest.fn(async () => ({ kind: "ready", record: initial })),
    save,
  } as never);
  const view = await renderHook(() => useDevicePlan(), { wrapper: DevicePlanProvider });
  await waitFor(() => expect(view.result.current.state).toMatchObject({ status: "ready", record: { revision: 1 } }));

  let first;
  await act(async () => {
    first = await view.result.current.save(data);
  });
  expect(first).toEqual(acknowledged);

  await act(async () => {
    await expect(view.result.current.save(data, acknowledged.revision)).rejects.toBeInstanceOf(DevicePlanConflictError);
  });
  expect(save).toHaveBeenNthCalledWith(1, data, 1);
  expect(save).toHaveBeenNthCalledWith(2, data, 2);
  expect(view.result.current.state).toMatchObject({ status: "ready", record: { revision: 2 }, saving: false });
});
