import { describe, expect, it } from "vitest";
import { homePositioningFor } from "./home-positioning";

describe("homepage planning positioning", () => {
  it("advertises only current public tools while Planning Hub entry is closed", () => {
    const positioning = homePositioningFor(false);

    expect(positioning.primary.href).toBe("/venues");
    expect(positioning.secondary.href).toBe("/wedding-budget-planner");
    expect(JSON.stringify(positioning)).not.toContain("/planning-hub");
    expect(positioning.heroDescription).toContain("free budget and table tools");
  });

  it("exposes the connected beta journey only after the public entry gate opens", () => {
    const positioning = homePositioningFor(true);

    expect(positioning.primary).toEqual({ href: "/planning-hub", label: "Start your Planning Hub beta" });
    expect(positioning.steps.map(([title]) => title)).toEqual(["Discover", "Decide", "Organise"]);
    expect(positioning.heroDescription).toContain("bookings, payments, guests and tables");
  });
});
