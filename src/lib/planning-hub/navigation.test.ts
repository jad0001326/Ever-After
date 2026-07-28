import { describe, expect, it } from "vitest";
import { withPlanningWorkspace } from "./navigation";

describe("Planning Hub navigation", () => {
  it("leaves personal-plan links unchanged", () => {
    expect(withPlanningWorkspace("/planning-hub/photography?budget=2000", null))
      .toBe("/planning-hub/photography?budget=2000");
  });

  it("preserves query and hash context while adding one shared workspace", () => {
    expect(withPlanningWorkspace(
      "/planning-hub/photography?budget=2000#manual-photographer",
      "60000000-0000-4000-8000-000000000006",
    )).toBe(
      "/planning-hub/photography?budget=2000&workspace=60000000-0000-4000-8000-000000000006#manual-photographer",
    );
  });

  it("replaces stale workspace context rather than duplicating it", () => {
    expect(withPlanningWorkspace(
      "/planning-hub?workspace=old",
      "60000000-0000-4000-8000-000000000006",
    )).toBe("/planning-hub?workspace=60000000-0000-4000-8000-000000000006");
  });
});
