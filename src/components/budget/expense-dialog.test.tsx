import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { PlannerListing } from "@/lib/budget/types";
import { ExpenseDialog } from "./expense-dialog";
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
  // eslint-disable-next-line @next/next/no-img-element -- test-only stand-in for the optimised component.
  return <img {...props} alt={props.alt ?? ""} />;
} }));
describe("ExpenseDialog", () => {
  it("adds a manual estimated expense without showing an imported-price warning", () => { const onSave = vi.fn(); render(<ExpenseDialog open plan={createEmptyBudgetPlan()} listings={[]} item={null} onClose={vi.fn()} onSave={onSave} />); expect(screen.queryByText(/does not currently display a price/i)).toBeNull(); fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Wedding photographer" } }); fireEvent.change(screen.getByLabelText("Estimated cost (£)"), { target: { value: "1250.50" } }); fireEvent.click(screen.getByRole("button", { name: "Add to budget" })); expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ itemName: "Wedding photographer", estimatedCostPence: 125_050, source: "manual" })); });
  it("shows a manual-price fallback for an imported venue with no listed price", () => { const listing: PlannerListing = { id: "venue-1", slug: "ravenwood", name: "Ravenwood Hall", type: "Country Estate", location: "Perth, Perthshire", imageUrl: "/images/everaft-wedding-reception.png", listingUrl: "/venues/ravenwood", priceFromPence: null, priceToPence: null, pricingStatus: "unavailable" }; render(<ExpenseDialog open plan={createEmptyBudgetPlan()} listings={[listing]} item={null} onClose={vi.fn()} onSave={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: "Select from EverAft" })); fireEvent.click(screen.getByRole("button", { name: /Ravenwood Hall/ })); expect(screen.getByText(/does not currently display a price/i)).toBeTruthy(); expect(screen.getByLabelText("Estimated cost (£)")).toBeTruthy(); });
  it("imports a per-person venue price using the plan guest count", () => {
    const onSave = vi.fn();
    const plan = { ...createEmptyBudgetPlan(), guestCount: 80 };
    const listing: PlannerListing = { id: "venue-2", slug: "garden-house", name: "Garden House", type: "Country Estate", location: "Fife, Scotland", imageUrl: "/images/everaft-wedding-reception.png", listingUrl: "/venues/garden-house", priceFromPence: 9_500, priceToPence: null, pricingStatus: "per_person", pricingKind: "per_person", pricingLabel: "Wedding package", pricingUnit: "per_person" };
    render(<ExpenseDialog open plan={plan} listings={[listing]} item={null} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Select from EverAft" }));
    fireEvent.click(screen.getByRole("button", { name: /Garden House/ }));
    expect((screen.getByLabelText("Pricing basis") as HTMLSelectElement).value).toBe("per_person");
    expect((screen.getByLabelText("Price per person (£)") as HTMLInputElement).value).toBe("95");
    expect((screen.getByLabelText("Guest count") as HTMLInputElement).value).toBe("80");
    fireEvent.click(screen.getByRole("button", { name: "Add to budget" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ estimatedCostPence: null, costPerPersonPence: 9_500, guestCount: 80, importedPriceType: "per_person" }));
  });
  it("requires a tax-inclusive input instead of importing a VAT-exclusive base price", () => {
    const onSave = vi.fn();
    const listing: PlannerListing = { id: "venue-3", slug: "taxed-hall", name: "Taxed Hall", type: "Country Estate", location: "Fife, Scotland", imageUrl: "/images/everaft-wedding-reception.png", listingUrl: "/venues/taxed-hall", priceFromPence: 199_500, priceToPence: null, pricingStatus: "starting_from", pricingKind: "venue_hire", pricingLabel: "Evening hire", pricingUnit: "total", taxLabel: "VAT additional" };
    render(<ExpenseDialog open plan={createEmptyBudgetPlan()} listings={[listing]} item={null} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Select from EverAft" }));
    fireEvent.click(screen.getByRole("button", { name: /Taxed Hall/ }));
    expect(screen.getByRole("status").textContent).toMatch(/VAT additional/i);
    expect((screen.getByLabelText("Estimated cost (£)") as HTMLInputElement).value).toBe("");
  });
});
