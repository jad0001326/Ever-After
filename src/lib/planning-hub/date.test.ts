import { describe, expect, it } from "vitest";
import { getPlanningHubDateKey } from "./date";

describe("Planning Hub date", () => {
  it("uses the Scottish calendar day across the summer UTC boundary", () => {
    expect(getPlanningHubDateKey(new Date("2026-07-28T23:30:00Z")))
      .toBe("2026-07-29");
  });

  it("remains deterministic when another time zone is requested", () => {
    expect(getPlanningHubDateKey(
      new Date("2026-07-28T23:30:00Z"),
      "UTC",
    )).toBe("2026-07-28");
  });
});
