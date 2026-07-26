import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { importPlanningWorkspaceSnapshotAction } from "./planning-workspace";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const validSnapshot = {
  id: "60000000-0000-4000-8000-000000000006",
  budgetPlanId: "budget-1",
  name: "Our wedding plan",
  profile: {
    schemaVersion: 1 as const,
    weddingDate: null,
    guestCount: null,
    location: null,
    dateFlexibility: "not_set" as const,
    locationFlexible: false,
    priorities: [],
    venueStyles: [],
    photographyStyles: [],
    vision: null,
    updatedAt: "2026-07-26T10:00:00.000Z",
  },
  tasks: [],
  guests: [],
  tables: [{
    id: "90000000-0000-4000-8000-000000000009",
    name: "Top table",
    capacity: 8,
    locked: false,
  }],
  seats: [],
  rules: [],
};

describe("planning workspace server actions", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  afterEach(() => {
    vi.mocked(createClient).mockReset();
    if (previousCloudFlag === undefined) {
      delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
    } else {
      process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = previousCloudFlag;
    }
  });

  it("does not create a Supabase client when connected planning is disabled", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "false";

    const result = await importPlanningWorkspaceSnapshotAction({
      snapshot: validSnapshot,
      targetWorkspaceId: null,
      expectedUpdatedAt: null,
    });

    expect(result).toEqual({
      ok: false,
      message: "Connected planning is still in private testing. Your current plan remains saved on this device.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
