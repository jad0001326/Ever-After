import { describe, expect, it } from "vitest";
import {
  addManualPlanningHubSupplier,
  createPlanningHubStarterPlan,
  hasPlannedNonPhotographySupplier,
} from "./plan";
import {
  getPlanningHubSupplierRoadmap,
} from "./supplier-roadmap";

describe("Planning Hub supplier roadmap", () => {
  it("keeps live discovery and manual-only categories truthful", () => {
    const entries = getPlanningHubSupplierRoadmap(
      createPlanningHubStarterPlan(null),
      "60000000-0000-4000-8000-000000000006",
    );

    expect(entries.find((entry) => entry.slug === "photographer")).toMatchObject({
      catalogueLive: true,
      href: "/planning-hub/photography?workspace=60000000-0000-4000-8000-000000000006",
    });
    expect(entries.find((entry) => entry.slug === "florist")).toMatchObject({
      catalogueLive: false,
      href: "/planning-hub/suppliers/florist?workspace=60000000-0000-4000-8000-000000000006#manual-florist",
    });
  });

  it("reopens the exact saved category item and distinguishes shared budget categories", () => {
    const withBand = addManualPlanningHubSupplier(
      createPlanningHubStarterPlan(null),
      "band-musician",
      "The Highland Set",
      180_000,
      "quoted",
    );
    const withDj = addManualPlanningHubSupplier(
      withBand,
      "dj",
      "Dancefloor DJ",
      90_000,
      "shortlisted",
    );
    const entries = getPlanningHubSupplierRoadmap(withDj);
    const band = entries.find((entry) => entry.slug === "band-musician")!;
    const dj = entries.find((entry) => entry.slug === "dj")!;

    expect(band.itemCount).toBe(1);
    expect(band.latestItem?.itemName).toBe("The Highland Set");
    expect(band.href).toBe(`/planning-hub/suppliers/band-musician?planItem=${band.latestItem?.id}#current-supplier-planning`);
    expect(dj.itemCount).toBe(1);
    expect(dj.latestItem?.itemName).toBe("Dancefloor DJ");
    expect(hasPlannedNonPhotographySupplier(withDj)).toBe(true);
  });
});
