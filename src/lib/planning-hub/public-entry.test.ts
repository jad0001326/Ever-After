import { describe, expect, it } from "vitest";
import { planningHubPublicEntryEnabled } from "./public-entry";

describe("Planning Hub public entry gate", () => {
  it("stays closed by default", () => {
    expect(planningHubPublicEntryEnabled({})).toBe(false);
    expect(planningHubPublicEntryEnabled({ PLANNING_HUB_PUBLIC_ENTRY_ENABLED: "false" })).toBe(false);
  });

  it("opens only for the explicit true value", () => {
    expect(planningHubPublicEntryEnabled({ PLANNING_HUB_PUBLIC_ENTRY_ENABLED: "true" })).toBe(true);
    expect(planningHubPublicEntryEnabled({ PLANNING_HUB_PUBLIC_ENTRY_ENABLED: "TRUE" })).toBe(false);
    expect(planningHubPublicEntryEnabled({ PLANNING_HUB_PUBLIC_ENTRY_ENABLED: "1" })).toBe(false);
  });
});
