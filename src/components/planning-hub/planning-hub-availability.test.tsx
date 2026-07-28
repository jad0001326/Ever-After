import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { plannerListingToBudgetItem } from "@/lib/budget/listing-pricing";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import { PlanningHubAvailability } from "./planning-hub-availability";

function item() {
  return plannerListingToBudgetItem({
    id: "supplier-1",
    slug: "supplier-one",
    name: "Supplier One",
    type: "Photographer",
    categoryId: "photography",
    location: "Perthshire",
    imageUrl: "/supplier.jpg",
    listingUrl: "/photographers/supplier-one",
    priceFromPence: 200_000,
    priceToPence: null,
    pricingStatus: "starting_from",
  }, createEmptyBudgetPlan());
}

describe("PlanningHubAvailability", () => {
  it("does not pretend to know availability before the wedding date is set", () => {
    render(<PlanningHubAvailability item={item()} onChange={vi.fn()} weddingDate={null} />);

    expect(screen.getByText(/does not infer calendar availability/i)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("records an explicit availability state for the current wedding date", () => {
    const onChange = vi.fn();
    render(<PlanningHubAvailability item={item()} onChange={onChange} weddingDate="2027-06-12" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Availability for 12 Jun 2027" }), {
      target: { value: "enquiry_sent" },
    });
    expect(onChange).toHaveBeenCalledWith("enquiry_sent");
  });

  it("requires a new confirmation when the wedding date changes", () => {
    const checkedItem = {
      ...item(),
      availabilityStatus: "available" as const,
      availabilityDate: "2027-06-12",
    };
    render(<PlanningHubAvailability item={checkedItem} onChange={vi.fn()} weddingDate="2027-06-19" />);

    expect(screen.getByRole("combobox")).toHaveProperty("value", "not_checked");
    expect(screen.getByText(/last checked for 12 Jun 2027/i)).toBeTruthy();
    expect(screen.getByText(/confirm availability again for 19 Jun 2027/i)).toBeTruthy();
  });

  it("does not reuse an undated legacy confirmation after a date is added", () => {
    const checkedItem = {
      ...item(),
      availabilityStatus: "available" as const,
      availabilityDate: null,
    };
    render(<PlanningHubAvailability item={checkedItem} onChange={vi.fn()} weddingDate="2027-06-19" />);

    expect(screen.getByText(/recorded before the current wedding date was set/i)).toBeTruthy();
    expect(screen.getByText(/confirm availability again for 19 Jun 2027/i)).toBeTruthy();
  });
});
