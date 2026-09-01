import { buildPlanningTableHandoffUrl } from "./planning-web-handoff";

describe("buildPlanningTableHandoffUrl", () => {
  it("opens the RLS-protected Organise workspace for a connected plan", () => {
    expect(buildPlanningTableHandoffUrl(
      "https://www.everaft.co.uk",
      "60000000-0000-4000-8000-000000000006",
    )).toBe(
      "https://www.everaft.co.uk/planning-hub/organise?workspace=60000000-0000-4000-8000-000000000006#guest-readiness-title",
    );
  });

  it("labels device-only handoff through the separate public planner path", () => {
    expect(buildPlanningTableHandoffUrl(
      "https://www.everaft.co.uk",
      null,
    )).toBe("https://www.everaft.co.uk/wedding-table-planner");
  });
});
