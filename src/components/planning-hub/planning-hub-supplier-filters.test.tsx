import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanningHubPhotographyFilters } from "./planning-hub-photography-filters";
import { PlanningHubSupplierFilters } from "./planning-hub-supplier-filters";

const derivedFilters = {
  budget: true,
  location: true,
  venue: true,
};

describe("Planning Hub supplier filter context", () => {
  it("explains plan-derived photography filters without presenting them as user overrides", () => {
    render(
      <PlanningHubPhotographyFilters
        derivedFilters={derivedFilters}
        params={{
          budget: "13500",
          location: "Perthshire",
          venue: "venue-1",
        }}
        remainingPence={1_350_000}
        selectedVenueName="Venue One"
        weddingDate="2027-06-12"
      />,
    );

    const budgetInput = screen.getByLabelText("Photography budget") as HTMLInputElement;
    const locationInput = screen.getByLabelText("Location") as HTMLInputElement;

    expect(budgetInput.value).toBe("13500");
    expect(budgetInput.getAttribute("aria-describedby"))
      .toBe("photography-budget-source");
    expect(locationInput.value).toBe("Perthshire");
    expect(locationInput.getAttribute("aria-describedby"))
      .toBe("photography-location-source");
    expect(screen.getByText(/Using the amount remaining in your connected plan/i))
      .toBeTruthy();
    expect(screen.getByText(/From your Wedding Profile/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Reset filters" })).toBeNull();
  });

  it("keeps explicit category filters resettable and does not label them as derived", () => {
    render(
      <PlanningHubSupplierFilters
        category={{
          slug: "videographer",
          label: "Videographer",
          plural: "Videographers",
          budgetCategoryId: "videography",
        }}
        derivedFilters={{
          budget: false,
          location: false,
          venue: false,
        }}
        params={{
          budget: "900",
          location: "Skye",
          workspace: "60000000-0000-4000-8000-000000000006",
        }}
        remainingPence={1_350_000}
        selectedVenueName="Venue One"
        weddingDate="2027-06-12"
      />,
    );

    expect((screen.getByLabelText("Videographer budget") as HTMLInputElement).value)
      .toBe("900");
    expect(screen.queryByText(/Using the amount remaining in your connected plan/i))
      .toBeNull();
    expect(screen.getByRole("link", { name: "Reset filters" }).getAttribute("href"))
      .toBe("/planning-hub/suppliers/videographer?workspace=60000000-0000-4000-8000-000000000006");
  });
});
