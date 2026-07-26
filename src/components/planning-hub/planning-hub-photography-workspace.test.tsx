import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetPlan } from "@/lib/budget/types";
import { addManualPlanningHubPhotographer, createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import type {
  PlanningHubPhotographer,
  PlanningHubPhotographerDetail,
  PlanningHubPhotographerResults
} from "@/lib/planning-hub/types";
import { PlanningHubPhotographyWorkspace } from "./planning-hub-photography-workspace";

const loadPhotographerDetail = vi.fn();

vi.mock("@/app/actions/budget", () => ({
  saveBudgetPlan: vi.fn(async () => ({ ok: true }))
}));

vi.mock("@/app/actions/planning-hub", () => ({
  loadPlanningHubPhotographerDetailAction: (...args: unknown[]) => loadPhotographerDetail(...args)
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element -- test-only stand-in for the optimised component.
    return <img {...props} alt={props.alt ?? ""} />;
  }
}));

const photographers: PlanningHubPhotographer[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "photographer-one",
    name: "Photographer One",
    baseTown: "Perth",
    region: "Perthshire",
    summary: "Natural documentary photography.",
    styles: ["Documentary"],
    heroImageUrl: "/everaft-logo-mark.svg",
    hasApprovedPhoto: false,
    startingPricePence: null,
    typicalPricePence: null,
    pricingSummary: "Quote required",
    pricingUnit: "quote",
    isClaimed: true,
    travelsNationwide: true
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    slug: "photographer-two",
    name: "Photographer Two",
    baseTown: "Dundee",
    region: "Angus",
    summary: "Editorial wedding photography.",
    styles: ["Editorial"],
    heroImageUrl: "/everaft-logo-mark.svg",
    hasApprovedPhoto: false,
    startingPricePence: 160_000,
    typicalPricePence: 220_000,
    pricingSummary: "Full day packages",
    pricingUnit: "package",
    isClaimed: false,
    travelsNationwide: false
  }
];

const results: PlanningHubPhotographerResults = {
  photographers,
  total: 2,
  page: 1,
  totalPages: 1
};

const detail: PlanningHubPhotographerDetail = {
  ...photographers[0],
  description: "Photographer One captures natural wedding stories.",
  services: ["Full-day coverage"],
  officialWebsiteUrl: "https://example.invalid",
  enquiryUrl: null,
  gallery: [],
  coverageHoursMin: 8,
  coverageHoursMax: 10,
  turnaroundWeeksMin: 6,
  turnaroundWeeksMax: 8
};

describe("PlanningHubPhotographyWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    loadPhotographerDetail.mockReset();
    loadPhotographerDetail.mockResolvedValue(detail);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("compares photographers without adding them to the budget", () => {
    renderWorkspace();
    const compareButtons = screen.getAllByRole("button", { name: "Compare" });

    fireEvent.click(compareButtons[0]);
    fireEvent.click(compareButtons[1]);

    expect(screen.getByRole("heading", { name: "Compare your photography options" })).toBeTruthy();
    expect(screen.getByText("2 of 3 selected")).toBeTruthy();
    expect(screen.queryByText("Photography shortlist")).toBeNull();
  });

  it("opens details accessibly and records a quote in the connected budget", async () => {
    renderWorkspace();
    const viewButton = screen.getAllByRole("button", { name: "View & plan" })[0];
    viewButton.focus();
    fireEvent.click(viewButton);

    const detailPanel = await screen.findByRole("region", { name: "Photographer One details" });
    await waitFor(() => expect(document.activeElement).toBe(detailPanel));
    fireEvent.click(screen.getByRole("button", { name: "Close photographer details" }));
    await waitFor(() => expect(document.activeElement).toBe(viewButton));

    fireEvent.change(screen.getAllByLabelText("Planning stage")[0], { target: { value: "quoted" } });
    fireEvent.change(screen.getByLabelText("Working estimate or quote"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add photographer to plan" }));

    expect(await screen.findByText("Photography shortlist")).toBeTruthy();
    expect(screen.getAllByText("Photographer One").length).toBeGreaterThan(1);
    expect(screen.getAllByText("£18,500").length).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toMatch(/recorded with a quote/i);
  });

  it("keeps a manual photographer path for an unlisted supplier", async () => {
    renderWorkspace();
    const manual = screen.getByText("Photographer not listed?").closest("details");
    expect(manual).toBeTruthy();
    fireEvent.click(within(manual!).getByText("Photographer not listed?"));
    fireEvent.change(within(manual!).getByLabelText("Photographer name"), { target: { value: "A family friend" } });
    fireEvent.change(within(manual!).getByLabelText("Working cost"), { target: { value: "500" } });
    fireEvent.click(within(manual!).getByRole("button", { name: "Add manual photographer" }));

    expect(await screen.findByRole("heading", { name: "A family friend" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/added manually/i);
  });

  it("keeps the latest manual photographer active after reopening the workspace", () => {
    const reopenedPlan = addManualPlanningHubPhotographer(
      createPlanningHubStarterPlan(null),
      "A family friend",
      50_000,
      "quoted",
    );
    renderWorkspace(reopenedPlan);

    expect(screen.getByRole("heading", { name: "A family friend" })).toBeTruthy();
    expect(screen.getByText("This manually added photographer is ready for payment planning.")).toBeTruthy();
  });
});

function renderWorkspace(initialPlan: BudgetPlan = createPlanningHubStarterPlan(null)) {
  return render(
    <PlanningHubPhotographyWorkspace
      initialPlan={initialPlan}
      results={results}
      searchParams={{}}
      userId={null}
    />
  );
}
