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
});
