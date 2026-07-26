import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetPlan } from "@/lib/budget/types";
import { addManualPlanningHubVenue, choosePlanningHubVenue, createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import type { PlanningHubVenue, PlanningHubVenueDetail, PlanningHubVenueResults } from "@/lib/planning-hub/types";
import { PlanningHubWorkspace } from "./planning-hub-workspace";

const loadVenueDetail = vi.fn();

vi.mock("@/app/actions/budget", () => ({
  saveBudgetPlan: vi.fn(async () => ({ ok: true }))
}));

vi.mock("@/app/actions/favourites", () => ({
  toggleFavourite: vi.fn(async () => ({ ok: true, message: "Saved." }))
}));

vi.mock("@/app/actions/planning-hub", () => ({
  loadPlanningHubVenueDetailAction: (...args: unknown[]) => loadVenueDetail(...args)
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element -- test-only stand-in for the optimised component.
    return <img {...props} alt={props.alt ?? ""} />;
  }
}));

const venues: PlanningHubVenue[] = [
  {
    id: "venue-1",
    slug: "venue-one",
    name: "Venue One",
    type: "Castle",
    town: "Perth",
    region: "Perthshire",
    summary: "A castle venue.",
    capacityMax: 120,
    imageUrl: "/images/everaft-wedding-reception.png",
    priceFromPence: 650_000,
    pricingLabel: "Venue hire",
    pricingUnit: "total",
    hasApprovedPhoto: false
  },
  {
    id: "venue-2",
    slug: "venue-two",
    name: "Venue Two",
    type: "Country Estate",
    town: "St Andrews",
    region: "Fife",
    summary: "A country estate.",
    capacityMax: 90,
    imageUrl: "/images/everaft-wedding-reception.png",
    priceFromPence: 500_000,
    pricingLabel: "Exclusive use",
    pricingUnit: "total",
    hasApprovedPhoto: true
  }
];

const results: PlanningHubVenueResults = {
  venues,
  total: 2,
  page: 1,
  totalPages: 1
};

const detail: PlanningHubVenueDetail = {
  ...venues[0],
  description: "Venue One has ceremony and reception spaces.",
  capacityMin: 20,
  officialWebsiteUrl: null,
  imageCredit: null,
  gallery: [{ id: "image-1", url: "/images/everaft-wedding-reception.png", alt: "Venue One" }],
  amenities: ["Exclusive use"]
};

describe("PlanningHubWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    loadVenueDetail.mockReset();
    loadVenueDetail.mockResolvedValue(detail);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("compares two venues while retaining distinct result cards", () => {
    renderWorkspace();
    const compareButtons = screen.getAllByRole("button", { name: "Compare" });

    fireEvent.click(compareButtons[0]);
    expect(screen.getByRole("heading", { name: "Choose one more venue" })).toBeTruthy();
    fireEvent.click(compareButtons[1]);

    expect(screen.getByRole("heading", { name: "Compare your strongest options" })).toBeTruthy();
    expect(screen.getByText("2 of 3 selected")).toBeTruthy();
    expect(screen.getAllByText("Venue One").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Venue Two").length).toBeGreaterThan(1);
  });

  it("moves focus into opened details and returns it to the trigger on close", async () => {
    renderWorkspace();
    const viewButton = screen.getAllByRole("button", { name: "View" })[0];
    viewButton.focus();
    fireEvent.click(viewButton);

    const detailPanel = await screen.findByRole("region", { name: "Venue One details" });
    await waitFor(() => expect(document.activeElement).toBe(detailPanel));

    fireEvent.click(screen.getByRole("button", { name: "Close venue details" }));
    await waitFor(() => expect(document.activeElement).toBe(viewButton));
  });

  it("adds an unlisted venue to the local plan", async () => {
    renderWorkspace();
    const manualVenue = screen.getByText("Venue not listed?").closest("details");
    expect(manualVenue).toBeTruthy();
    fireEvent.click(within(manualVenue!).getByText("Venue not listed?"));
    fireEvent.change(within(manualVenue!).getByLabelText("Venue name"), { target: { value: "Our village hall" } });
    fireEvent.change(within(manualVenue!).getByLabelText("Planning cost"), { target: { value: "3250" } });
    fireEvent.change(within(manualVenue!).getByLabelText("Planning stage"), { target: { value: "booked" } });
    fireEvent.click(within(manualVenue!).getByRole("button", { name: "Add manual venue" }));

    expect(await screen.findByRole("heading", { name: "Our village hall" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/added manually/i);
    expect(screen.getAllByText("£3,250").length).toBeGreaterThan(0);
  });

  it("keeps a manually chosen venue active after reopening the workspace", () => {
    const manualPlan = addManualPlanningHubVenue(
      createPlanningHubStarterPlan(null),
      "Our village hall",
      325_000,
      "booked",
    );
    const reopenedPlan = choosePlanningHubVenue(manualPlan, manualPlan.items[0].id);
    renderWorkspace(reopenedPlan);

    expect(screen.getByRole("heading", { name: "Our village hall" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "This is your chosen venue" })).toBeTruthy();
  });
});

function renderWorkspace(initialPlan: BudgetPlan = createPlanningHubStarterPlan(null)) {
  return render(
    <PlanningHubWorkspace
      initialPlan={initialPlan}
      initialSavedVenueIds={[]}
      results={results}
      searchParams={{}}
      userId={null}
    />
  );
}
