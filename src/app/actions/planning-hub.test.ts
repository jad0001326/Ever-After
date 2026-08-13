import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupplierDetail = vi.fn();
const getLiveCategory = vi.fn();

vi.mock("@/lib/planning-hub/photographers", () => ({
  getPlanningHubPhotographerDetail: vi.fn(),
}));

vi.mock("@/lib/planning-hub/venues", () => ({
  getPlanningHubVenueDetail: vi.fn(),
}));

vi.mock("@/lib/planning-hub/supplier-search", () => ({
  getLivePlanningHubSupplierCategory: (...args: unknown[]) => getLiveCategory(...args),
}));

vi.mock("@/lib/planning-hub/suppliers", () => ({
  getPlanningHubSupplierDetail: (...args: unknown[]) => getSupplierDetail(...args),
}));

import { loadPlanningHubSupplierDetailAction } from "./planning-hub";

describe("Planning Hub supplier detail action", () => {
  beforeEach(() => {
    getSupplierDetail.mockReset();
    getSupplierDetail.mockResolvedValue({ id: "supplier-detail" });
    getLiveCategory.mockReset();
  });

  it("reads a detail only when both category and supplier ID are valid", async () => {
    getLiveCategory.mockReturnValue({
      slug: "videographer",
      label: "Videographer",
      plural: "Videographers",
      budgetCategoryId: "videography",
      live: true,
    });

    const result = await loadPlanningHubSupplierDetailAction(
      "videographer",
      "30000000-0000-4000-8000-000000000003",
    );

    expect(getSupplierDetail).toHaveBeenCalledWith(
      "videographer",
      "30000000-0000-4000-8000-000000000003",
    );
    expect(result).toEqual({ id: "supplier-detail" });
  });

  it("does not read inactive, photography, or malformed requests", async () => {
    getLiveCategory.mockReturnValueOnce(null);
    await expect(loadPlanningHubSupplierDetailAction("videographer", "30000000-0000-4000-8000-000000000003")).resolves.toBeNull();

    getLiveCategory.mockReturnValueOnce({ slug: "photographer", live: true });
    await expect(loadPlanningHubSupplierDetailAction("photographer", "30000000-0000-4000-8000-000000000003")).resolves.toBeNull();

    getLiveCategory.mockReturnValueOnce({ slug: "videographer", live: true });
    await expect(loadPlanningHubSupplierDetailAction("videographer", "not-a-uuid")).resolves.toBeNull();

    expect(getSupplierDetail).not.toHaveBeenCalled();
  });
});
