import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetPlan } from "@/lib/budget/types";
import { addManualPlanningHubVenue, choosePlanningHubVenue, createPlanningHubStarterPlan, upsertPlanningHubVenue } from "@/lib/planning-hub/plan";
import type { PlanningHubSearchParams, PlanningHubVenue, PlanningHubVenueDetail, PlanningHubVenueResults } from "@/lib/planning-hub/types";
import { PlanningHubWorkspace } from "./planning-hub-workspace";

const loadVenueDetail = vi.fn();
const saveConnectedBudgetPlan = vi.fn();

vi.mock("@/app/actions/budget", () => ({
  saveBudgetPlan: vi.fn(async () => ({ ok: true }))
}));

vi.mock("@/app/actions/favourites", () => ({
  toggleFavourite: vi.fn(async () => ({ ok: true, message: "Saved." }))
}));

vi.mock("@/app/actions/planning-hub", () => ({
  loadPlanningHubVenueDetailAction: (...args: unknown[]) => loadVenueDetail(...args)
}));

vi.mock("@/app/actions/planning-workspace", () => ({
  saveConnectedBudgetPlanAction: (...args: unknown[]) => saveConnectedBudgetPlan(...args),
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
    saveConnectedBudgetPlan.mockReset();
    saveConnectedBudgetPlan.mockResolvedValue({ ok: true });
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

  it("opens the exact planned venue requested by a booking-stage link", () => {
    const firstPlan = addManualPlanningHubVenue(
      createPlanningHubStarterPlan(null),
      "First venue",
      325_000,
      "quoted",
    );
    firstPlan.items[0] = { ...firstPlan.items[0], source: "website" };
    const plan = addManualPlanningHubVenue(
      firstPlan,
      "Later venue",
      500_000,
      "booked",
    );
    plan.selectedVenueId = plan.items[1].id;
    renderWorkspace(plan, null, { planItem: plan.items[0].id });

    expect(screen.getByRole("heading", { name: "First venue" })).toBeTruthy();
    expect(screen.getByText("This saved venue is ready for payment planning.")).toBeTruthy();
  });

  it("keeps shared workspace identity in the photography handoff", () => {
    renderWorkspace(
      createPlanningHubStarterPlan(null),
      "60000000-0000-4000-8000-000000000006",
    );

    expect(screen.getByRole("link", { name: /Next: choose your photographer/i }).getAttribute("href"))
      .toContain("workspace=60000000-0000-4000-8000-000000000006");
  });

  it("confirms venue removal, clears the chosen venue and allows it to be added again", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Add venue to plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose as main venue" }));

    fireEvent.click(screen.getByRole("button", { name: "Remove from plan" }));
    expect(screen.getByRole("group", { name: /Remove Venue One from your plan/i })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep in plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep in plan" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove from plan" }));
    expect(screen.getByRole("button", { name: "This is your chosen venue" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove from plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove from plan" }));

    const heading = within(screen.getByTestId("current-venue-planning"))
      .getByRole("heading", { name: "Venue One" });
    expect(screen.getByRole("button", { name: "Add venue to plan" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "This is your chosen venue" })).toBeNull();
    expect(screen.queryByText("Venue shortlist")).toBeNull();
    expect(screen.queryByText("cancelled")).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/removed from your plan/i);
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("saves connected venue removal through the existing protected plan boundary", async () => {
    const planned = upsertPlanningHubVenue(
      createPlanningHubStarterPlan("user-1"),
      venues[0],
      650_000,
      "booked",
    );
    const selected = choosePlanningHubVenue(planned, venues[0].id);
    renderWorkspace(
      selected,
      "60000000-0000-4000-8000-000000000006",
      {},
      "user-1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove from plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove from plan" }));

    await waitFor(() => expect(saveConnectedBudgetPlan).toHaveBeenCalledOnce());
    const [, savedPlan] = saveConnectedBudgetPlan.mock.calls[0] as [string, BudgetPlan];
    expect(savedPlan.selectedVenueId).toBeNull();
    expect(savedPlan.items[0]).toMatchObject({
      bookingStatus: "cancelled",
      costStatus: "cancelled",
    });
  });
});

function renderWorkspace(
  initialPlan: BudgetPlan = createPlanningHubStarterPlan(null),
  connectedWorkspaceId: string | null = null,
  searchParams: PlanningHubSearchParams = {},
  userId: string | null = null,
) {
  return render(
    <PlanningHubWorkspace
      connectedWorkspaceId={connectedWorkspaceId}
      initialPlan={initialPlan}
      initialSavedVenueIds={[]}
      results={results}
      searchParams={searchParams}
      userId={userId}
    />
  );
}
