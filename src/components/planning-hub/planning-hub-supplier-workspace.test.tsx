import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetPlan } from "@/lib/budget/types";
import { addManualPlanningHubSupplier, createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import type {
  PlanningHubSupplier,
  PlanningHubSupplierCategory,
  PlanningHubSupplierDetail,
  PlanningHubSupplierResults,
} from "@/lib/planning-hub/types";
import { PlanningHubSupplierWorkspace } from "./planning-hub-supplier-workspace";

const loadSupplierDetail = vi.fn();

vi.mock("@/app/actions/budget", () => ({
  saveBudgetPlan: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/app/actions/planning-hub", () => ({
  loadPlanningHubSupplierDetailAction: (...args: unknown[]) => loadSupplierDetail(...args),
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element -- test-only stand-in for the optimised component.
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));

const category: PlanningHubSupplierCategory = {
  slug: "videographer",
  label: "Videographer",
  plural: "Videographers",
  budgetCategoryId: "videography",
};

const suppliers: PlanningHubSupplier[] = [
  {
    id: "30000000-0000-4000-8000-000000000003",
    categorySlug: "videographer",
    slug: "films-one",
    name: "Films One",
    baseTown: "Perth",
    region: "Perthshire",
    summary: "Relaxed documentary wedding films.",
    heroImageUrl: "/everaft-logo-mark.svg",
    hasApprovedPhoto: false,
    startingPricePence: null,
    typicalPricePence: null,
    pricingSummary: "Quote required",
    pricingUnit: "quote",
    isClaimed: true,
    travelsNationwide: true,
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    categorySlug: "videographer",
    slug: "films-two",
    name: "Films Two",
    baseTown: "Dundee",
    region: "Angus",
    summary: "Modern cinematic wedding films.",
    heroImageUrl: "/everaft-logo-mark.svg",
    hasApprovedPhoto: false,
    startingPricePence: 180_000,
    typicalPricePence: 250_000,
    pricingSummary: "Full-day films",
    pricingUnit: "package",
    isClaimed: false,
    travelsNationwide: false,
  },
];

const results: PlanningHubSupplierResults = {
  suppliers,
  total: 2,
  page: 1,
  totalPages: 1,
};

const detail: PlanningHubSupplierDetail = {
  ...suppliers[0],
  description: "Films One creates relaxed, story-led wedding films.",
  services: ["Full-day filming", "Highlight film"],
  officialWebsiteUrl: "https://example.invalid",
  enquiryUrl: null,
  imageCredit: null,
  gallery: [],
};

describe("PlanningHubSupplierWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    loadSupplierDetail.mockReset();
    loadSupplierDetail.mockResolvedValue(detail);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("compares category suppliers without changing the connected budget", () => {
    renderWorkspace();
    const compareButtons = screen.getAllByRole("button", { name: "Compare" });

    fireEvent.click(compareButtons[0]);
    fireEvent.click(compareButtons[1]);

    expect(screen.getByRole("heading", { name: "Compare your videographer options" })).toBeTruthy();
    expect(screen.getByText("2 of 3 selected")).toBeTruthy();
    expect(screen.queryByText("Videographer shortlist")).toBeNull();
  });

  it("loads category-scoped detail and records a quote in the shared plan", async () => {
    renderWorkspace();
    const viewButton = screen.getAllByRole("button", { name: "View & plan" })[0];
    viewButton.focus();
    fireEvent.click(viewButton);

    const detailPanel = await screen.findByRole("region", { name: "Films One details" });
    expect(loadSupplierDetail).toHaveBeenCalledWith("videographer", suppliers[0].id);
    await waitFor(() => expect(document.activeElement).toBe(detailPanel));
    fireEvent.click(screen.getByRole("button", { name: "Close videographer details" }));
    await waitFor(() => expect(document.activeElement).toBe(viewButton));

    fireEvent.change(screen.getAllByLabelText("Planning stage")[0], { target: { value: "quoted" } });
    fireEvent.change(screen.getByLabelText("Working estimate or quote"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add videographer to plan" }));

    expect(await screen.findByText("Videographer shortlist")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/recorded with a quote/i);
  });

  it("keeps an unlisted supplier inside the same category and payment plan", () => {
    renderWorkspace();
    const manual = screen.getByText("Videographer not listed?").closest("details");
    expect(manual).toBeTruthy();
    fireEvent.click(within(manual!).getByText("Videographer not listed?"));
    fireEvent.change(within(manual!).getByLabelText("Videographer name"), { target: { value: "A family friend" } });
    fireEvent.change(within(manual!).getByLabelText("Working cost"), { target: { value: "500" } });
    fireEvent.click(within(manual!).getByRole("button", { name: "Add manual videographer" }));

    expect(screen.getByRole("heading", { name: "A family friend" })).toBeTruthy();
    expect(screen.getByText("This manually added videographer is ready for payment planning.")).toBeTruthy();
  });

  it("supports manual planning without presenting or querying an inactive catalogue", () => {
    renderWorkspace(
      createPlanningHubStarterPlan(null),
      null,
      false,
      { suppliers: [], total: 0, page: 1, totalPages: 1 },
    );

    expect(screen.getByRole("heading", { name: "Add your chosen videographer without losing the plan." })).toBeTruthy();
    expect(screen.getByText(/performs no supplier search/i)).toBeTruthy();
    expect(screen.queryByText("Films One")).toBeNull();
    expect(screen.getByLabelText("Videographer name")).toBeTruthy();
    expect(loadSupplierDetail).not.toHaveBeenCalled();
  });

  it("restores the latest manually added supplier for this category", () => {
    const reopenedPlan = addManualPlanningHubSupplier(
      createPlanningHubStarterPlan(null),
      "videographer",
      "A family friend",
      50_000,
      "quoted",
    );
    renderWorkspace(reopenedPlan);

    expect(screen.getByRole("heading", { name: "A family friend" })).toBeTruthy();
    expect(screen.getByText("This manually added videographer is ready for payment planning.")).toBeTruthy();
  });

  it("keeps a future live supplier stage inside the shared workspace", () => {
    renderWorkspace(
      createPlanningHubStarterPlan(null),
      "60000000-0000-4000-8000-000000000006",
    );

    expect(screen.getByRole("link", { name: /Review venue and wedding basics/i }).getAttribute("href"))
      .toBe("/planning-hub?workspace=60000000-0000-4000-8000-000000000006");
    expect(screen.getByRole("link", { name: /organise guests and tables/i }).getAttribute("href"))
      .toBe("/planning-hub/organise?workspace=60000000-0000-4000-8000-000000000006");
  });

  it("removes a category supplier from active planning and keeps it available to re-add", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Add videographer to plan" }));
    expect(screen.getByText("Videographer shortlist")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove from plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove from plan" }));

    const heading = within(screen.getByTestId("current-supplier-planning"))
      .getByRole("heading", { name: "Films One" });
    expect(screen.getByRole("button", { name: "Add videographer to plan" })).toBeTruthy();
    expect(screen.queryByText("Videographer shortlist")).toBeNull();
    expect(screen.queryByText("cancelled")).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/removed from your plan/i);
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });
});

function renderWorkspace(
  initialPlan: BudgetPlan = createPlanningHubStarterPlan(null),
  connectedWorkspaceId: string | null = null,
  catalogueLive = true,
  resultData: PlanningHubSupplierResults = results,
) {
  return render(
    <PlanningHubSupplierWorkspace
      catalogueLive={catalogueLive}
      category={category}
      connectedWorkspaceId={connectedWorkspaceId}
      initialPlan={initialPlan}
      results={resultData}
      searchParams={{}}
      userId={null}
    />,
  );
}
