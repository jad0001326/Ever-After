import { describe, expect, it } from "vitest";
import { buildPlanningHubHref, normalisePlanningHubSearchParams, safePostgrestSearch } from "./search";

describe("Planning Hub search", () => {
  it("normalises and bounds URL filters", () => {
    expect(normalisePlanningHubSearchParams({
      search: "  loch-side  ",
      location: " Highlands ",
      guests: "120",
      budget: "8000",
      type: "Castle",
      page: "-2"
    })).toEqual({
      search: "loch-side",
      location: "Highlands",
      guests: 120,
      budgetPence: 800_000,
      type: "Castle",
      page: 1
    });
  });

  it("removes PostgREST control characters from free text", () => {
    expect(safePostgrestSearch("Fife%,name.eq.secret")).toBe("Fife name eq secret");
  });

  it("builds a stable beta-route URL", () => {
    expect(buildPlanningHubHref({ location: "Perthshire", guests: "80", page: "2" }))
      .toBe("/planning-hub?location=Perthshire&guests=80&page=2");
  });
});
